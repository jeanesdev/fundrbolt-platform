"""Shared base helpers for quick-entry services."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest


@dataclass
class BidderLookupResult:
    """Lookup projection used by quick-entry flows."""

    bidder_number: int
    donor_user_id: UUID | None
    donor_display_name: str | None
    table_number: int | None


class QuickEntryServiceBase:
    """Common validation and lookup logic for quick-entry service operations."""

    @staticmethod
    def validate_whole_dollar_amount(amount: int) -> None:
        """Validate quick-entry amount uses positive whole-dollar values."""
        if amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Amount must be greater than zero",
            )

    @staticmethod
    async def lookup_bidder(
        db: AsyncSession,
        event_id: UUID,
        bidder_number: int,
    ) -> BidderLookupResult:
        """Resolve bidder-to-donor mapping for an event by bidder number."""
        stmt = select(RegistrationGuest).where(
            and_(
                RegistrationGuest.registration_id == EventRegistration.id,
                EventRegistration.event_id == event_id,
                RegistrationGuest.bidder_number == bidder_number,
            )
        )
        result = await db.execute(stmt)
        guest = result.scalar_one_or_none()

        if guest is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bidder number is not assigned to a donor for this event",
            )

        return BidderLookupResult(
            bidder_number=bidder_number,
            donor_user_id=guest.user_id,
            donor_display_name=guest.name,
            table_number=guest.table_number,
        )

    @staticmethod
    def log_quick_entry_action(
        db: AsyncSession,
        *,
        actor_user_id: UUID,
        action: str,
        resource_type: str,
        resource_id: UUID,
        event_id: UUID,
        metadata: dict[str, object] | None = None,
    ) -> None:
        """Create an immutable quick-entry audit-log row."""
        db.add(
            AuditLog(
                user_id=actor_user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                ip_address="unknown",
                user_agent="quick-entry",
                event_metadata={
                    "event_id": str(event_id),
                    "timestamp": datetime.now(UTC).isoformat(),
                    **(metadata or {}),
                },
            )
        )
