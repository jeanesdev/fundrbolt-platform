"""CheckoutReceiptService — generate PDF receipts for checkout sessions.

Generates a PDF receipt from a CheckoutSession, uploads to Azure Blob Storage
(or falls back to a data URL), and updates session.receipt_url.
"""

from __future__ import annotations

import asyncio
import io
import logging
import pathlib
import uuid
from datetime import UTC, datetime
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.checkout_session import CheckoutSession
from app.services.email_service import get_email_service

_settings = get_settings()
logger = logging.getLogger(__name__)

_TEMPLATES_DIR = pathlib.Path(__file__).parent.parent / "templates"
_RECEIPTS_CONTAINER = getattr(_settings, "receipts_blob_container", "payment-receipts")


class CheckoutReceiptService:
    """Generate, store, and deliver checkout session receipts."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._jinja = Environment(
            loader=FileSystemLoader(str(_TEMPLATES_DIR)),
            autoescape=select_autoescape(["html", "j2"]),
        )

    async def generate_receipt(self, session: CheckoutSession) -> str:
        """Generate a PDF receipt for a checkout session.

        Attempts to:
        1. Render Jinja2 HTML template.
        2. Convert to PDF via WeasyPrint (run in executor).
        3. Upload to Azure Blob Storage (or fall back to placeholder URL).
        4. Update session.receipt_url.

        Returns the receipt URL.
        """
        ctx = await self._build_context(session)
        html = self._render_html(ctx)

        pdf_bytes: bytes | None = None
        try:
            pdf_bytes = await self._generate_pdf(html)
        except Exception:
            logger.warning(
                "Checkout PDF generation failed; storing placeholder",
                extra={"session_id": str(session.id)},
                exc_info=True,
            )

        receipt_url: str | None = None
        if pdf_bytes:
            try:
                receipt_url = await self._upload_to_blob(pdf_bytes, session.id)
            except Exception:
                logger.warning(
                    "Blob upload failed for checkout receipt",
                    extra={"session_id": str(session.id)},
                    exc_info=True,
                )

        if receipt_url is None:
            receipt_url = f"/api/v1/payments/events/{session.event_id}/checkout/receipt/pdf"

        session.receipt_url = receipt_url
        return receipt_url

    async def send_receipt_email(self, session: CheckoutSession) -> None:
        """Send receipt email with PDF attachment to the donor after successful checkout."""
        ctx = await self._build_context(session)
        donor_email = ctx.get("donor_email", "")
        if not donor_email:
            return

        # Generate the PDF so we can attach it
        pdf_bytes: bytes | None = None
        try:
            html = self._render_html(ctx)
            pdf_bytes = await self._generate_pdf(html)
        except Exception:
            logger.warning(
                "PDF generation failed for checkout receipt email; sending without attachment",
                extra={"session_id": str(session.id)},
                exc_info=True,
            )

        email_svc = get_email_service()
        try:
            await email_svc.send_receipt_email(
                to_email=donor_email,
                donor_name=str(ctx.get("donor_name", "Donor")),
                event_name=str(ctx.get("event_name", "the event")),
                transaction_id=str(ctx.get("receipt_id", str(session.id)[:8])),
                amount_total=float(ctx.get("total_dollars", 0)),
                pdf_bytes=pdf_bytes,
            )
        except Exception:
            logger.warning(
                "Checkout receipt email failed",
                extra={"session_id": str(session.id)},
                exc_info=True,
            )

    # ── Public helpers (also used by streaming receipt endpoint) ─────────────

    async def build_context(self, session: CheckoutSession) -> dict[str, Any]:
        """Assemble template context from the checkout session and its items."""
        return await self._build_context(session)

    def render_html(self, ctx: dict[str, Any]) -> str:
        """Render the checkout receipt Jinja2 template."""
        return self._render_html(ctx)

    async def generate_pdf(self, html: str) -> bytes:
        """Render HTML to PDF via WeasyPrint."""
        return await self._generate_pdf(html)

    # ── Private helpers ────────────────────────────────────────────────────────

    async def _build_context(self, session: CheckoutSession) -> dict[str, Any]:
        """Assemble template context from the checkout session and its items."""
        from sqlalchemy import select

        from app.models.event import Event
        from app.models.user import User

        event: Any = None
        event_result = await self._db.execute(select(Event).where(Event.id == session.event_id))
        event = event_result.scalar_one_or_none()

        user: Any = None
        user_result = await self._db.execute(select(User).where(User.id == session.user_id))
        user = user_result.scalar_one_or_none()

        event_name = event.name if event else "Fundraising Event"
        event_date = ""
        if event and hasattr(event, "event_datetime") and event.event_datetime:
            event_date = event.event_datetime.strftime("%B %d, %Y")

        npo_logo_url: str | None = None
        if event and hasattr(event, "logo_url"):
            npo_logo_url = event.logo_url

        donor_name = user.full_name if user else "Donor"
        donor_email = user.email if user else ""

        active_items = [i for i in (session.items or []) if i.deleted_at is None]
        line_items = [
            {
                "name": item.name,
                "amount": item.effective_amount_cents / 100,
            }
            for item in active_items
        ]

        subtotal_dollars = session.subtotal_cents / 100
        auctioneer_tip_dollars = session.auctioneer_tip_cents / 100
        platform_tip_dollars = session.platform_tip_cents / 100
        processing_fee_dollars = session.processing_fee_cents / 100
        total_dollars = session.total_cents / 100

        completed_ts = session.completed_at or datetime.now(UTC)
        receipt_id = str(session.id)[:8].upper()
        receipt_date = completed_ts.strftime("%B %d, %Y at %I:%M %p UTC")

        return {
            "event_name": event_name,
            "event_date": event_date,
            "npo_logo_url": npo_logo_url,
            "donor_name": donor_name,
            "donor_email": donor_email,
            "line_items": line_items,
            "subtotal_dollars": f"{subtotal_dollars:.2f}",
            "auctioneer_tip_dollars": f"{auctioneer_tip_dollars:.2f}",
            "platform_tip_dollars": f"{platform_tip_dollars:.2f}",
            "processing_fee_dollars": f"{processing_fee_dollars:.2f}",
            "total_dollars": f"{total_dollars:.2f}",
            "receipt_id": receipt_id,
            "receipt_date": receipt_date,
        }

    def _render_html(self, ctx: dict[str, Any]) -> str:
        """Render the checkout receipt Jinja2 template."""
        template = self._jinja.get_template("receipt.html")
        return template.render(**ctx)

    async def _generate_pdf(self, html: str) -> bytes:
        """Render HTML to PDF via WeasyPrint in a thread pool executor."""
        loop = asyncio.get_event_loop()

        def _run() -> bytes:
            from weasyprint import HTML  # noqa: PLC0415

            buf = io.BytesIO()
            HTML(string=html).write_pdf(buf)
            return buf.getvalue()

        return await loop.run_in_executor(None, _run)

    async def _upload_to_blob(self, pdf_bytes: bytes, session_id: uuid.UUID) -> str:
        """Upload checkout receipt PDF to Azure Blob Storage."""
        conn_str = getattr(_settings, "azure_storage_connection_string", None)
        if not conn_str:
            raise RuntimeError("Azure storage connection string not configured")

        blob_name = f"checkout-receipts/{session_id}.pdf"
        loop = asyncio.get_event_loop()

        def _upload() -> str:
            from azure.storage.blob import BlobServiceClient  # noqa: PLC0415

            client = BlobServiceClient.from_connection_string(conn_str)
            container = client.get_container_client(_RECEIPTS_CONTAINER)
            try:
                container.create_container(public_access="blob")
            except Exception:
                pass
            blob_client = container.get_blob_client(blob_name)
            blob_client.upload_blob(pdf_bytes, overwrite=True)
            account = client.account_name
            return f"https://{account}.blob.core.windows.net/{_RECEIPTS_CONTAINER}/{blob_name}"

        return await loop.run_in_executor(None, _upload)
