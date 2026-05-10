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
from app.schemas.auction_dashboard import (
    AuctionDashboardCharts,
    AuctionDashboardSummary,
    AuctionItemsListResponse,
)
from app.schemas.checklist import ChecklistResponse
from app.schemas.donor_dashboard import CategoryBreakdownResponse, DonorLeaderboardResponse
from app.schemas.event_dashboard import DashboardSummary, SegmentBreakdownResponse
from app.schemas.run_of_show import RunOfShowResponse
from app.services.auction_dashboard_service import AuctionDashboardService
from app.services.checklist_service import ChecklistService
from app.services.donor_dashboard_service import DonorDashboardService
from app.services.event_dashboard_service import EventDashboardService
from app.services.report_utils import fetch_image_as_base64, get_fundrbolt_logo_b64
from app.services.run_of_show_service import RunOfShowService

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
        seg_registrant = await dashboard_svc.get_segment_breakdown(event_id, "registrant", limit=10)

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

        # Donor dashboard data (scoped to this event)
        npo_ids = [event.npo_id] if event.npo_id else []
        donor_svc = DonorDashboardService(self._db)
        donor_leaderboard: DonorLeaderboardResponse = await donor_svc.get_leaderboard(
            npo_ids, event_id=event_id, per_page=25
        )
        category_breakdown: CategoryBreakdownResponse = await donor_svc.get_category_breakdown(
            npo_ids, event_id=event_id
        )

        # Auction dashboard data (scoped to this event)
        auction_svc = AuctionDashboardService(self._db)
        auction_summary: AuctionDashboardSummary = await auction_svc.get_summary(
            npo_ids, event_id=event_id
        )
        auction_items: AuctionItemsListResponse = await auction_svc.get_items(
            npo_ids, event_id=event_id, per_page=50
        )
        auction_charts: AuctionDashboardCharts = await auction_svc.get_charts(
            npo_ids, event_id=event_id
        )

        # Run of Show and Checklist
        ros_data: RunOfShowResponse = await RunOfShowService.get_event_ros(self._db, event_id)
        checklist_data: ChecklistResponse = await ChecklistService.get_event_checklist(
            self._db, event_id
        )

        # 2. Run all synchronous CPU-bound work (charts + WeasyPrint) in executor
        template = self._jinja.get_template("reports/event_report.html")
        generated_at = datetime.now(UTC).strftime("%B %d, %Y at %I:%M %p UTC")

        fundrbolt_logo_b64 = get_fundrbolt_logo_b64()

        def _build_pdf() -> bytes:
            context = _build_context(
                summary=summary,
                seg_table=seg_table,
                seg_guest=seg_guest,
                seg_company=seg_company,
                seg_registrant=seg_registrant,
                event_name=event_name,
                event_date=event_date,
                event_slug=event_slug,
                npo_name=npo_name,
                npo_logo_data=npo_logo_data,
                generated_at=generated_at,
                fundrbolt_logo_b64=fundrbolt_logo_b64,
                donor_leaderboard=donor_leaderboard,
                category_breakdown=category_breakdown,
                auction_summary=auction_summary,
                auction_items=auction_items,
                auction_charts=auction_charts,
                ros_data=ros_data,
                checklist_data=checklist_data,
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


def _generate_pie_chart(data: list[dict[str, Any]], title: str) -> str:
    """Pie chart for category/type breakdowns."""
    if not data:
        return ""
    filtered = [d for d in data if d["value"] > 0]
    if not filtered:
        return ""
    labels = [d["label"].replace("_", " ").title() for d in filtered]
    values = [d["value"] for d in filtered]

    fig, ax = plt.subplots(figsize=(5, 3.5))
    wedge_props: dict[str, Any] = {"linewidth": 0.5, "edgecolor": "white"}
    colors = [
        "#2563eb",
        "#16a34a",
        "#f59e0b",
        "#dc2626",
        "#7c3aed",
        "#0891b2",
        "#db2777",
        "#65a30d",
    ]
    ax.pie(
        values,
        labels=labels,
        autopct="%1.1f%%",
        startangle=140,
        colors=colors[: len(values)],
        wedgeprops=wedge_props,
        textprops={"fontsize": 7},
    )
    ax.set_title(title, fontsize=10, fontweight="bold")
    fig.tight_layout()
    return _chart_to_base64(fig)


def _generate_hbar_chart(
    data: list[dict[str, Any]], title: str, xlabel: str = "Amount (USD)"
) -> str:
    """Horizontal bar chart for labelled value data."""
    if not data:
        return ""
    top = data[:10]
    labels = [d["label"].replace("_", " ").title() for d in top]
    values = [d["value"] for d in top]

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
    ax.set_xlabel(xlabel, fontsize=8)
    ax.set_title(title, fontsize=10, fontweight="bold")
    fig.tight_layout()
    return _chart_to_base64(fig)


def _generate_hbar_count_chart(data: list[dict[str, Any]], title: str) -> str:
    """Horizontal bar chart where values are counts (not currency)."""
    if not data:
        return ""
    top = data[:10]
    labels = [d["label"].replace("_", " ").title() for d in top]
    values = [d["value"] for d in top]

    fig, ax = plt.subplots(figsize=(6, max(2.5, len(labels) * 0.4)))
    bars = ax.barh(labels[::-1], values[::-1], color="#16a34a")
    max_val = max(values) if values else 1
    for bar, val in zip(bars, values[::-1], strict=True):
        ax.text(
            val + max_val * 0.01,
            bar.get_y() + bar.get_height() / 2,
            f"{int(val):,}",
            va="center",
            fontsize=7,
        )
    ax.set_xlabel("Bid Count", fontsize=8)
    ax.set_title(title, fontsize=10, fontweight="bold")
    fig.tight_layout()
    return _chart_to_base64(fig)


def _generate_pacing_chart(sources: list[dict[str, Any]]) -> str:
    """Horizontal bar chart showing pacing % per revenue source."""
    if not sources:
        return ""
    data = [s for s in sources if s.get("pacing_percent", 0) > 0]
    if not data:
        return ""
    labels = [s["source"].replace("_", " ").title() for s in data]
    values = [s["pacing_percent"] for s in data]
    colors = ["#16a34a" if v >= 90 else "#f59e0b" if v >= 70 else "#dc2626" for v in values]

    fig, ax = plt.subplots(figsize=(6, max(2.5, len(labels) * 0.45)))
    ax.barh(labels[::-1], values[::-1], color=colors[::-1])
    ax.axvline(x=100, color="#64748b", linewidth=1, linestyle="--", label="100% target")
    max_val = max(max(values), 105)
    ax.set_xlim(0, max_val)
    for i, val in enumerate(values[::-1]):
        ax.text(val + max_val * 0.01, i, f"{val:.0f}%", va="center", fontsize=7)
    ax.set_xlabel("Pacing %", fontsize=8)
    ax.set_title("Pacing by Revenue Source", fontsize=10, fontweight="bold")
    ax.legend(fontsize=7)
    fig.tight_layout()
    return _chart_to_base64(fig)


# ── Context builder (sync, called inside executor) ────────────────────────────


def _build_context(
    summary: DashboardSummary,
    seg_table: SegmentBreakdownResponse,
    seg_guest: SegmentBreakdownResponse,
    seg_company: SegmentBreakdownResponse,
    seg_registrant: SegmentBreakdownResponse,
    event_name: str,
    event_date: str,
    event_slug: str,
    npo_name: str,
    npo_logo_data: str | None,
    generated_at: str,
    fundrbolt_logo_b64: str | None = None,
    donor_leaderboard: DonorLeaderboardResponse | None = None,
    category_breakdown: CategoryBreakdownResponse | None = None,
    auction_summary: AuctionDashboardSummary | None = None,
    auction_items: AuctionItemsListResponse | None = None,
    auction_charts: AuctionDashboardCharts | None = None,
    ros_data: RunOfShowResponse | None = None,
    checklist_data: ChecklistResponse | None = None,
) -> dict[str, Any]:
    """Build Jinja2 template context from service data."""
    sources_data = [
        {
            "source": s.source,
            "actual": float(s.actual.amount),
            "projected": float(s.projected.amount),
            "variance_amount": float(s.variance_amount.amount),
            "variance_percent": s.variance_percent,
            "pacing_percent": s.pacing_percent,
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
    chart_pacing = _generate_pacing_chart(sources_data)
    chart_table = _generate_segment_chart(_seg_items(seg_table), "Leaderboard by Table")
    chart_guest = _generate_segment_chart(_seg_items(seg_guest), "Leaderboard by Guest")
    chart_company = _generate_segment_chart(_seg_items(seg_company), "Leaderboard by Company")
    chart_registrant = _generate_segment_chart(
        _seg_items(seg_registrant), "Leaderboard by Registrant"
    )

    funnel = [{"stage": f.stage, "count": f.count} for f in summary.funnel]

    # ── Donor dashboard ─────────────────────────────────────────────────────
    donor_leaders = []
    if donor_leaderboard:
        for e in donor_leaderboard.items:
            donor_leaders.append(
                {
                    "name": f"{e.first_name} {e.last_name}".strip(),
                    "total_given": e.total_given,
                    "ticket_total": e.ticket_total,
                    "donation_total": e.donation_total,
                    "silent_auction_total": e.silent_auction_total,
                    "live_auction_total": e.live_auction_total,
                    "buy_now_total": e.buy_now_total,
                }
            )

    giving_type_data: list[dict[str, Any]] = []
    giving_type_chart = ""
    auction_cat_data: list[dict[str, Any]] = []
    auction_cat_chart = ""
    if category_breakdown:
        giving_type_data = [
            {
                "label": g.category,
                "value": g.total_amount,
                "donor_count": g.donor_count,
            }
            for g in category_breakdown.giving_type_breakdown
            if g.total_amount > 0
        ]
        giving_type_chart = _generate_pie_chart(giving_type_data, "Revenue by Giving Type")

        auction_cat_data = [
            {
                "label": a.category,
                "value": a.total_revenue,
                "bid_count": a.bid_count,
                "item_count": a.item_count,
            }
            for a in category_breakdown.auction_category_breakdown
            if a.total_revenue > 0
        ]
        auction_cat_chart = _generate_hbar_chart(auction_cat_data, "Auction Revenue by Category")

    # ── Auction dashboard ────────────────────────────────────────────────────
    auction_kpis: dict[str, Any] = {}
    if auction_summary:
        auction_kpis = {
            "total_items": auction_summary.total_items,
            "total_bids": auction_summary.total_bids,
            "total_revenue": auction_summary.total_revenue,
            "average_bid_amount": auction_summary.average_bid_amount,
        }

    auction_rows = []
    if auction_items:
        for item in auction_items.items:
            auction_rows.append(
                {
                    "title": item.title,
                    "auction_type": item.auction_type.replace("_", " ").title(),
                    "category": item.category or "—",
                    "current_bid": item.current_bid_amount,
                    "bid_count": item.bid_count,
                    "watcher_count": item.watcher_count,
                    "status": item.status.replace("_", " ").title(),
                    "donated_by": item.donated_by or "",
                }
            )

    chart_auction_rev_type = ""
    chart_auction_rev_cat = ""
    chart_auction_top_rev = ""
    chart_auction_top_bids = ""
    if auction_charts:
        rev_type = [{"label": p.label, "value": p.value} for p in auction_charts.revenue_by_type]
        chart_auction_rev_type = _generate_pie_chart(rev_type, "Auction Revenue by Type")

        rev_cat = [{"label": p.label, "value": p.value} for p in auction_charts.revenue_by_category]
        chart_auction_rev_cat = _generate_hbar_chart(rev_cat, "Auction Revenue by Category")

        top_rev = [
            {"label": p.label, "value": p.value} for p in auction_charts.top_items_by_revenue
        ]
        chart_auction_top_rev = _generate_hbar_chart(top_rev, "Top Items by Revenue")

        top_bids = [
            {"label": p.label, "value": p.value} for p in auction_charts.top_items_by_bid_count
        ]
        chart_auction_top_bids = _generate_hbar_count_chart(top_bids, "Top Items by Bid Count")

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
        "chart_pacing": chart_pacing,
        "chart_table": chart_table,
        "chart_guest": chart_guest,
        "chart_company": chart_company,
        "chart_registrant": chart_registrant,
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
        "seg_registrant": [
            {
                "label": i.segment_label,
                "amount": float(i.total_amount.amount),
                "share": i.contribution_share,
            }
            for i in seg_registrant.items
        ],
        "fundrbolt_logo_b64": fundrbolt_logo_b64,
        # Donor dashboard
        "donor_leaders": donor_leaders,
        "giving_type_data": giving_type_data,
        "giving_type_chart": giving_type_chart,
        "auction_cat_data": auction_cat_data,
        "auction_cat_chart": auction_cat_chart,
        # Auction dashboard
        "auction_kpis": auction_kpis,
        "auction_rows": auction_rows,
        "chart_auction_rev_type": chart_auction_rev_type,
        "chart_auction_rev_cat": chart_auction_rev_cat,
        "chart_auction_top_rev": chart_auction_top_rev,
        "chart_auction_top_bids": chart_auction_top_bids,
        # Alerts
        "alerts": [
            {
                "source": a.source.replace("_", " ").title(),
                "status": a.status,
                "threshold_percent": a.threshold_percent,
                "consecutive_refreshes": a.consecutive_refreshes,
            }
            for a in summary.alerts
        ],
        # Run of Show
        "ros_items": [
            {
                "scheduled_time": item.scheduled_time.strftime("%H:%M")
                if item.scheduled_time
                else "—",
                "title": item.title,
                "description": item.description or "",
                "is_complete": item.is_complete,
                "display_order": item.display_order,
            }
            for item in (ros_data.items if ros_data else [])
        ],
        "ros_total": ros_data.total_count if ros_data else 0,
        "ros_completed": ros_data.completed_count if ros_data else 0,
        # Checklist
        "checklist_items": [
            {
                "title": item.title,
                "due_date": item.due_date.strftime("%b %d, %Y") if item.due_date else "—",
                "status": item.status.replace("_", " ").title(),
                "is_overdue": item.is_overdue,
            }
            for item in (checklist_data.items if checklist_data else [])
        ],
        "checklist_total": checklist_data.total_count if checklist_data else 0,
        "checklist_completed": checklist_data.completed_count if checklist_data else 0,
        "checklist_in_progress": checklist_data.in_progress_count if checklist_data else 0,
        "checklist_overdue": checklist_data.overdue_count if checklist_data else 0,
        "checklist_progress_pct": f"{checklist_data.progress_percentage:.0f}"
        if checklist_data
        else "0",
    }
