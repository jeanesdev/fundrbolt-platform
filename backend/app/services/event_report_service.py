"""Event Summary Report PDF generation service."""

from __future__ import annotations

import asyncio
import base64
import io
import logging
import pathlib
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import aiohttp
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.npo import NPO
from app.schemas.event_dashboard import DashboardSummary, SegmentBreakdownResponse
from app.services.event_dashboard_service import EventDashboardService
from app.services.report_utils import fetch_image_as_base64

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = pathlib.Path(__file__).parent.parent / "templates"


class EventReportService:
    """Generate a full-colour PDF event summary report."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._jinja = Environment(
            loader=FileSystemLoader(str(_TEMPLATES_DIR)),
            autoescape=select_autoescape(["html", "j2"]),
        )

    async def generate_pdf(self, event_id: UUID) -> bytes:
        """Generate the event summary PDF and return raw bytes.

        Raises RuntimeError on generation failure.
        """
        # 1. Load all async data before entering executor
        dashboard_svc = EventDashboardService(self._db)

        summary: DashboardSummary = await dashboard_svc.get_dashboard_summary(event_id)
        seg_table = await dashboard_svc.get_segment_breakdown(event_id, "table", limit=10)
        seg_guest = await dashboard_svc.get_segment_breakdown(event_id, "guest", limit=10)
        seg_company = await dashboard_svc.get_segment_breakdown(event_id, "company", limit=10)

        # Load event + NPO info
        event_result = await self._db.execute(
            select(Event)
            .options(selectinload(Event.npo).selectinload(NPO.branding))
            .where(Event.id == event_id)
        )
        event = event_result.scalar_one_or_none()
        if event is None:
            raise RuntimeError("Event not found")

        npo_name: str = ""
        npo_logo_data: str | None = None
        if event.npo:
            npo_name = event.npo.name or ""
            if event.npo.branding and event.npo.branding.logo_url:
                async with aiohttp.ClientSession() as http_session:
                    npo_logo_data = await fetch_image_as_base64(
                        event.npo.branding.logo_url, http_session
                    )

        event_name = event.name or "Event"
        event_date = ""
        if hasattr(event, "event_datetime") and event.event_datetime:
            event_date = event.event_datetime.strftime("%B %d, %Y")
        event_slug = event.slug or str(event_id)

        # 2. Run all synchronous CPU-bound work (charts + WeasyPrint) in executor
        template = self._jinja.get_template("reports/event_report.html")
        generated_at = datetime.now(UTC).strftime("%B %d, %Y at %I:%M %p UTC")

        def _build_pdf() -> bytes:
            context = _build_context(
                summary=summary,
                seg_table=seg_table,
                seg_guest=seg_guest,
                seg_company=seg_company,
                event_name=event_name,
                event_date=event_date,
                event_slug=event_slug,
                npo_name=npo_name,
                npo_logo_data=npo_logo_data,
                generated_at=generated_at,
            )
            html = template.render(**context)
            from weasyprint import HTML  # noqa: PLC0415

            buf = io.BytesIO()
            HTML(string=html).write_pdf(buf)
            return buf.getvalue()

        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(None, _build_pdf)
        except Exception as exc:
            logger.error("Event report PDF generation failed for event %s", event_id, exc_info=True)
            raise RuntimeError(f"PDF generation failed: {exc}") from exc


# ── Chart helpers (sync, called inside executor) ──────────────────────────────


def _chart_to_base64(fig: Any) -> str:
    """Convert a matplotlib Figure to a base64-encoded PNG data URI."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=96)
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("ascii")
    plt.close(fig)
    return f"data:image/png;base64,{b64}"


