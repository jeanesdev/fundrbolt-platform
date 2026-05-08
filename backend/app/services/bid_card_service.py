"""Bid Card PDF generation service for auction items."""

from __future__ import annotations

import asyncio
import base64
import io
import logging
import pathlib
from uuid import UUID

import aiohttp
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auction_item import AuctionItem, AuctionItemMedia
from app.schemas.reports import BidCardRequest
from app.services.report_utils import fetch_image_as_base64, get_fundrbolt_logo_b64

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = pathlib.Path(__file__).parent.parent / "templates"


def _generate_qr_base64(url: str) -> str:
    """Generate a QR code PNG from a URL and return as base64 data URI."""
    import qrcode  # noqa: PLC0415
    from qrcode.image.pil import PilImage  # noqa: PLC0415

    qr: qrcode.QRCode[PilImage] = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("ascii")
    return f"data:image/png;base64,{b64}"


class BidCardService:
    """Generate a Brady-label-compatible bid card PDF."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._jinja = Environment(
            loader=FileSystemLoader(str(_TEMPLATES_DIR)),
            autoescape=select_autoescape(["html", "j2"]),
        )

    async def generate_pdf(
        self,
        event_id: UUID,
        request: BidCardRequest,
        item_ids: list[UUID] | None = None,
    ) -> bytes:
        """Generate bid card PDF for selected (or all published) auction items.

        Raises ValueError("no_items") if no qualifying items are found.
        Raises RuntimeError on PDF generation failure.
        """
        # 1. Query auction items
        stmt = (
            select(AuctionItem)
            .options(selectinload(AuctionItem.media))
            .where(
                AuctionItem.event_id == event_id,
                AuctionItem.status == "published",
                AuctionItem.deleted_at.is_(None),
            )
            .order_by(AuctionItem.bid_number.asc())
        )
        if not request.include_live:
            stmt = stmt.where(AuctionItem.auction_type == "silent")
        if item_ids:
            stmt = stmt.where(AuctionItem.id.in_(item_ids))

        result = await self._db.execute(stmt)
        items = result.scalars().all()

        if not items:
            raise ValueError("no_items")

        # 2. Fetch images + event logo asynchronously before entering executor
        from app.core.config import get_settings  # noqa: PLC0415
        from app.models.event import Event  # noqa: PLC0415
        from app.models.npo import NPO  # noqa: PLC0415
        from app.models.npo_branding import NPOBranding  # noqa: PLC0415

        settings = get_settings()
        donor_pwa_base = getattr(settings, "donor_pwa_base_url", "https://app.fundrbolt.com")

        # Get event slug and logo for the cards
        event_row = await self._db.execute(
            select(Event.slug, Event.logo_url, Event.npo_id).where(Event.id == event_id)
        )
        event_data = event_row.one_or_none()
        event_slug = (event_data[0] if event_data else None) or str(event_id)
        event_logo_url: str | None = event_data[1] if event_data else None
        npo_id = event_data[2] if event_data else None

        # Fall back to NPO branding logo if the event has no dedicated logo
        if not event_logo_url and npo_id is not None:
            npo_row = await self._db.execute(
                select(NPOBranding.logo_url)
                .join(NPO, NPOBranding.npo_id == NPO.id)
                .where(NPO.id == npo_id)
            )
            event_logo_url = npo_row.scalar_one_or_none()

        # Collect image URLs first, then fetch them concurrently
        image_urls: list[str | None] = []
        for item in items:
            media_list: list[AuctionItemMedia] = sorted(
                [m for m in (item.media or []) if m.media_type == "image"],
                key=lambda m: m.display_order if m.display_order is not None else 999,
            )
            image_urls.append(media_list[0].file_path if media_list else None)

        # Fetch all item images + event logo concurrently
        async with aiohttp.ClientSession() as http_session:
            sem = asyncio.Semaphore(10)

            async def _fetch(url: str | None) -> str | None:
                if not url:
                    return None
                async with sem:
                    return await fetch_image_as_base64(url, http_session)

            all_urls = image_urls + [event_logo_url]
            fetched: list[str | None] = list(await asyncio.gather(*[_fetch(u) for u in all_urls]))
            item_images: list[str | None] = fetched[:-1]
            event_logo_data: str | None = fetched[-1]

        # 3. Build card data + QR codes (sync, placed in executor)
        page_size = request.label_size.css_dimensions
        template = self._jinja.get_template("reports/bid_cards.html")

        card_data = []
        for item, image_data in zip(items, item_images, strict=True):
            qr_url = f"{donor_pwa_base}/events/{event_slug}/auction-items/{item.id}"
            raw_value = float(item.donor_value) if item.donor_value is not None else None
            card_data.append(
                {
                    "bid_number": item.bid_number,
                    "title": item.title or "",
                    "auction_type": item.auction_type or "silent",
                    "starting_bid": float(item.starting_bid)
                    if item.starting_bid is not None
                    else None,
                    "bid_increment": float(item.bid_increment),
                    # Suppress value when it is exactly 0
                    "donor_value": raw_value if (raw_value is not None and raw_value > 0) else None,
                    "donated_by": getattr(item, "donated_by", None),
                    "image_data": image_data,
                    "qr_url": qr_url,
                }
            )

        opts = {
            "show_image": request.show_image,
            "show_value": request.show_value,
            "show_qr": request.show_qr,
            "show_starting_bid": request.show_starting_bid,
            "show_min_bid_increment": request.show_min_bid_increment,
        }

        def _build_pdf() -> bytes:
            # QR codes are generated sync inside executor
            for card in card_data:
                if opts["show_qr"]:
                    card["qr_b64"] = _generate_qr_base64(str(card["qr_url"]))
                else:
                    card["qr_b64"] = None
            html = template.render(
                cards=card_data,
                page_size=page_size,
                event_logo=event_logo_data,
                opts=opts,
                fundrbolt_logo_b64=get_fundrbolt_logo_b64(),
            )
            from weasyprint import HTML  # noqa: PLC0415

            buf = io.BytesIO()
            HTML(string=html).write_pdf(buf)
            return buf.getvalue()

        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(None, _build_pdf)
        except Exception as exc:
            logger.error("Bid card PDF generation failed for event %s", event_id, exc_info=True)
            raise RuntimeError(f"PDF generation failed: {exc}") from exc
