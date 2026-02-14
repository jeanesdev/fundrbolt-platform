"""Check-in service for event registration check-in operations."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest
from app.models.user import User


class CheckInService:
    """Service for managing event check-in operations."""

    @staticmethod
    async def get_registration_by_confirmation(
        db: AsyncSession, confirmation_code: str
    ) -> EventRegistration | None:
        """Lookup registration by confirmation code (registration ID).

        Args:
            db: Database session
            confirmation_code: Registration ID as string

        Returns:
            EventRegistration if found, None otherwise
        """
        try:
            registration_id = UUID(confirmation_code)
        except ValueError:
            return None

        query = (
            select(EventRegistration)
            .options(
                joinedload(EventRegistration.user),
                joinedload(EventRegistration.event),
                joinedload(EventRegistration.guests),
                joinedload(EventRegistration.meal_selections),
            )
            .where(EventRegistration.id == registration_id)
        )

        result = await db.execute(query)
        return result.scalars().first()

    @staticmethod
    async def get_registration_by_email(
        db: AsyncSession, email: str, event_id: UUID | None = None
    ) -> list[EventRegistration]:
        """Lookup registrations by user email.

        Args:
            db: Database session
            email: User's email address
            event_id: Optional event ID to filter by

        Returns:
            List of matching registrations
        """
        query = (
            select(EventRegistration)
            .join(User, EventRegistration.user_id == User.id)
            .options(
                joinedload(EventRegistration.user),
                joinedload(EventRegistration.event),
                joinedload(EventRegistration.guests),
                joinedload(EventRegistration.meal_selections),
            )
            .where(User.email == email)
        )

        if event_id:
            query = query.where(EventRegistration.event_id == event_id)

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def check_in_registration(
        db: AsyncSession, registration_id: UUID
    ) -> EventRegistration | None:
        """Mark a registration as checked in.

        Args:
            db: Database session
            registration_id: Registration UUID

        Returns:
            Updated EventRegistration if found, None otherwise
        """
        query = (
            select(EventRegistration)
            .options(
                joinedload(EventRegistration.user),
                joinedload(EventRegistration.event),
                joinedload(EventRegistration.guests),
                joinedload(EventRegistration.meal_selections),
            )
            .where(EventRegistration.id == registration_id)
        )

        result = await db.execute(query)
        registration = result.scalars().first()

        if not registration:
            return None

        primary_guest = next(
            (guest for guest in registration.guests if guest.is_primary),
            None,
        )
        if not primary_guest:
            return None

        if not primary_guest.check_in_time:
            primary_guest.check_in_time = datetime.now(UTC)
            primary_guest.checked_in = True
            await db.commit()
            await db.refresh(registration)

        return registration

    @staticmethod
    async def check_in_guest(db: AsyncSession, guest_id: UUID) -> RegistrationGuest | None:
        """Mark a guest as checked in.

        Args:
            db: Database session
            guest_id: Guest UUID

        Returns:
            Updated RegistrationGuest if found, None otherwise
        """
        query = (
            select(RegistrationGuest)
            .options(
                joinedload(RegistrationGuest.registration),
                joinedload(RegistrationGuest.user),
            )
            .where(RegistrationGuest.id == guest_id)
        )

        result = await db.execute(query)
        guest = result.scalars().first()

        if not guest:
            return None

        if not guest.check_in_time:
            guest.check_in_time = datetime.now(UTC)
            guest.checked_in = True
            await db.commit()
            await db.refresh(guest)

        return guest

    @staticmethod
    async def undo_check_in_registration(
        db: AsyncSession, registration_id: UUID
    ) -> EventRegistration | None:
        """Undo check-in for a registration.

        Args:
            db: Database session
            registration_id: Registration UUID

        Returns:
            Updated EventRegistration if found, None otherwise
        """
        query = (
            select(EventRegistration)
            .options(
                joinedload(EventRegistration.user),
                joinedload(EventRegistration.event),
                joinedload(EventRegistration.guests),
            )
            .where(EventRegistration.id == registration_id)
        )

        result = await db.execute(query)
        registration = result.scalars().first()

        if not registration:
            return None

        primary_guest = next(
            (guest for guest in registration.guests if guest.is_primary),
            None,
        )
        if not primary_guest:
            return None

        primary_guest.check_in_time = None
        primary_guest.checked_in = False
        await db.commit()
        await db.refresh(registration)

        return registration

    @staticmethod
    async def undo_check_in_guest(db: AsyncSession, guest_id: UUID) -> RegistrationGuest | None:
        """Undo check-in for a guest.

        Args:
            db: Database session
            guest_id: Guest UUID

        Returns:
            Updated RegistrationGuest if found, None otherwise
        """
        query = (
            select(RegistrationGuest)
            .options(
                joinedload(RegistrationGuest.registration),
            )
            .where(RegistrationGuest.id == guest_id)
        )

        result = await db.execute(query)
        guest = result.scalars().first()

        if not guest:
            return None

        guest.check_in_time = None
        guest.checked_in = False
        await db.commit()
        await db.refresh(guest)

        return guest