def _generate_revenue_chart(sources: list[dict[str, Any]]) -> str:
    """Bar chart: actual vs projected revenue by source."""
    if not sources:
        return ""
    labels = [s["source"].replace("_", " ").title() for s in sources]
    actuals = [s["actual"] for s in sources]
    projections = [s["projected"] for s in sources]

    x = range(len(labels))
    fig, ax = plt.subplots(figsize=(7, 3.5))
    width = 0.35
    bars1 = ax.bar([i - width / 2 for i in x], actuals, width, label="Actual", color="#2563eb")
    bars2 = ax.bar(
        [i + width / 2 for i in x], projections, width, label="Projected", color="#93c5fd"
    )

    for bar in bars1:
        h = bar.get_height()
        if h > 0:
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                h + max(actuals) * 0.01,
                f"${h:,.0f}",
                ha="center",
                va="bottom",
                fontsize=7,
            )
    for bar in bars2:
        h = bar.get_height()
        if h > 0:
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                h + max(projections) * 0.01,
                f"${h:,.0f}",
                ha="center",
                va="bottom",
                fontsize=7,
            )

    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=8)
    ax.set_ylabel("Amount (USD)", fontsize=8)
    ax.legend(fontsize=8)
    ax.set_title("Revenue by Source", fontsize=10, fontweight="bold")
    fig.tight_layout()
    return _chart_to_base64(fig)


