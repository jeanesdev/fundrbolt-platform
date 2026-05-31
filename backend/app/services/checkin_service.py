"""Check-in service for event registration check-in operations."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.notification import NotificationPriorityEnum, NotificationTypeEnum
from app.models.registration_guest import RegistrationGuest
from app.models.user import User
from app.services.bidder_number_service import BidderNumberService
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
    async def get_next_available_table(db: AsyncSession, event_id: UUID) -> int | None:
        """Find the next available table for an event.

        Returns the first table with available capacity, or None if no tables configured.
        """
        from app.models.event import Event
        from app.models.event_registration import EventRegistration as ER
        from app.models.event_table import EventTable

        event_result = await db.execute(select(Event).where(Event.id == event_id))
        event = event_result.scalar_one_or_none()
        default_capacity = (event.max_guests_per_table if event else None) or 10

        stmt = (
            select(EventTable.table_number, EventTable.custom_capacity)
            .where(EventTable.event_id == event_id)
            .order_by(EventTable.table_number)
        )
        result = await db.execute(stmt)
        tables = result.all()

        if not tables:
            return None

        occupancy_stmt = (
            select(
                RegistrationGuest.table_number,
                func.count(RegistrationGuest.id).label("count"),
            )
            .join(ER)
            .where(
                ER.event_id == event_id,
                RegistrationGuest.table_number.isnot(None),
                RegistrationGuest.status == RegistrationStatus.CONFIRMED.value,
            )
            .group_by(RegistrationGuest.table_number)
        )
        occupancy_result = await db.execute(occupancy_stmt)
        occupancy_map: dict[int, int] = {}
        for row in occupancy_result.all():
            tbl = row[0]
            cnt = row[1]
            if tbl is not None and cnt is not None:
                occupancy_map[int(tbl)] = int(cnt)

        for table_number, custom_capacity in tables:
            capacity = custom_capacity if custom_capacity is not None else default_capacity
            current_occupancy = occupancy_map.get(int(table_number), 0)
            if capacity - current_occupancy >= 1:
                return int(table_number)

        return None

    @staticmethod
    async def check_in_registration(
        db: AsyncSession,
        registration_id: UUID,
        bidder_number: int | None = None,
        table_number: int | None = None,
    ) -> EventRegistration | None:
        """Mark a registration as checked in.

        Assigns a bidder number and table number if not already set.

        Args:
            db: Database session
            registration_id: Registration UUID
            bidder_number: Specific bidder number to assign (auto-assigned if None)
            table_number: Specific table number to assign (auto-assigned if None)

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

        # Assign bidder number if not already set
        if primary_guest.bidder_number is None:
            if bidder_number is not None:
                await BidderNumberService.validate_bidder_number_uniqueness(
                    db, registration.event_id, bidder_number, exclude_guest_id=primary_guest.id
                )
                primary_guest.bidder_number = bidder_number
                primary_guest.bidder_number_assigned_at = datetime.now(UTC)
            else:
                try:
                    assigned = await BidderNumberService.assign_bidder_number(
                        db, registration.event_id, primary_guest.id
                    )
                    logger.info(
                        f"Auto-assigned bidder number {assigned} to guest {primary_guest.id} on check-in"
                    )
                    # assign_bidder_number already committed; refresh to get new value
                    await db.refresh(primary_guest)
                except ValueError as exc:
                    logger.warning(f"Could not auto-assign bidder number on check-in: {exc}")

        # Assign table number if not already set
        if primary_guest.table_number is None:
            if table_number is not None:
                primary_guest.table_number = table_number
            else:
                next_table = await CheckInService.get_next_available_table(
                    db, registration.event_id
                )
                if next_table is not None:
                    primary_guest.table_number = next_table
                    logger.info(
                        f"Auto-assigned table {next_table} to guest {primary_guest.id} on check-in"
                    )

        if not primary_guest.check_in_time:
            primary_guest.check_in_time = datetime.now(UTC)
            primary_guest.checked_in = True

        await db.commit()

        refreshed_result = await db.execute(query)
        registration = refreshed_result.scalars().unique().first()
        if not registration:
            return None

        primary_guest = next(
            (guest for guest in registration.guests if guest.is_primary),
            None,
        )

        if primary_guest and primary_guest.check_in_time:
            await CheckInService._send_welcome_notification(db, registration)

        return registration

    @staticmethod
    async def check_in_guest(
        db: AsyncSession,
        guest_id: UUID,
        bidder_number: int | None = None,
        table_number: int | None = None,
    ) -> RegistrationGuest | None:
        """Mark a guest as checked in.

        Assigns a bidder number and table number if not already set.

        Args:
            db: Database session
            guest_id: Guest UUID
            bidder_number: Specific bidder number to assign (auto-assigned if None)
            table_number: Specific table number to assign (auto-assigned if None)

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

        # Assign bidder number if not already set
        if guest.bidder_number is None:
            if bidder_number is not None:
                if guest.registration:
                    await BidderNumberService.validate_bidder_number_uniqueness(
                        db, guest.registration.event_id, bidder_number, exclude_guest_id=guest.id
                    )
                guest.bidder_number = bidder_number
                guest.bidder_number_assigned_at = datetime.now(UTC)
            elif guest.registration:
                try:
                    assigned = await BidderNumberService.assign_bidder_number(
                        db, guest.registration.event_id, guest.id
                    )
                    logger.info(
                        f"Auto-assigned bidder number {assigned} to guest {guest.id} on check-in"
                    )
                    await db.refresh(guest)
                except ValueError as exc:
                    logger.warning(f"Could not auto-assign bidder number on guest check-in: {exc}")

        # Assign table number if not already set
        if guest.table_number is None and guest.registration:
            if table_number is not None:
                guest.table_number = table_number
            else:
                next_table = await CheckInService.get_next_available_table(
                    db, guest.registration.event_id
                )
                if next_table is not None:
                    guest.table_number = next_table
                    logger.info(f"Auto-assigned table {next_table} to guest {guest.id} on check-in")

        if not guest.check_in_time:
            guest.check_in_time = datetime.now(UTC)
            guest.checked_in = True

        await db.commit()

        refreshed_result = await db.execute(query)
        guest = refreshed_result.scalars().unique().first()
        if not guest:
            return None

        if guest.check_in_time and guest.user_id and guest.registration:
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
