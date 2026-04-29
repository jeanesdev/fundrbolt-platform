"""Service for NPO-level (donate-now page) donation processing."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.donate_now_config import DonateNowPageConfig
from app.models.event import Event, EventStatus
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

        # Temporary donate-now stub: until payment setup exists, treat the
        # donation as captured even when there is no vaulted profile/gateway.
        from app.models.payment_profile import PaymentProfile

        profile_stmt = select(PaymentProfile).where(
            PaymentProfile.user_id == donor.id,
            PaymentProfile.npo_id == npo.id,
            PaymentProfile.is_default.is_(True),
        )
        profile_result = await db.execute(profile_stmt)
        profile = profile_result.scalar_one_or_none()

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
            payment_profile_id=profile.id if profile is not None else None,
            status=NpoDonationStatus.PENDING,
            idempotency_key=request.idempotency_key,
        )
        db.add(donation)
        await db.flush()

        # Auto-assign next upcoming event for this NPO
        now_utc = datetime.now(UTC)
        upcoming_stmt = (
            select(Event)
            .where(
                Event.npo_id == npo.id,
                Event.event_datetime >= now_utc,
                Event.status == EventStatus.ACTIVE,
            )
            .order_by(Event.event_datetime.asc())
            .limit(1)
        )
        upcoming_result = await db.execute(upcoming_stmt)
        upcoming_event = upcoming_result.scalar_one_or_none()
        if upcoming_event is not None:
            donation.event_id = upcoming_event.id
        await db.flush()

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
            donor_name = (request.donor_name or "").strip() or (
                f"{donor.first_name} {donor.last_name}".strip() or None
            )
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
