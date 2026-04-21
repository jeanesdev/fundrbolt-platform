"""Service for processing recurring monthly donations."""

from __future__ import annotations

import calendar
import logging
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.npo_donation import NpoDonation, NpoDonationStatus, RecurrenceStatus

logger = logging.getLogger(__name__)


class RecurringDonationService:
    """Processes monthly recurring donations that are due for charging."""

    @staticmethod
    async def get_due_donations(db: AsyncSession) -> list[NpoDonation]:
        """Return all active recurring donations whose next_charge_date is today or past."""
        today = datetime.now(UTC).date()
        stmt = select(NpoDonation).where(
            NpoDonation.is_monthly.is_(True),
            NpoDonation.recurrence_status == RecurrenceStatus.ACTIVE,
            NpoDonation.next_charge_date <= today,
            NpoDonation.status == NpoDonationStatus.CAPTURED,
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def charge_donation(db: AsyncSession, donation_id: str) -> bool:
        """Attempt to charge one recurring donation. Returns True on success."""
        import uuid

        from sqlalchemy.orm import selectinload

        from app.core.payment_deps import get_npo_payment_gateway
        from app.models.payment_profile import PaymentProfile

        stmt = (
            select(NpoDonation)
            .where(NpoDonation.id == uuid.UUID(donation_id))
            .options(selectinload(NpoDonation.npo))
        )
        result = await db.execute(stmt)
        donation = result.scalar_one_or_none()

        if donation is None:
            logger.warning("Recurring donation %s not found", donation_id)
            return False

        if donation.npo is None:
            logger.error("Recurring donation %s has no NPO", donation_id)
            return False

        # Load payment profile
        profile_stmt = select(PaymentProfile).where(
            PaymentProfile.id == donation.payment_profile_id
        )
        profile_result = await db.execute(profile_stmt)
        profile = profile_result.scalar_one_or_none()
        if profile is None or not profile.gateway_profile_id:
            logger.error("No valid payment profile for recurring donation %s", donation_id)
            donation.recurrence_status = RecurrenceStatus.CANCELLED
            await db.flush()
            return False

        idempotency_key = f"monthly-{donation.id}-{donation.next_charge_date}"

        try:
            gateway = await get_npo_payment_gateway(str(donation.npo_id), db)
            charge_result = await gateway.charge_profile(
                transaction_id=donation.id,
                gateway_profile_id=profile.gateway_profile_id,
                amount=Decimal(donation.total_charged_cents) / 100,
                idempotency_key=idempotency_key,
                metadata={"recurring_donation_id": donation_id},
            )
        except Exception as exc:
            logger.exception("Gateway error for recurring donation %s: %s", donation_id, exc)
            return False

        today = datetime.now(UTC).date()

        if charge_result.status == "approved":
            # Advance next_charge_date by one month
            m = today.month + 1
            y = today.year + (m - 1) // 12
            m = ((m - 1) % 12) + 1
            last_day = calendar.monthrange(y, m)[1]
            donation.next_charge_date = today.replace(year=y, month=m, day=min(today.day, last_day))
            # Cancel if past recurrence_end
            if donation.recurrence_end and donation.next_charge_date > donation.recurrence_end:
                donation.recurrence_status = RecurrenceStatus.COMPLETED
            await db.flush()
            logger.info("Recurring donation %s charged successfully", donation_id)
            return True
        else:
            logger.warning(
                "Recurring donation %s declined: %s", donation_id, charge_result.decline_reason
            )
            return False
