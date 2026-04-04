"""Paddle raise quick-entry service logic."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.donation_label import DonationLabel
from app.models.event_registration import EventRegistration
from app.models.quick_entry_donation import QuickEntryDonation
from app.models.quick_entry_donation_label import QuickEntryDonationLabelLink
from app.models.registration_guest import RegistrationGuest
from app.services.quick_entry.service_base import QuickEntryServiceBase


class PaddleRaiseService(QuickEntryServiceBase):
    """Service layer for paddle raise quick-entry actions."""

    @classmethod
    async def create_donation(
        cls,
        db: AsyncSession,
        *,
        event_id: UUID,
        amount: int,
        bidder_number: int,
        is_monthly: bool = False,
        label_ids: list[UUID],
        custom_label: str | None,
        entered_by_user_id: UUID,
    ) -> tuple[QuickEntryDonation, str | None, list[str]]:
        """Create paddle raise donation and optional label links."""
        cls.validate_whole_dollar_amount(amount)
        bidder = await cls.lookup_bidder_optional(
            db=db, event_id=event_id, bidder_number=bidder_number
        )

        labels = await cls._validate_predefined_labels(
            db=db, event_id=event_id, label_ids=label_ids
        )
        custom_label_value = cls._normalize_custom_label(custom_label)

        donation = QuickEntryDonation(
            event_id=event_id,
            amount=amount,
            bidder_number=bidder_number,
            is_monthly=is_monthly,
            donor_user_id=bidder.donor_user_id if bidder is not None else None,
            entered_at=datetime.now(UTC),
            entered_by_user_id=entered_by_user_id,
        )
        db.add(donation)
        await db.flush()

        for label in labels:
            db.add(
                QuickEntryDonationLabelLink(
                    donation_id=donation.id,
                    label_id=label.id,
                    custom_label_text=None,
                )
            )

        if custom_label_value is not None:
            db.add(
                QuickEntryDonationLabelLink(
                    donation_id=donation.id,
                    label_id=None,
                    custom_label_text=custom_label_value,
                )
            )

        cls.log_quick_entry_action(
            db,
            actor_user_id=entered_by_user_id,
            action="quick_entry_paddle_donation_created",
            resource_type="quick_entry_paddle_donation",
            resource_id=donation.id,
            event_id=event_id,
            metadata={"amount": amount, "bidder_number": bidder_number},
        )
        await db.commit()
        await db.refresh(donation)

        label_output = [label.name for label in labels]
        if custom_label_value is not None:
            label_output.append(custom_label_value)

        return donation, bidder.donor_display_name if bidder is not None else None, label_output

    @classmethod
    async def list_donations(
        cls,
        db: AsyncSession,
        *,
        event_id: UUID,
    ) -> list[tuple[QuickEntryDonation, str | None, list[str]]]:
        """List all paddle raise donations for an event, newest first."""
        stmt = (
            select(QuickEntryDonation)
            .where(QuickEntryDonation.event_id == event_id)
            .options(
                selectinload(QuickEntryDonation.label_links).selectinload(
                    QuickEntryDonationLabelLink.label
                )
            )
            .order_by(QuickEntryDonation.entered_at.desc())
        )
        result = await db.execute(stmt)
        donations = list(result.scalars().all())

        # Bulk-fetch donor names by bidder number for this event
        bidder_numbers = list({d.bidder_number for d in donations})
        guests: dict[int, str | None] = {}
        if bidder_numbers:
            guest_stmt = (
                select(RegistrationGuest.bidder_number, RegistrationGuest.name)
                .join(EventRegistration, EventRegistration.id == RegistrationGuest.registration_id)
                .where(
                    EventRegistration.event_id == event_id,
                    RegistrationGuest.bidder_number.in_(bidder_numbers),
                )
            )
            guest_result = await db.execute(guest_stmt)
            guests = {int(row[0]): row[1] for row in guest_result.all()}

        output = []
        for donation in donations:
            donor_name = guests.get(donation.bidder_number)
            labels: list[str] = []
            for link in donation.label_links:
                if link.label is not None:
                    labels.append(link.label.name)
                elif link.custom_label_text is not None:
                    labels.append(link.custom_label_text)
            output.append((donation, donor_name, labels))

        return output

    @staticmethod
    async def list_available_labels(
        db: AsyncSession,
        *,
        event_id: UUID,
    ) -> list[DonationLabel]:
        """List active donation labels for paddle raise mode."""
        del event_id
        stmt = (
            select(DonationLabel)
            .where(DonationLabel.is_active.is_(True))
            .order_by(DonationLabel.name.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_paddle_summary(
        db: AsyncSession,
        *,
        event_id: UUID,
    ) -> tuple[int, int, int, float, list[tuple[int, int, bool]], datetime]:
        """Compute paddle raise totals, by-level counts, and participation metrics."""
        totals_stmt = select(
            func.coalesce(func.sum(QuickEntryDonation.amount), 0),
            func.count(QuickEntryDonation.id),
            func.count(func.distinct(QuickEntryDonation.bidder_number)),
            func.max(QuickEntryDonation.entered_at),
        ).where(QuickEntryDonation.event_id == event_id)
        totals_result = await db.execute(totals_stmt)
        total_pledged, donation_count, unique_donor_count, updated_at = totals_result.one()

        denominator_stmt = (
            select(func.count(func.distinct(RegistrationGuest.bidder_number)))
            .join(EventRegistration, EventRegistration.id == RegistrationGuest.registration_id)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.bidder_number.is_not(None),
            )
        )
        denominator_result = await db.execute(denominator_stmt)
        registered_bidder_count = int(denominator_result.scalar_one() or 0)

        participation_percent = (
            (float(unique_donor_count) / float(registered_bidder_count) * 100.0)
            if registered_bidder_count > 0
            else 0.0
        )

        by_level_stmt = (
            select(
                QuickEntryDonation.amount,
                QuickEntryDonation.is_monthly,
                func.count(QuickEntryDonation.id),
            )
            .where(QuickEntryDonation.event_id == event_id)
            .group_by(QuickEntryDonation.amount, QuickEntryDonation.is_monthly)
            .order_by(QuickEntryDonation.amount.desc(), QuickEntryDonation.is_monthly.asc())
        )
        by_level_result = await db.execute(by_level_stmt)
        by_level = [
            (int(amount), int(count), bool(is_monthly))
            for amount, is_monthly, count in by_level_result.all()
        ]

        return (
            int(total_pledged or 0),
            int(donation_count or 0),
            int(unique_donor_count or 0),
            participation_percent,
            by_level,
            updated_at or datetime.now(UTC),
        )

    @staticmethod
    async def _validate_predefined_labels(
        db: AsyncSession,
        *,
        event_id: UUID,
        label_ids: list[UUID],
    ) -> list[DonationLabel]:
        del event_id
        if not label_ids:
            return []

        stmt = select(DonationLabel).where(
            DonationLabel.id.in_(label_ids),
            DonationLabel.is_active.is_(True),
        )
        result = await db.execute(stmt)
        labels = list(result.scalars().all())
        if len(labels) != len(set(label_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more labels are invalid or inactive",
            )
        return labels

    @staticmethod
    def _normalize_custom_label(custom_label: str | None) -> str | None:
        if custom_label is None:
            return None

        normalized = " ".join(custom_label.strip().split())
        if not normalized:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Custom label cannot be blank",
            )
        if len(normalized) > 80:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Custom label must be 80 characters or fewer",
            )
        return normalized
