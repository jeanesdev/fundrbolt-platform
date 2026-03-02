"""Business logic for event-scoped donation labels."""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.donation_label import DonationLabel


class DonationLabelService:
    """Service for donation label management."""

    @staticmethod
    def normalize_name(name: str) -> str:
        """Normalize label names for uniqueness checks."""
        normalized = " ".join(name.strip().split())
        if not normalized:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Label name is required",
            )
        return normalized

    @staticmethod
    async def list_labels(
        db: AsyncSession,
        event_id: uuid.UUID,
        include_inactive: bool = False,
    ) -> list[DonationLabel]:
        """List labels for an event."""
        stmt = select(DonationLabel).where(DonationLabel.event_id == event_id)
        if not include_inactive:
            stmt = stmt.where(DonationLabel.is_active.is_(True))
        stmt = stmt.order_by(DonationLabel.name.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_label(
        db: AsyncSession,
        event_id: uuid.UUID,
        label_id: uuid.UUID,
    ) -> DonationLabel:
        """Get a label scoped to an event."""
        stmt = select(DonationLabel).where(
            DonationLabel.id == label_id,
            DonationLabel.event_id == event_id,
        )
        result = await db.execute(stmt)
        label = result.scalar_one_or_none()
        if not label:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Donation label not found",
            )
        return label

    @staticmethod
    async def ensure_unique_name(
        db: AsyncSession,
        event_id: uuid.UUID,
        name: str,
        exclude_label_id: uuid.UUID | None = None,
    ) -> None:
        """Ensure case-insensitive uniqueness of a label name within an event."""
        stmt = select(DonationLabel.id).where(
            DonationLabel.event_id == event_id,
            func.lower(DonationLabel.name) == name.lower(),
        )
        if exclude_label_id is not None:
            stmt = stmt.where(DonationLabel.id != exclude_label_id)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Donation label '{name}' already exists for this event",
            )

    @staticmethod
    async def create_label(
        db: AsyncSession,
        event_id: uuid.UUID,
        name: str,
    ) -> DonationLabel:
        """Create a donation label for an event."""
        normalized = DonationLabelService.normalize_name(name)
        await DonationLabelService.ensure_unique_name(db, event_id, normalized)
        label = DonationLabel(event_id=event_id, name=normalized, is_active=True)
        db.add(label)
        await db.commit()
        await db.refresh(label)
        return label

    @staticmethod
    async def update_label(
        db: AsyncSession,
        event_id: uuid.UUID,
        label_id: uuid.UUID,
        name: str | None,
        is_active: bool | None,
    ) -> DonationLabel:
        """Update a donation label in an event scope."""
        label = await DonationLabelService.get_label(db, event_id, label_id)

        if name is not None:
            normalized = DonationLabelService.normalize_name(name)
            await DonationLabelService.ensure_unique_name(
                db,
                event_id,
                normalized,
                exclude_label_id=label_id,
            )
            label.name = normalized

        if is_active is not None:
            label.is_active = is_active
            if not is_active:
                label.retired_at = datetime.now(UTC)
            else:
                label.retired_at = None

        await db.commit()
        await db.refresh(label)
        return label

    @staticmethod
    async def retire_label(
        db: AsyncSession,
        event_id: uuid.UUID,
        label_id: uuid.UUID,
    ) -> DonationLabel:
        """Retire a donation label (soft disable)."""
        return await DonationLabelService.update_label(
            db,
            event_id,
            label_id,
            name=None,
            is_active=False,
        )
