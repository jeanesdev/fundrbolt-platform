"""Celery tasks for processing recurring monthly donations."""

from __future__ import annotations

import asyncio
import logging

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.recurring_donation_tasks.process_monthly_donations")  # type: ignore[misc]
def process_monthly_donations() -> dict[str, int]:
    """Daily task: charge all active recurring donations due today."""
    return asyncio.get_event_loop().run_until_complete(_async_process_monthly())


async def _async_process_monthly() -> dict[str, int]:
    from app.core.database import AsyncSessionLocal
    from app.services.recurring_donation_service import RecurringDonationService

    success = 0
    failed = 0

    async with AsyncSessionLocal() as db:
        donations = await RecurringDonationService.get_due_donations(db)
        for donation in donations:
            ok = await RecurringDonationService.charge_donation(db, str(donation.id))
            if ok:
                success += 1
            else:
                failed += 1
        await db.commit()

    logger.info("Recurring donations processed: %d success, %d failed", success, failed)
    return {"success": success, "failed": failed}
