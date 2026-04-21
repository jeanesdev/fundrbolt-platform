"""Service for NPO-level (donate-now page) donation processing."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.donate_now_config import DonateNowPageConfig
from app.models.npo import NPO
from app.models.npo_donation import NpoDonation, NpoDonationStatus, RecurrenceStatus
from app.models.support_wall_entry import SupportWallEntry
from app.models.user import User
from app.schemas.npo_donation import DonationCreateRequest
from app.schemas.support_wall_entry import SupportWallEntryPublic, SupportWallPage


class NpoDonationService:
    """Service for creating and querying NPO-level donations."""

    @staticmethod
    async def create_donation(
        *,
        db: AsyncSession,
        npo: NPO,
        config: DonateNowPageConfig,
        donor: User,
        request: DonationCreateRequest,
    ) -> NpoDonation:
        """Create a donation record and charge the donor's vaulted payment profile.

        Raises:
            HTTPException 409: If the idempotency_key has already been used.
            HTTPException 402: If the donor has no payment profile.
            HTTPException 422: If payment is declined.
        """
        # Idempotency check
        if request.idempotency_key:
            existing_stmt = select(NpoDonation).where(
                NpoDonation.idempotency_key == request.idempotency_key
            )
            existing_result = await db.execute(existing_stmt)
            existing = existing_result.scalar_one_or_none()
            if existing is not None:
                if existing.status == NpoDonationStatus.PENDING:
                    return existing
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Idempotency key already used for a completed donation.",
                )

        # Check donor has a payment profile for this NPO
        from app.models.payment_profile import PaymentProfile

        profile_stmt = select(PaymentProfile).where(
            PaymentProfile.user_id == donor.id,
            PaymentProfile.npo_id == npo.id,
            PaymentProfile.is_default.is_(True),
        )
        profile_result = await db.execute(profile_stmt)
        profile = profile_result.scalar_one_or_none()

        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="No payment profile on file. Please add a payment method first.",
            )

        # Compute fees
        fee_pct = config.processing_fee_pct or Decimal("0")
        processing_fee_cents = 0
        if request.covers_processing_fee:
            processing_fee_cents = int(
                (Decimal(request.amount_cents) * fee_pct).to_integral_value(ROUND_HALF_UP)
            )
        total_charged_cents = request.amount_cents + processing_fee_cents

        # Determine recurrence fields
        recurrence_status: RecurrenceStatus | None = None
        next_charge_date: date | None = None
        if request.is_monthly:
            recurrence_status = RecurrenceStatus.ACTIVE
            today = datetime.now(UTC).date()
            rs = request.recurrence_start or today
            next_charge_date = rs

        # Create donation record (pending)
        donation = NpoDonation(
            config_id=config.id,
            npo_id=npo.id,
            donor_user_id=donor.id,
            amount_cents=request.amount_cents,
            covers_processing_fee=request.covers_processing_fee,
            processing_fee_cents=processing_fee_cents,
            total_charged_cents=total_charged_cents,
            is_monthly=request.is_monthly,
            recurrence_start=request.recurrence_start,
            recurrence_end=request.recurrence_end,
            recurrence_status=recurrence_status,
            next_charge_date=next_charge_date,
            payment_profile_id=profile.id,
            status=NpoDonationStatus.PENDING,
            idempotency_key=request.idempotency_key,
        )
        db.add(donation)
        await db.flush()

        # Charge via gateway
        from app.core.payment_deps import get_npo_payment_gateway

        try:
            gateway = await get_npo_payment_gateway(str(npo.id), db)
            result = await gateway.charge_profile(
                transaction_id=donation.id,
                gateway_profile_id=profile.gateway_profile_id,
                amount=Decimal(total_charged_cents) / 100,
                idempotency_key=request.idempotency_key,
                metadata={"donation_id": str(donation.id), "npo_id": str(npo.id)},
            )
        except Exception:
            donation.status = NpoDonationStatus.DECLINED
            await db.flush()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Payment could not be processed. Please try again.",
            )

        if result.status != "approved":
            donation.status = NpoDonationStatus.DECLINED
            await db.flush()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=result.decline_reason or "Payment declined.",
            )

        donation.status = NpoDonationStatus.CAPTURED
        if request.is_monthly and next_charge_date is not None:
            # Advance by one calendar month
            m = next_charge_date.month + 1
            y = next_charge_date.year + (m - 1) // 12
            m = ((m - 1) % 12) + 1
            import calendar

            last_day = calendar.monthrange(y, m)[1]
            donation.next_charge_date = next_charge_date.replace(
                year=y, month=m, day=min(next_charge_date.day, last_day)
            )

        # Create support wall entry if requested
        if not request.is_anonymous or request.support_wall_message:
            donor_name = f"{donor.first_name} {donor.last_name}".strip() or None
            entry = SupportWallEntry(
                donation_id=donation.id,
                npo_id=npo.id,
                display_name=None if request.is_anonymous else donor_name,
                is_anonymous=request.is_anonymous,
                show_amount=request.show_amount,
                message=request.support_wall_message,
                is_hidden=False,
            )
            db.add(entry)

        await db.flush()
        return donation

    @staticmethod
    async def get_public_support_wall(
        *,
        db: AsyncSession,
        npo_id: uuid.UUID,
        page: int,
        page_size: int,
    ) -> SupportWallPage:
        """Return paginated visible support wall entries."""
        from sqlalchemy.orm import selectinload

        offset = (page - 1) * page_size

        count_stmt = (
            select(func.count())
            .select_from(SupportWallEntry)
            .where(
                SupportWallEntry.npo_id == npo_id,
                SupportWallEntry.is_hidden.is_(False),
            )
        )
        total_result = await db.execute(count_stmt)
        total: int = total_result.scalar_one()

        stmt = (
            select(SupportWallEntry)
            .where(
                SupportWallEntry.npo_id == npo_id,
                SupportWallEntry.is_hidden.is_(False),
            )
            .options(selectinload(SupportWallEntry.donation))
            .order_by(SupportWallEntry.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await db.execute(stmt)
        entries = list(result.scalars().all())

        items = [
            SupportWallEntryPublic(
                id=e.id,
                display_name=e.display_name,
                is_anonymous=e.is_anonymous,
                show_amount=e.show_amount,
                amount_cents=e.donation.amount_cents if e.show_amount and e.donation else None,
                tier_label=None,
                message=e.message,
                created_at=e.created_at,
            )
            for e in entries
        ]
        pages = (total + page_size - 1) // page_size if page_size > 0 else 0

        return SupportWallPage(
            entries=items,
            total=total,
            page=page,
            per_page=page_size,
            pages=pages,
        )
