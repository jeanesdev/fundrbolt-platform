"""ReceiptService — T040 (US8 Phase 7).

Responsibilities:
  1. Render the receipt Jinja2 HTML template.
  2. Generate a PDF via WeasyPrint (run in executor to avoid blocking the event loop).
  3. Upload the PDF to Azure Blob Storage.
  4. Send a receipt email (with PDF attachment) via EmailService.
  5. Create/upsert a ``PaymentReceipt`` row with tracking fields.

Usage (from Celery task):
    service = ReceiptService(db_session)
    await service.generate_and_deliver(transaction)
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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.payment_receipt import PaymentReceipt
from app.models.payment_transaction import PaymentTransaction
from app.services.email_service import EmailSendError, get_email_service

_settings = get_settings()

logger = logging.getLogger(__name__)

# Path to the Jinja2 templates directory
_TEMPLATES_DIR = pathlib.Path(__file__).parent.parent / "templates" / "receipts"

# Azure Blob container name for PDF receipts
_RECEIPTS_CONTAINER = getattr(_settings, "receipts_blob_container", "payment-receipts")


class ReceiptServiceError(Exception):
    """Base error for ReceiptService failures."""


# ── ReceiptService ─────────────────────────────────────────────────────────────


class ReceiptService:
    """Generate, store, and deliver payment receipts."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._jinja = Environment(
            loader=FileSystemLoader(str(_TEMPLATES_DIR)),
            autoescape=select_autoescape(["html", "j2"]),
        )

    # ── Public API ─────────────────────────────────────────────────────────────

    async def generate_and_deliver(self, transaction: PaymentTransaction) -> PaymentReceipt:
        """Full pipeline: render → PDF → upload → email → upsert row.

        Steps:
        1. Build template context from ORM relationships.
        2. Render HTML → PDF bytes (WeasyPrint).
        3. Upload PDF to Azure Blob Storage.
        4. Send receipt email with attachment.
        5. Upsert PaymentReceipt row.

        Args:
            transaction: A PaymentTransaction with `user`, `npo`, `event`,
                         and `payment_profile` eagerly loaded.

        Returns:
            The upserted PaymentReceipt row (committed).
        """
        ctx = self._build_template_context(transaction)

        # Step 1: Render HTML
        html = self._render_html(ctx)

        # Step 2: Generate PDF in thread pool
        try:
            pdf_bytes = await self._generate_pdf(html)
        except Exception as exc:
            logger.error(
                "PDF generation failed",
                extra={"transaction_id": str(transaction.id), "error": str(exc)},
            )
            pdf_bytes = None

        # Step 3: Upload to blob (optional — skip if blob not configured)
        pdf_url: str | None = None
        if pdf_bytes:
            try:
                pdf_url = await self._upload_to_blob(pdf_bytes, transaction.id)
            except Exception as exc:
                logger.error(
                    "Blob upload failed for receipt",
                    extra={"transaction_id": str(transaction.id), "error": str(exc)},
                )

        # Step 4: Persist receipt row first so we have a row even if email fails
        receipt = await self._upsert_receipt_row(
            transaction=transaction,
            pdf_url=pdf_url,
            pdf_generated_at=datetime.now(tz=UTC) if pdf_bytes else None,
        )

        # Step 5: Send email
        await self._send_email(transaction, ctx, pdf_bytes, receipt)

        return receipt

    # ── HTML rendering ─────────────────────────────────────────────────────────

    def _build_template_context(self, txn: PaymentTransaction) -> dict[str, Any]:
        """Assemble Jinja2 template variables from ORM relationships."""
        # Relationships might be lazily loaded — access them directly.
        user = txn.user
        npo = txn.npo
        event = txn.event
        profile = txn.payment_profile

        donor_name = user.full_name if user else "Donor"
        donor_email = user.email if user else ""
        npo_name = npo.name if npo else "Your Organisation"
        npo_email = npo.email if npo else None

        # Event details
        event_name = event.name if event else "Fundraising Event"
        event_date = ""
        if event and hasattr(event, "event_datetime") and event.event_datetime:
            event_date = event.event_datetime.strftime("%B %d, %Y")

        # NPO logo: use event-level logo_url if available
        npo_logo_url = event.logo_url if event and event.logo_url else None

        # Card info
        card_last4: str | None = None
        card_brand: str | None = None
        if profile:
            card_last4 = profile.card_last4
            card_brand = profile.card_brand

        # Line items from JSONB — stored as list of {type, label, amount} dicts
        raw_items = txn.line_items or {}
        if isinstance(raw_items, dict) and "items" in raw_items:
            line_items: list[dict[str, Any]] = raw_items["items"]
        elif isinstance(raw_items, list):
            line_items = raw_items
        else:
            line_items = []

        total = float(txn.amount)

        ts = txn.created_at
        if ts and hasattr(ts, "strftime"):
            transaction_timestamp = ts.strftime("%B %d, %Y at %I:%M %p UTC")
        else:
            transaction_timestamp = str(ts) if ts else ""

        return {
            "donor_name": donor_name,
            "donor_email": donor_email,
            "npo_name": npo_name,
            "npo_email": npo_email,
            "npo_logo_url": npo_logo_url,
            "event_name": event_name,
            "event_date": event_date,
            "transaction_id": str(txn.id)[:8].upper(),
            "transaction_timestamp": transaction_timestamp,
            "card_last4": card_last4,
            "card_brand": card_brand or "",
            "line_items": line_items,
            "total": total,
        }

    def _render_html(self, ctx: dict[str, Any]) -> str:
        """Render the Jinja2 receipt template to HTML string."""
        template = self._jinja.get_template("receipt.html.j2")
        return template.render(**ctx)

    # ── PDF generation ─────────────────────────────────────────────────────────

    async def _generate_pdf(self, html: str) -> bytes:
        """Render HTML to PDF bytes via WeasyPrint in a thread pool executor.

        WeasyPrint is CPU-bound and not async-safe; running it in an executor
        keeps the event loop unblocked (per research.md R-006).
        """
        loop = asyncio.get_event_loop()

        def _run() -> bytes:
            # Import here so tests that don't need WeasyPrint can skip it
            from weasyprint import HTML

            buf = io.BytesIO()
            HTML(string=html).write_pdf(buf)
            return buf.getvalue()

        return await loop.run_in_executor(None, _run)

    # ── Blob storage ───────────────────────────────────────────────────────────

    async def _upload_to_blob(self, pdf_bytes: bytes, transaction_id: uuid.UUID) -> str:
        """Upload PDF to Azure Blob Storage and return the public URL.

        Raises:
            ReceiptServiceError: If upload fails or storage isn't configured.
        """
        conn_str = _settings.azure_storage_connection_string
        if not conn_str:
            raise ReceiptServiceError("Azure storage connection string not configured")

        blob_name = f"receipts/{transaction_id}.pdf"

        loop = asyncio.get_event_loop()

        def _upload() -> str:
            from azure.storage.blob import BlobServiceClient

            client = BlobServiceClient.from_connection_string(conn_str)
            container = client.get_container_client(_RECEIPTS_CONTAINER)

            # Create container if it doesn't exist (idempotent)
            try:
                container.create_container(public_access="blob")
            except Exception:
                pass  # Already exists

            blob_client = container.get_blob_client(blob_name)
            blob_client.upload_blob(
                pdf_bytes,
                overwrite=True,
                content_settings=None,
            )

            account = client.account_name
            return f"https://{account}.blob.core.windows.net/{_RECEIPTS_CONTAINER}/{blob_name}"

        return await loop.run_in_executor(None, _upload)

    # ── Email ──────────────────────────────────────────────────────────────────

    async def _send_email(
        self,
        txn: PaymentTransaction,
        ctx: dict[str, Any],
        pdf_bytes: bytes | None,
        receipt: PaymentReceipt,
    ) -> None:
        """Send receipt email and update delivery tracking on the receipt row."""
        email_svc = get_email_service()
        try:
            await email_svc.send_receipt_email(
                to_email=ctx["donor_email"],
                donor_name=ctx["donor_name"],
                event_name=ctx["event_name"],
                transaction_id=str(txn.id),
                amount_total=ctx["total"],
                pdf_bytes=pdf_bytes,
            )
            receipt.email_sent_at = datetime.now(tz=UTC)
            receipt.email_attempts = (receipt.email_attempts or 0) + 1
            await self._db.commit()
        except EmailSendError as exc:
            logger.warning(
                "Receipt email failed",
                extra={
                    "transaction_id": str(txn.id),
                    "error": str(exc),
                    "attempt": (receipt.email_attempts or 0) + 1,
                },
            )
            receipt.email_attempts = (receipt.email_attempts or 0) + 1
            await self._db.commit()

    # ── DB upsert ──────────────────────────────────────────────────────────────

    async def _upsert_receipt_row(
        self,
        transaction: PaymentTransaction,
        pdf_url: str | None,
        pdf_generated_at: datetime | None,
    ) -> PaymentReceipt:
        """Create or update the PaymentReceipt row for this transaction."""
        result = await self._db.execute(
            select(PaymentReceipt).where(PaymentReceipt.transaction_id == transaction.id)
        )
        receipt: PaymentReceipt | None = result.scalar_one_or_none()

        user = transaction.user
        donor_email = user.email if user else ""

        if receipt is None:
            receipt = PaymentReceipt(
                transaction_id=transaction.id,
                pdf_url=pdf_url,
                pdf_generated_at=pdf_generated_at,
                email_address=donor_email,
                email_sent_at=None,
                email_attempts=0,
            )
            self._db.add(receipt)
        else:
            if pdf_url:
                receipt.pdf_url = pdf_url
                receipt.pdf_generated_at = pdf_generated_at

        await self._db.commit()
        await self._db.refresh(receipt)
        return receipt