def _generate_cashflow_chart(cashflow: list[dict[str, Any]]) -> str:
    """Line chart: actual vs projected cashflow over time."""
    if not cashflow:
        return ""
    dates = [c["date"] for c in cashflow]
    actuals = [c["actual"] for c in cashflow]
    projections = [c["projected"] for c in cashflow]

    fig, ax = plt.subplots(figsize=(7, 3))
    ax.plot(
        dates, actuals, marker="o", markersize=4, label="Actual", color="#2563eb", linewidth=1.5
    )
    ax.plot(
        dates,
        projections,
        marker="s",
        markersize=4,
        linestyle="--",
        label="Projected",
        color="#93c5fd",
        linewidth=1.5,
    )
    for i, (d, v) in enumerate(zip(dates, actuals, strict=True)):
        if i % max(1, len(dates) // 5) == 0:
            ax.annotate(
                f"${v:,.0f}",
                (d, v),
                textcoords="offset points",
                xytext=(0, 6),
                ha="center",
                fontsize=7,
            )
    ax.set_ylabel("Cumulative (USD)", fontsize=8)
    ax.legend(fontsize=8)
    ax.set_title("Cashflow Timeline", fontsize=10, fontweight="bold")
    ax.tick_params(axis="x", labelsize=7, rotation=30)
    fig.tight_layout()
    return _chart_to_base64(fig)


def _generate_waterfall_chart(steps: list[dict[str, Any]]) -> str:
    """Horizontal bar chart for waterfall steps."""
    if not steps:
        return ""
    labels = [s["label"] for s in steps]
    amounts = [s["amount"] for s in steps]

    fig, ax = plt.subplots(figsize=(6, max(2.5, len(labels) * 0.45)))
    colors = ["#2563eb" if a >= 0 else "#ef4444" for a in amounts]
    bars = ax.barh(labels, amounts, color=colors)
    for bar, val in zip(bars, amounts, strict=True):
        ax.text(
            max(val, 0) + max(amounts) * 0.01,
            bar.get_y() + bar.get_height() / 2,
            f"${val:,.0f}",
            va="center",
            fontsize=7,
        )
    ax.set_xlabel("Amount (USD)", fontsize=8)
    ax.set_title("Revenue Waterfall", fontsize=10, fontweight="bold")
    fig.tight_layout()
    return _chart_to_base64(fig)


def _generate_segment_chart(items: list[dict[str, Any]], title: str) -> str:
    """Horizontal bar chart for segment leaderboard."""
    if not items:
        return ""
    top = items[:10]
    labels = [i["label"] for i in top]
    values = [i["amount"] for i in top]

    fig, ax = plt.subplots(figsize=(6, max(2.5, len(labels) * 0.4)))
    bars = ax.barh(labels[::-1], values[::-1], color="#2563eb")
    max_val = max(values) if values else 1
    for bar, val in zip(bars, values[::-1], strict=True):
        ax.text(
            val + max_val * 0.01,
            bar.get_y() + bar.get_height() / 2,
            f"${val:,.0f}",
            va="center",
            fontsize=7,
        )
    ax.set_xlabel("Total Raised (USD)", fontsize=8)
    ax.set_title(title, fontsize=10, fontweight="bold")
    fig.tight_layout()
    return _chart_to_base64(fig)


# ── Context builder (sync, called inside executor) ────────────────────────────


def _build_context(
    summary: DashboardSummary,
    seg_table: SegmentBreakdownResponse,
    seg_guest: SegmentBreakdownResponse,
    seg_company: SegmentBreakdownResponse,
    event_name: str,
    event_date: str,
    event_slug: str,
    npo_name: str,
    npo_logo_data: str | None,
    generated_at: str,
) -> dict[str, Any]:
    """Build Jinja2 template context from service data."""
    sources_data = [
        {
            "source": s.source,
            "actual": float(s.actual.amount),
            "projected": float(s.projected.amount),
            "variance_amount": float(s.variance_amount.amount),
            "variance_percent": s.variance_percent,
        }
        for s in summary.sources
    ]

    cashflow_data = [
        {
            "date": str(c.date),
            "actual": float(c.actual.amount),
            "projected": float(c.projected.amount),
        }
        for c in summary.cashflow
    ]

    waterfall_data = [
        {"label": w.label, "amount": float(w.amount.amount)} for w in summary.waterfall
    ]

    def _seg_items(seg: SegmentBreakdownResponse) -> list[dict[str, Any]]:
        return [
            {"label": i.segment_label, "amount": float(i.total_amount.amount)} for i in seg.items
        ]

    chart_revenue = _generate_revenue_chart(sources_data)
    chart_cashflow = _generate_cashflow_chart(cashflow_data)
    chart_waterfall = _generate_waterfall_chart(waterfall_data)
    chart_table = _generate_segment_chart(_seg_items(seg_table), "Leaderboard by Table")
    chart_guest = _generate_segment_chart(_seg_items(seg_guest), "Leaderboard by Guest")
    chart_company = _generate_segment_chart(_seg_items(seg_company), "Leaderboard by Company")

    funnel = [{"stage": f.stage, "count": f.count} for f in summary.funnel]

    return {
        "event_name": event_name,
        "event_date": event_date,
        "event_slug": event_slug,
        "npo_name": npo_name,
        "npo_logo_data": npo_logo_data,
        "generated_at": generated_at,
        "total_actual": f"{float(summary.total_actual.amount):,.2f}",
        "total_projected": f"{float(summary.total_projected.amount):,.2f}",
        "goal": f"{float(summary.goal.amount):,.2f}",
        "variance_amount": f"{float(summary.variance_amount.amount):,.2f}",
        "variance_percent": f"{summary.variance_percent:.1f}",
        "pacing_status": summary.pacing.status,
        "pacing_percent": f"{summary.pacing.pacing_percent:.1f}",
        "sources": sources_data,
        "funnel": funnel,
        "chart_revenue": chart_revenue,
        "chart_cashflow": chart_cashflow,
        "chart_waterfall": chart_waterfall,
        "chart_table": chart_table,
        "chart_guest": chart_guest,
        "chart_company": chart_company,
        "seg_table": [
            {
                "label": i.segment_label,
                "amount": float(i.total_amount.amount),
                "share": i.contribution_share,
            }
            for i in seg_table.items
        ],
        "seg_guest": [
            {
                "label": i.segment_label,
                "amount": float(i.total_amount.amount),
                "share": i.contribution_share,
            }
            for i in seg_guest.items
        ],
        "seg_company": [
            {
                "label": i.segment_label,
                "amount": float(i.total_amount.amount),
                "share": i.contribution_share,
            }
            for i in seg_company.items
        ],
    }
