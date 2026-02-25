"""Business logic for event donation management."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.donation import Donation, DonationStatus
from app.models.donation_label import DonationLabel
from app.models.donation_label_assignment import DonationLabelAssignment
from app.models.user import User
from app.schemas.donation import DonationListFilters


class DonationService:
    """Service for donation lifecycle and attribution management."""

    @staticmethod
    async def _validate_donor_exists(db: AsyncSession, donor_user_id: uuid.UUID) -> None:
        stmt = select(User.id).where(User.id == donor_user_id)
        result = await db.execute(stmt)
        donor = result.scalar_one_or_none()
        if donor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Donor user not found",
            )

    @staticmethod
    async def _validate_label_ids(
        db: AsyncSession,
        event_id: uuid.UUID,
        label_ids: list[uuid.UUID],
    ) -> list[DonationLabel]:
        if not label_ids:
            return []

        stmt = select(DonationLabel).where(
            DonationLabel.id.in_(label_ids),
            DonationLabel.event_id == event_id,
        )
        result = await db.execute(stmt)
        labels = list(result.scalars().all())

        if len(labels) != len(set(label_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more labels are invalid for this event",
            )

        inactive = [label for label in labels if not label.is_active]
        if inactive:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive labels cannot be assigned",
            )

        return labels

    @staticmethod
    async def _replace_label_assignments(
        db: AsyncSession,
        donation: Donation,
        label_ids: list[uuid.UUID],
    ) -> None:
        await DonationService._validate_label_ids(db, donation.event_id, label_ids)

        delete_stmt = select(DonationLabelAssignment).where(
            DonationLabelAssignment.donation_id == donation.id
        )
        existing = await db.execute(delete_stmt)
        for assignment in existing.scalars().all():
            await db.delete(assignment)
        await db.flush()

        for label_id in label_ids:
            db.add(DonationLabelAssignment(donation_id=donation.id, label_id=label_id))

    @staticmethod
    async def _to_response_payload(db: AsyncSession, donation: Donation) -> Donation:
        stmt = (
            select(Donation)
            .where(Donation.id == donation.id)
            .execution_options(populate_existing=True)
            .options(selectinload(Donation.label_assignments))
        )
        result = await db.execute(stmt)
        return result.scalar_one()

    @staticmethod
    async def create_donation(
        db: AsyncSession,
        event_id: uuid.UUID,
        donor_user_id: uuid.UUID,
        amount: Decimal,
        is_paddle_raise: bool,
        label_ids: list[uuid.UUID],
    ) -> Donation:
        """Create a donation and optional label assignments."""
        await DonationService._validate_donor_exists(db, donor_user_id)

        donation = Donation(
            event_id=event_id,
            donor_user_id=donor_user_id,
            amount=amount,
            is_paddle_raise=is_paddle_raise,
            status=DonationStatus.ACTIVE,
        )
        db.add(donation)
        await db.flush()

        await DonationService._replace_label_assignments(db, donation, label_ids)

        await db.commit()
        return await DonationService._to_response_payload(db, donation)

    @staticmethod
    async def get_donation(
        db: AsyncSession,
        event_id: uuid.UUID,
        donation_id: uuid.UUID,
    ) -> Donation:
        """Get donation by ID in event scope."""
        stmt = (
            select(Donation)
            .where(Donation.id == donation_id, Donation.event_id == event_id)
            .options(selectinload(Donation.label_assignments))
        )
        result = await db.execute(stmt)
        donation = result.scalar_one_or_none()
        if not donation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Donation not found",
            )
        return donation

    @staticmethod
    async def list_donations(
        db: AsyncSession,
        event_id: uuid.UUID,
        filters: DonationListFilters,
    ) -> list[Donation]:
        """List donations with optional filter criteria."""
        stmt = (
            select(Donation)
            .where(Donation.event_id == event_id)
            .options(selectinload(Donation.label_assignments))
            .order_by(Donation.created_at.desc())
        )

        if not filters.include_voided:
            stmt = stmt.where(Donation.status == DonationStatus.ACTIVE)
        if filters.donor_user_id is not None:
            stmt = stmt.where(Donation.donor_user_id == filters.donor_user_id)
        if filters.is_paddle_raise is not None:
            stmt = stmt.where(Donation.is_paddle_raise == filters.is_paddle_raise)

        if filters.label_ids:
            label_count = len(set(filters.label_ids))
            label_subquery = (
                select(DonationLabelAssignment.donation_id)
                .where(DonationLabelAssignment.label_id.in_(filters.label_ids))
                .group_by(DonationLabelAssignment.donation_id)
            )

            if filters.label_match_mode == "all":
                label_subquery = label_subquery.having(
                    func.count(func.distinct(DonationLabelAssignment.label_id)) == label_count
                )

            stmt = stmt.where(Donation.id.in_(label_subquery))

        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def update_donation(
        db: AsyncSession,
        event_id: uuid.UUID,
        donation_id: uuid.UUID,
        amount: Decimal | None,
        is_paddle_raise: bool | None,
        label_ids: list[uuid.UUID] | None,
    ) -> Donation:
        """Update mutable fields of a donation."""
        donation = await DonationService.get_donation(db, event_id, donation_id)

        if amount is not None:
            donation.amount = amount
        if is_paddle_raise is not None:
            donation.is_paddle_raise = is_paddle_raise
        if label_ids is not None:
            await DonationService._replace_label_assignments(db, donation, label_ids)

        await db.commit()
        return await DonationService._to_response_payload(db, donation)

    @staticmethod
    async def void_donation(
        db: AsyncSession,
        event_id: uuid.UUID,
        donation_id: uuid.UUID,
    ) -> Donation:
        """Void a donation (soft delete)."""
        donation = await DonationService.get_donation(db, event_id, donation_id)
        donation.status = DonationStatus.VOIDED
        donation.voided_at = datetime.now(UTC)
        await db.commit()
        return await DonationService._to_response_payload(db, donation)
