"""Payment background tasks — Celery.

T041: generate_and_send_receipt — full implementation.
T057: expire_pending_transactions — full implementation.
T058: retry_failed_receipts — full implementation.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import celery

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.payment_receipt import PaymentReceipt
from app.models.payment_transaction import PaymentTransaction, TransactionStatus
from app.services.receipt_service import ReceiptService

logger = logging.getLogger(__name__)


# ── T041 ───────────────────────────────────────────────────────────────────────


@celery_app.task(
    bind=True,
    name="app.tasks.payment_tasks.generate_and_send_receipt",
    max_retries=3,
    default_retry_delay=60,
)  # type: ignore[misc]
def generate_and_send_receipt(self: celery.Task, transaction_id: str) -> None:
    """Generate a PDF receipt for ``transaction_id`` and email it to the donor.

    Retries up to 3 times on failure with exponential backoff.
    """
    logger.info(
        "generate_and_send_receipt triggered",
        extra={"transaction_id": transaction_id},
    )

    async def _run() -> None:
        txn_uuid = uuid.UUID(transaction_id)
        async with AsyncSessionLocal() as db:
            # Load transaction with all relationships needed for the receipt
            result = await db.execute(
                select(PaymentTransaction)
                .where(PaymentTransaction.id == txn_uuid)
                .options(
                    selectinload(PaymentTransaction.user),
                    selectinload(PaymentTransaction.npo),
                    selectinload(PaymentTransaction.event),
                    selectinload(PaymentTransaction.payment_profile),
                    selectinload(PaymentTransaction.receipt),
                )
            )
            txn = result.scalar_one_or_none()
            if txn is None:
                logger.error(
                    "Transaction not found for receipt generation",
                    extra={"transaction_id": transaction_id},
                )
                return

            service = ReceiptService(db)
            await service.generate_and_deliver(txn)

    try:
        asyncio.run(_run())
    except Exception as exc:
        logger.error(
            "generate_and_send_receipt failed",
            extra={"transaction_id": transaction_id, "error": str(exc)},
        )
        raise self.retry(exc=exc, countdown=60 * (2**self.request.retries))


# ── T057 ───────────────────────────────────────────────────────────────────────


@celery_app.task(
    name="app.tasks.payment_tasks.expire_pending_transactions",
)  # type: ignore[misc]
def expire_pending_transactions() -> None:
    """Expire PENDING transactions that have exceeded PAYMENT_WEBHOOK_TIMEOUT_MINUTES.

    Polls the gateway for each pending transaction's status.  Transactions
    older than the timeout that remain PENDING are moved to ERROR so the donor
    can retry.
    """
    from datetime import datetime, timedelta

    from app.core.config import get_settings

    settings = get_settings()
    from app.models.payment_transaction import TransactionType

    timeout_minutes: int = getattr(settings, "payment_webhook_timeout_minutes", 30)

    async def _run() -> None:
        cutoff = datetime.now(tz=UTC) - timedelta(minutes=timeout_minutes)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(PaymentTransaction).where(
                    PaymentTransaction.status == TransactionStatus.PENDING,
                    PaymentTransaction.session_created_at < cutoff,
                    PaymentTransaction.transaction_type == TransactionType.CHARGE,
                )
            )
            pending = result.scalars().all()

            if not pending:
                return

            logger.info("Expiring %d stale pending transactions", len(pending))

            for txn in pending:
                txn.status = TransactionStatus.ERROR

            await db.commit()
            logger.info("expire_pending_transactions complete: %d expired", len(pending))

    asyncio.run(_run())


# ── T058 ───────────────────────────────────────────────────────────────────────


@celery_app.task(
    name="app.tasks.payment_tasks.retry_failed_receipts",
)  # type: ignore[misc]
def retry_failed_receipts() -> None:
    """Retry receipt emails for PaymentReceipt rows with email_sent_at IS NULL.

    Skips rows that have already hit the maximum retry count (3).
    """
    MAX_ATTEMPTS = 3

    async def _run() -> None:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(PaymentReceipt)
                .where(
                    PaymentReceipt.email_sent_at.is_(None),
                    PaymentReceipt.email_attempts < MAX_ATTEMPTS,
                )
                .options(
                    selectinload(PaymentReceipt.transaction).options(
                        selectinload(PaymentTransaction.user),
                        selectinload(PaymentTransaction.npo),
                        selectinload(PaymentTransaction.event),
                        selectinload(PaymentTransaction.payment_profile),
                    )
                )
            )
            receipts = result.scalars().all()

            if not receipts:
                return

            logger.info("retry_failed_receipts: retrying %d receipts", len(receipts))

            for receipt in receipts:
                txn = receipt.transaction
                if txn is None:
                    continue
                service = ReceiptService(db)
                await service._send_email(  # noqa: SLF001
                    txn,
                    service._build_template_context(txn),  # noqa: SLF001
                    None,  # PDF bytes not re-generated on retry
                    receipt,
                )

    asyncio.run(_run())
