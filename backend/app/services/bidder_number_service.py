"""Bidder number assignment and management service."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest


class BidderNumberService:
    """Service for managing bidder number assignments."""

    @staticmethod
    async def assign_bidder_number(
        db: AsyncSession,
        event_id: UUID,
        guest_id: UUID,
    ) -> int:
        """
        Automatically assign next available bidder number to a guest.

        Uses sequential assignment with gap filling:
        - Finds first available number in 100-999 range
        - Reuses numbers from canceled registrations

        Args:
            db: Database session
            event_id: Event UUID
            guest_id: Guest UUID

        Returns:
            int: Assigned bidder number

        Raises:
            ValueError: If no bidder numbers available (900 max reached)
            ValueError: If guest already has bidder number
        """
        # Check if guest already has bidder number
        guest_query = select(RegistrationGuest).where(RegistrationGuest.id == guest_id)
        result = await db.execute(guest_query)
        guest = result.scalar_one()

        if guest.bidder_number is not None:
            raise ValueError(f"Guest {guest_id} already has bidder number {guest.bidder_number}")

        # Get all used bidder numbers for this event
        used_numbers_query = (
            select(RegistrationGuest.bidder_number)
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.bidder_number.isnot(None),
            )
        )
        result = await db.execute(used_numbers_query)
        used_numbers = {row[0] for row in result.fetchall()}

        # Find first available number (100-999)
        for num in range(100, 1000):
            if num not in used_numbers:
                # Assign bidder number
                guest.bidder_number = num
                guest.bidder_number_assigned_at = datetime.now(UTC)
                await db.commit()
                await db.refresh(guest)
                return num

        # No available numbers
        raise ValueError(
            f"All 900 bidder numbers are in use for event {event_id}. "
            "Cannot assign new bidder number."
        )

    @staticmethod
    async def validate_bidder_number_uniqueness(
        db: AsyncSession,
        event_id: UUID,
        bidder_number: int,
        exclude_guest_id: UUID | None = None,
    ) -> None:
        """
        Validate that bidder number is unique within event.

        Args:
            db: Database session
            event_id: Event UUID
            bidder_number: Bidder number to validate
            exclude_guest_id: Guest ID to exclude from check (for updates)

        Raises:
            ValueError: If bidder number is already in use
        """
        query = (
            select(RegistrationGuest.id)
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.bidder_number == bidder_number,
            )
        )

        if exclude_guest_id:
            query = query.where(RegistrationGuest.id != exclude_guest_id)

        result = await db.execute(query)
        existing_guest = result.scalar_one_or_none()

        if existing_guest:
            raise ValueError(
                f"Bidder number {bidder_number} is already assigned to another guest in this event"
            )

    @staticmethod
    async def get_available_bidder_numbers(
        db: AsyncSession,
        event_id: UUID,
        limit: int = 10,
    ) -> list[int]:
        """
        Get list of available bidder numbers for an event.

        Args:
            db: Database session
            event_id: Event UUID
            limit: Maximum number of available numbers to return

        Returns:
            list[int]: List of available bidder numbers (100-999)
        """
        # Get all used bidder numbers for this event
        query = (
            select(RegistrationGuest.bidder_number)
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.bidder_number.isnot(None),
            )
        )
        result = await db.execute(query)
        used_numbers = {row[0] for row in result.fetchall()}

        # Find available numbers
        available = []
        for num in range(100, 1000):
            if num not in used_numbers:
                available.append(num)
                if len(available) >= limit:
                    break

        return available

    @staticmethod
    async def reassign_bidder_number(
        db: AsyncSession,
        event_id: UUID,
        guest_id: UUID,
        new_bidder_number: int,
    ) -> dict[str, UUID | int | None]:
        """
        Reassign bidder number to a guest with automatic conflict resolution.

        If the new bidder number is already in use by another guest, that guest
        will be automatically reassigned to the next available number.

        Args:
            db: Database session
            event_id: Event UUID
            guest_id: Guest ID to reassign
            new_bidder_number: New bidder number to assign

        Returns:
            dict with keys:
                - guest_id: UUID of guest being reassigned
                - bidder_number: New bidder number
                - previous_holder_id: UUID of guest who previously had this number (if any)
                - previous_holder_new_number: New bidder number for previous holder (if any)

        Raises:
            ValueError: If new bidder number is out of range (100-999)
        """
        # Validate bidder number range
        if not (100 <= new_bidder_number <= 999):
            raise ValueError(f"Bidder number must be between 100 and 999, got {new_bidder_number}")

        # Get the guest being reassigned
        guest_query = select(RegistrationGuest).where(RegistrationGuest.id == guest_id)
        result = await db.execute(guest_query)
        guest = result.scalar_one()

        # Check if number is already in use by another guest
        conflict_query = (
            select(RegistrationGuest)
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.bidder_number == new_bidder_number,
                RegistrationGuest.id != guest_id,
            )
        )
        result = await db.execute(conflict_query)
        conflicting_guest = result.scalar_one_or_none()

        response: dict[str, UUID | int | None] = {
            "guest_id": guest_id,
            "bidder_number": new_bidder_number,
            "previous_holder_id": None,
            "previous_holder_new_number": None,
        }

        # If conflict exists, reassign previous holder to new number
        if conflicting_guest:
            response["previous_holder_id"] = conflicting_guest.id

            # Clear the conflicting guest's number first
            conflicting_guest.bidder_number = None
            conflicting_guest.bidder_number_assigned_at = None
            await db.flush()

            # Find next available number for previous holder
            new_number_for_previous = await BidderNumberService.assign_bidder_number(
                db, event_id, conflicting_guest.id
            )
            response["previous_holder_new_number"] = new_number_for_previous

        # Assign new number to target guest
        guest.bidder_number = new_bidder_number
        if guest.bidder_number_assigned_at is None:
            guest.bidder_number_assigned_at = datetime.now(UTC)

        await db.commit()
        await db.refresh(guest)

        return response

    @staticmethod
    async def handle_registration_cancellation(
        db: AsyncSession,
        guest_id: UUID,
    ) -> None:
        """
        Release bidder number when a registration is canceled.

        Args:
            db: Database session
            guest_id: Guest UUID whose registration was canceled
        """
        query = select(RegistrationGuest).where(RegistrationGuest.id == guest_id)
        result = await db.execute(query)
        guest = result.scalar_one()

        # Release bidder number (set to NULL)
        guest.bidder_number = None
        guest.bidder_number_assigned_at = None

        await db.commit()

    @staticmethod
    async def get_bidder_count(
        db: AsyncSession,
        event_id: UUID,
    ) -> int:
        """
        Get count of assigned bidder numbers for an event.

        Args:
            db: Database session
            event_id: Event UUID

        Returns:
            int: Number of assigned bidder numbers
        """
        query = (
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.bidder_number.isnot(None),
            )
        )
        result = await db.execute(query)
        return result.scalar_one()
