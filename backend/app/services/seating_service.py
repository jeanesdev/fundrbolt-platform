"""Seating assignment and table management service."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.registration_guest import RegistrationGuest


class SeatingService:
    """Service for managing table seating assignments."""

    @staticmethod
    async def validate_table_assignment(
        db: AsyncSession,
        event_id: UUID,
        table_number: int,
        guest_count: int = 1,
    ) -> None:
        """
        Validate that table assignment is possible.

        Checks:
        - Table number is within configured range
        - Table has enough capacity for guests

        Args:
            db: Database session
            event_id: Event UUID
            table_number: Target table number
            guest_count: Number of guests to assign (default 1)

        Raises:
            ValueError: If validation fails
        """
        # Get event seating configuration
        event_query = select(Event).where(Event.id == event_id)
        result = await db.execute(event_query)
        event = result.scalar_one()

        # Check if seating is configured
        if event.table_count is None or event.max_guests_per_table is None:
            raise ValueError(f"Seating is not configured for event {event_id}")

        # Check if table number is valid
        if not (1 <= table_number <= event.table_count):
            raise ValueError(
                f"Table number {table_number} is out of range. "
                f"Event has {event.table_count} tables."
            )

        # Check current table occupancy
        current_occupancy = await SeatingService.get_table_occupancy(db, event_id, table_number)

        # Check if table has capacity
        available_capacity = event.max_guests_per_table - current_occupancy
        if guest_count > available_capacity:
            raise ValueError(
                f"Table {table_number} is at or near capacity. "
                f"Available: {available_capacity}, Requested: {guest_count}"
            )

    @staticmethod
    async def get_table_occupancy(
        db: AsyncSession,
        event_id: UUID,
        table_number: int,
    ) -> int:
        """
        Get current occupancy count for a table.

        Args:
            db: Database session
            event_id: Event UUID
            table_number: Table number

        Returns:
            int: Current number of guests assigned to table
        """
        query = (
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.table_number == table_number,
            )
        )
        result = await db.execute(query)
        return result.scalar_one()

    @staticmethod
    async def get_guests_at_table(
        db: AsyncSession,
        event_id: UUID,
        table_number: int,
    ) -> list[RegistrationGuest]:
        """
        Get all guests assigned to a specific table.

        Args:
            db: Database session
            event_id: Event UUID
            table_number: Table number

        Returns:
            list[RegistrationGuest]: List of guests at the table
        """
        query = (
            select(RegistrationGuest)
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.table_number == table_number,
            )
            .options(
                selectinload(RegistrationGuest.registration).selectinload(EventRegistration.user)
            )
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def assign_guest_to_table(
        db: AsyncSession,
        event_id: UUID,
        guest_id: UUID,
        table_number: int,
    ) -> RegistrationGuest:
        """
        Assign a guest to a table.

        Args:
            db: Database session
            event_id: Event UUID
            guest_id: Guest UUID
            table_number: Target table number

        Returns:
            RegistrationGuest: Updated guest record

        Raises:
            ValueError: If validation fails
        """
        # Validate table assignment
        await SeatingService.validate_table_assignment(db, event_id, table_number)

        # Get guest
        query = select(RegistrationGuest).where(RegistrationGuest.id == guest_id)
        result = await db.execute(query)
        guest = result.scalar_one()

        # Assign table
        guest.table_number = table_number
        await db.commit()
        await db.refresh(guest)

        return guest

    @staticmethod
    async def remove_guest_from_table(
        db: AsyncSession,
        guest_id: UUID,
    ) -> RegistrationGuest:
        """
        Remove a guest from their assigned table.

        Args:
            db: Database session
            guest_id: Guest UUID

        Returns:
            RegistrationGuest: Updated guest record
        """
        query = select(RegistrationGuest).where(RegistrationGuest.id == guest_id)
        result = await db.execute(query)
        guest = result.scalar_one()

        # Remove table assignment
        guest.table_number = None
        await db.commit()
        await db.refresh(guest)

        return guest

    @staticmethod
    async def get_unassigned_guests(
        db: AsyncSession,
        event_id: UUID,
    ) -> list[RegistrationGuest]:
        """
        Get all guests without table assignments for an event.

        Args:
            db: Database session
            event_id: Event UUID

        Returns:
            list[RegistrationGuest]: List of unassigned guests
        """
        query = (
            select(RegistrationGuest)
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                EventRegistration.status == RegistrationStatus.CONFIRMED,
                RegistrationGuest.table_number.is_(None),
            )
            .options(selectinload(RegistrationGuest.registration))
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def validate_seating_config(
        table_count: int | None,
        max_guests_per_table: int | None,
    ) -> None:
        """
        Validate seating configuration values.

        Both fields must be set together (both NULL or both NOT NULL).
        Both must be positive integers.

        Args:
            table_count: Number of tables
            max_guests_per_table: Maximum guests per table

        Raises:
            ValueError: If validation fails
        """
        # Check both-or-neither constraint
        if (table_count is None) != (max_guests_per_table is None):
            raise ValueError(
                "table_count and max_guests_per_table must be set together "
                "(both NULL or both NOT NULL)"
            )

        # If both are set, validate values
        if table_count is not None and max_guests_per_table is not None:
            if table_count <= 0:
                raise ValueError(f"table_count must be positive, got {table_count}")
            if max_guests_per_table <= 0:
                raise ValueError(
                    f"max_guests_per_table must be positive, got {max_guests_per_table}"
                )
            if table_count > 1000:
                raise ValueError(f"table_count cannot exceed 1000, got {table_count}")
            if max_guests_per_table > 50:
                raise ValueError(
                    f"max_guests_per_table cannot exceed 50, got {max_guests_per_table}"
                )

    @staticmethod
    async def get_seating_summary(
        db: AsyncSession,
        event_id: UUID,
    ) -> dict[str, int]:
        """
        Get summary statistics for event seating.

        Args:
            db: Database session
            event_id: Event UUID

        Returns:
            dict with keys:
                - total_guests: Total confirmed guests
                - assigned_guests: Guests with table assignments
                - unassigned_guests: Guests without table assignments
                - total_tables: Number of tables
                - max_capacity: Total seating capacity
        """
        # Get event configuration
        event_query = select(Event).where(Event.id == event_id)
        result = await db.execute(event_query)
        event = result.scalar_one()

        # Get guest counts
        total_query = (
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                EventRegistration.status == RegistrationStatus.CONFIRMED,
            )
        )
        total_result = await db.execute(total_query)
        total_guests = total_result.scalar_one()

        assigned_query = (
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                EventRegistration.status == RegistrationStatus.CONFIRMED,
                RegistrationGuest.table_number.isnot(None),
            )
        )
        assigned_result = await db.execute(assigned_query)
        assigned_guests = assigned_result.scalar_one()

        return {
            "total_guests": total_guests,
            "assigned_guests": assigned_guests,
            "unassigned_guests": total_guests - assigned_guests,
            "total_tables": event.table_count or 0,
            "max_capacity": event.total_seating_capacity or 0,
        }

    @staticmethod
    async def get_donor_seating_info(
        db: AsyncSession,
        user_id: UUID,
        event_id: UUID,
    ) -> dict:
        """
        Get seating information for a donor's event registration.

        Implements check-in gating: bidder_number is only visible after check-in.

        Args:
            db: Database session
            user_id: User UUID
            event_id: Event UUID

        Returns:
            dict containing:
                - my_info: User's guest info (bidder_number null if not checked in)
                - tablemates: List of other guests at the same table
                - table_capacity: Current and max capacity
                - has_table_assignment: Boolean
                - message: Optional message (e.g., check-in reminder)

        Raises:
            ValueError: If user has no registration for this event
        """
        # Get user's registration with relationships
        registration_query = (
            select(EventRegistration)
            .options(
                selectinload(EventRegistration.guests),
                selectinload(EventRegistration.event),
            )
            .where(
                EventRegistration.user_id == user_id,
                EventRegistration.event_id == event_id,
            )
        )
        result = await db.execute(registration_query)
        registration = result.scalar_one_or_none()

        if not registration:
            raise ValueError(f"User {user_id} has no registration for event {event_id}")

        # Find user's guest record (first guest or guest linked to user)
        my_guest = next(
            (g for g in registration.guests if g.user_id == user_id),
            registration.guests[0] if registration.guests else None,
        )

        if not my_guest:
            raise ValueError(f"No guest record found for user {user_id} at event {event_id}")

        # Check if user is checked in
        is_checked_in = registration.check_in_time is not None

        # Build my_info (hide bidder number if not checked in)
        from app.schemas.seating import MySeatingInfo

        my_info = MySeatingInfo(
            guest_id=my_guest.id,
            full_name=my_guest.name,
            bidder_number=my_guest.bidder_number if is_checked_in else None,
            table_number=my_guest.table_number,
            checked_in=is_checked_in,
        )

        # Get tablemates if table assigned
        tablemates = []
        table_capacity = {"current": 0, "max": 0}
        has_table_assignment = my_guest.table_number is not None

        if has_table_assignment and my_guest.table_number is not None:
            # Get all guests at the same table (excluding self)
            tablemates_query = (
                select(RegistrationGuest)
                .join(EventRegistration)
                .where(
                    EventRegistration.event_id == event_id,
                    RegistrationGuest.table_number == my_guest.table_number,
                    RegistrationGuest.id != my_guest.id,
                )
            )
            tablemates_result = await db.execute(tablemates_query)
            tablemate_guests = tablemates_result.scalars().all()

            # Build tablemate info (show bidder numbers only for checked-in guests)
            from app.schemas.seating import TablemateInfo

            for tm_guest in tablemate_guests:
                # Get registration to check check-in status
                tm_reg_query = select(EventRegistration).where(
                    EventRegistration.id == tm_guest.registration_id
                )
                tm_reg_result = await db.execute(tm_reg_query)
                tm_registration = tm_reg_result.scalar_one()

                tm_is_checked_in = tm_registration.check_in_time is not None

                tablemates.append(
                    TablemateInfo(
                        guest_id=tm_guest.id,
                        name=tm_guest.name,
                        bidder_number=tm_guest.bidder_number if tm_is_checked_in else None,
                        company=None,  # TODO: Add company field to guest model if needed
                        profile_image_url=None,  # TODO: Add profile image URL if available
                    )
                )

            # Get table capacity
            current_occupancy = await SeatingService.get_table_occupancy(
                db, event_id, my_guest.table_number
            )
            table_capacity = {
                "current": current_occupancy,
                "max": registration.event.max_guests_per_table or 0,
            }

        # Generate message if needed
        message = None
        if not has_table_assignment:
            message = "Your table assignment is pending. Please check back later."
        elif not is_checked_in:
            message = "Check in at the event to see your bidder number."

        return {
            "my_info": my_info,
            "tablemates": tablemates,
            "table_capacity": table_capacity,
            "has_table_assignment": has_table_assignment,
            "message": message,
        }
