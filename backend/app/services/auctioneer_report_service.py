"""Auctioneer Financial Report PDF generation service."""

from __future__ import annotations

import asyncio
import io
import logging
import pathlib
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.schemas.auctioneer import CommissionListResponse, DashboardResponse, EventSettingsResponse
from app.services.auctioneer_service import AuctioneerService

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = pathlib.Path(__file__).parent.parent / "templates"


class AuctioneerReportService:
    """Generate an auctioneer financial summary PDF."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._jinja = Environment(
            loader=FileSystemLoader(str(_TEMPLATES_DIR)),
            autoescape=select_autoescape(["html", "j2"]),
        )

    async def generate_pdf(
        self,
        event_id: UUID,
        auctioneer_user_id: UUID,
        auctioneer_display_name: str,
    ) -> bytes:
        """Generate the auctioneer financial report PDF.

        Raises RuntimeError on generation failure.
        """
        # 1. Load all async data
        svc = AuctioneerService(self._db)
        dashboard: DashboardResponse = await svc.get_dashboard(event_id, auctioneer_user_id)
        commissions: CommissionListResponse = await svc.get_commissions(
            event_id, auctioneer_user_id
        )
        settings: EventSettingsResponse = await svc.get_event_settings(event_id, auctioneer_user_id)

        event_result = await self._db.execute(
            select(Event.name, Event.event_datetime).where(Event.id == event_id)
        )
        event_row = event_result.first()
        event_name = event_row[0] if event_row and event_row[0] else "Event"
        event_date = ""
        if event_row and event_row[1]:
            event_date = event_row[1].strftime("%B %d, %Y")

        generated_at = datetime.now(UTC).strftime("%B %d, %Y at %I:%M %p UTC")
        template = self._jinja.get_template("reports/auctioneer_report.html")

        def _build_pdf() -> bytes:
            context = _build_context(
                dashboard=dashboard,
                commissions=commissions,
                settings=settings,
                event_name=event_name,
                event_date=event_date,
                auctioneer_display_name=auctioneer_display_name,
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
            logger.error(
                "Auctioneer report PDF generation failed for event %s", event_id, exc_info=True
            )
            raise RuntimeError(f"PDF generation failed: {exc}") from exc


def _build_context(
    dashboard: DashboardResponse,
    commissions: CommissionListResponse,
    settings: EventSettingsResponse,
    event_name: str,
    event_date: str,
    auctioneer_display_name: str,
    generated_at: str,
) -> dict[str, Any]:
    """Build Jinja2 template context for the auctioneer report."""
    totals = dashboard.event_totals
    earnings = dashboard.earnings

    event_totals: list[dict[str, Any]] = [
        {"category": "Live Auction", "amount": float(totals.live_auction_raised)},
        {"category": "Silent Auction", "amount": float(totals.silent_auction_raised)},
        {"category": "Paddle Raise", "amount": float(totals.paddle_raise_raised)},
        {"category": "Event Total", "amount": float(totals.event_total_raised), "is_total": True},
    ]

    category_earnings: list[dict[str, Any]] = [
        {
            "category": "Live Auction",
            "revenue": float(totals.live_auction_raised),
            "rate": float(settings.live_auction_percent),
            "earned": float(earnings.live_auction_category_earning),
        },
        {
            "category": "Silent Auction",
            "revenue": float(totals.silent_auction_raised),
            "rate": float(settings.silent_auction_percent),
            "earned": float(earnings.silent_auction_category_earning),
        },
        {
            "category": "Paddle Raise",
            "revenue": float(totals.paddle_raise_raised),
            "rate": float(settings.paddle_raise_percent),
            "earned": float(earnings.paddle_raise_category_earning),
        },
    ]
    category_total: float = sum(float(e["earned"]) for e in category_earnings)

    commission_rows: list[dict[str, Any]] = [
        {
            "bid_number": c.auction_item_bid_number,
            "title": c.auction_item_title,
            "auction_type": (c.auction_type or "").replace("_", " ").title(),
            "sale_amount": float(c.current_bid_amount) if c.current_bid_amount else 0.0,
            "commission_percent": float(c.commission_percent),
            "flat_fee": float(c.flat_fee),
            "earned": (
                float(c.current_bid_amount or 0) * float(c.commission_percent) / 100
                + float(c.flat_fee)
            ),
        }
        for c in commissions.commissions
    ]
    per_item_total: float = sum(float(r["earned"]) for r in commission_rows)
    grand_total = category_total + per_item_total

    no_commissions: bool = (not commissions.commissions) and all(
        float(e["rate"]) == 0.0 for e in category_earnings
    )

    return {
        "event_name": event_name,
        "event_date": event_date,
        "auctioneer_display_name": auctioneer_display_name,
        "generated_at": generated_at,
        "event_totals": event_totals,
        "category_earnings": category_earnings,
        "category_total": category_total,
        "commission_rows": commission_rows,
        "per_item_total": per_item_total,
        "grand_total": grand_total,
        "no_commissions": no_commissions,
    }
