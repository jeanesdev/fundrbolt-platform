"""Check-in service for event registration check-in operations."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.event_registration import EventRegistration
from app.models.notification import NotificationPriorityEnum, NotificationTypeEnum
from app.models.registration_guest import RegistrationGuest
from app.models.user import User
from app.services.notification_service import NotificationService
from app.websocket.notification_ws import sio

logger = logging.getLogger(__name__)


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

            # T069: Send welcome notification after check-in
            await CheckInService._send_welcome_notification(db, registration)

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

            # T069: Send welcome notification after guest check-in
            if guest.user_id and guest.registration:
                await CheckInService._send_welcome_notification(
                    db, guest.registration, user_id_override=guest.user_id
                )

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

    @staticmethod
    async def _send_welcome_notification(
        db: AsyncSession,
        registration: EventRegistration,
        user_id_override: UUID | None = None,
    ) -> None:
        """T069: Send welcome notification after check-in."""
        try:
            user_id = user_id_override or registration.user_id
            event = registration.event
            if not event:
                return

            event_name = getattr(event, "name", "the event")
            event_slug = getattr(event, "slug", str(registration.event_id))

            # Build body with table assignment info
            body_parts = [f"Welcome to {event_name}! We're glad you're here."]

            # Try to get table number from primary guest
            primary_guest = next(
                (g for g in (registration.guests or []) if g.is_primary),
                None,
            )
            if primary_guest and getattr(primary_guest, "table_number", None):
                body_parts.append(f"Your table: #{primary_guest.table_number}")

            await NotificationService.create_notification(
                db=db,
                event_id=registration.event_id,
                user_id=user_id,
                notification_type=NotificationTypeEnum.WELCOME,
                priority=NotificationPriorityEnum.LOW,
                title=f"Welcome to {event_name}! 🎉",
                body=" ".join(body_parts),
                data={
                    "deep_link": f"/events/{event_slug}",
                },
                sio=sio,
            )
            await db.commit()
        except Exception:
            logger.warning(
                "Failed to send welcome notification",
                extra={
                    "registration_id": str(registration.id),
                    "event_id": str(registration.event_id),
                },
            )
