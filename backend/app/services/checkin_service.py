"""Check-in service for event registration check-in operations."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.checkin_record import CheckinAction, CheckinRecord
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest
from app.models.ticket_transfer_record import TicketTransferRecord
from app.models.user import User


class CheckInService:
    """Service for managing event check-in operations."""

    @staticmethod
    async def search_guests(
        db: AsyncSession, event_id: UUID, query: str
    ) -> list[RegistrationGuest]:
        """Search for registered guests by name, phone, or email.

        Args:
            db: Database session
            event_id: Event UUID
            query: Search term

        Returns:
            List of matching RegistrationGuest records
        """
        # Search in registration_guests table
        search_pattern = f"%{query}%"

        stmt = (
            select(RegistrationGuest)
            .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
            .options(
                joinedload(RegistrationGuest.registration).joinedload(EventRegistration.user),
                joinedload(RegistrationGuest.registration).joinedload(EventRegistration.event),
                joinedload(RegistrationGuest.user),
                joinedload(RegistrationGuest.meal_selections),
            )
            .where(
                and_(
                    EventRegistration.event_id == event_id,
                    or_(
                        RegistrationGuest.name.ilike(search_pattern),
                        RegistrationGuest.email.ilike(search_pattern),
                        RegistrationGuest.phone.ilike(search_pattern),
                    ),
                )
            )
        )

        result = await db.execute(stmt)
        return list(result.scalars().unique().all())

    @staticmethod
    async def get_checkin_dashboard(
        db: AsyncSession, event_id: UUID
    ) -> dict:
        """Get check-in dashboard data with totals and checked-in list.

        Args:
            db: Database session
            event_id: Event UUID

        Returns:
            Dictionary with total_registered, total_checked_in, and checked_in list
        """
        # Get total registered count
        total_registered_stmt = (
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
            .where(EventRegistration.event_id == event_id)
        )
        total_registered_result = await db.execute(total_registered_stmt)
        total_registered = total_registered_result.scalar() or 0

        # Get checked-in guests
        checked_in_stmt = (
            select(RegistrationGuest)
            .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
            .options(
                joinedload(RegistrationGuest.registration).joinedload(EventRegistration.user),
                joinedload(RegistrationGuest.registration).joinedload(EventRegistration.event),
                joinedload(RegistrationGuest.user),
                joinedload(RegistrationGuest.meal_selections),
            )
            .where(
                and_(
                    EventRegistration.event_id == event_id,
                    RegistrationGuest.checked_in == True,  # noqa: E712
                    RegistrationGuest.checked_in_at.isnot(None),
                )
            )
            .order_by(RegistrationGuest.checked_in_at.desc())
        )

        checked_in_result = await db.execute(checked_in_stmt)
        checked_in_guests = list(checked_in_result.scalars().unique().all())

        return {
            "total_registered": total_registered,
            "total_checked_in": len(checked_in_guests),
            "checked_in": checked_in_guests,
        }

    @staticmethod
    async def check_in_guest_with_audit(
        db: AsyncSession,
        registration_id: UUID,
        acted_by_user_id: UUID,
    ) -> tuple[RegistrationGuest | None, str | None]:
        """Check in a guest and create audit log entry.

        Args:
            db: Database session
            registration_id: Registration guest UUID
            acted_by_user_id: User performing the check-in

        Returns:
            Tuple of (RegistrationGuest, error_message)
            error_message is None on success
        """
        # Get the registration guest
        stmt = (
            select(RegistrationGuest)
            .options(
                joinedload(RegistrationGuest.registration).joinedload(EventRegistration.event),
                joinedload(RegistrationGuest.registration).joinedload(EventRegistration.user),
                joinedload(RegistrationGuest.user),
            )
            .where(RegistrationGuest.id == registration_id)
        )

        result = await db.execute(stmt)
        guest = result.scalars().first()

        if not guest:
            return None, "Guest not found"

        # Check if already checked in
        if guest.checked_in and guest.checked_in_at:
            return guest, f"Guest already checked in at {guest.checked_in_at.isoformat()}"

        # Update guest check-in status
        now = datetime.now(UTC)
        guest.checked_in = True
        guest.checked_in_at = now
        guest.checked_out_at = None

        # Create audit log entry
        audit_record = CheckinRecord(
            event_id=guest.registration.event_id,
            registration_id=registration_id,
            action=CheckinAction.CHECK_IN,
            acted_by_user_id=acted_by_user_id,
            acted_at=now,
            reason=None,
        )

        db.add(audit_record)
        await db.commit()
        await db.refresh(guest)

        return guest, None

    @staticmethod
    async def check_out_guest_with_audit(
        db: AsyncSession,
        registration_id: UUID,
        acted_by_user_id: UUID,
        reason: str,
    ) -> tuple[RegistrationGuest | None, str | None]:
        """Check out a guest (undo check-in) and create audit log entry.

        Args:
            db: Database session
            registration_id: Registration guest UUID
            acted_by_user_id: User performing the check-out
            reason: Required reason for check-out

        Returns:
            Tuple of (RegistrationGuest, error_message)
            error_message is None on success
        """
        if not reason or not reason.strip():
            return None, "Reason is required for check-out"

        # Get the registration guest
        stmt = (
            select(RegistrationGuest)
            .options(
                joinedload(RegistrationGuest.registration).joinedload(EventRegistration.event),
                joinedload(RegistrationGuest.registration).joinedload(EventRegistration.user),
                joinedload(RegistrationGuest.user),
            )
            .where(RegistrationGuest.id == registration_id)
        )

        result = await db.execute(stmt)
        guest = result.scalars().first()

        if not guest:
            return None, "Guest not found"

        # Check if not checked in
        if not guest.checked_in or not guest.checked_in_at:
            return guest, "Guest is not checked in"

        # Update guest check-in status
        now = datetime.now(UTC)
        guest.checked_in = False
        guest.checked_out_at = now

        # Create audit log entry
        audit_record = CheckinRecord(
            event_id=guest.registration.event_id,
            registration_id=registration_id,
            action=CheckinAction.CHECK_OUT,
            acted_by_user_id=acted_by_user_id,
            acted_at=now,
            reason=reason.strip(),
        )

        db.add(audit_record)
        await db.commit()
        await db.refresh(guest)

        return guest, None

    @staticmethod
    async def update_guest_donor_info(
        db: AsyncSession,
        registration_id: UUID,
        full_name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
    ) -> RegistrationGuest | None:
        """Update donor contact information for a guest.

        Args:
            db: Database session
            registration_id: Registration guest UUID
            full_name: Updated full name
            email: Updated email
            phone: Updated phone

        Returns:
            Updated RegistrationGuest or None if not found
        """
        stmt = (
            select(RegistrationGuest)
            .options(
                joinedload(RegistrationGuest.registration),
                joinedload(RegistrationGuest.user),
            )
            .where(RegistrationGuest.id == registration_id)
        )

        result = await db.execute(stmt)
        guest = result.scalars().first()

        if not guest:
            return None

        # Update fields if provided
        if full_name is not None:
            guest.name = full_name
        if email is not None:
            guest.email = email
        if phone is not None:
            guest.phone = phone

        await db.commit()
        await db.refresh(guest)

        return guest

    @staticmethod
    async def update_guest_seating(
        db: AsyncSession,
        event_id: UUID,
        registration_id: UUID,
        bidder_number: int | None = None,
        table_number: int | None = None,
    ) -> tuple[RegistrationGuest | None, str | None]:
        """Update seating assignment with uniqueness validation.

        Args:
            db: Database session
            event_id: Event UUID for uniqueness check
            registration_id: Registration guest UUID
            bidder_number: Updated bidder number
            table_number: Updated table number

        Returns:
            Tuple of (RegistrationGuest, error_message)
            error_message is None on success
        """
        # Get the guest
        stmt = (
            select(RegistrationGuest)
            .options(
                joinedload(RegistrationGuest.registration),
            )
            .where(RegistrationGuest.id == registration_id)
        )

        result = await db.execute(stmt)
        guest = result.scalars().first()

        if not guest:
            return None, "Guest not found"

        # Check bidder number uniqueness if being updated
        if bidder_number is not None and bidder_number != guest.bidder_number:
            existing_stmt = (
                select(RegistrationGuest)
                .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
                .where(
                    and_(
                        EventRegistration.event_id == event_id,
                        RegistrationGuest.bidder_number == bidder_number,
                        RegistrationGuest.id != registration_id,
                    )
                )
            )
            existing_result = await db.execute(existing_stmt)
            existing_guest = existing_result.scalars().first()

            if existing_guest:
                return None, f"Bidder number {bidder_number} is already assigned to another guest"

        # Update fields
        if bidder_number is not None:
            guest.bidder_number = bidder_number
            if guest.bidder_number and not guest.bidder_number_assigned_at:
                guest.bidder_number_assigned_at = datetime.now(UTC)

        if table_number is not None:
            guest.table_number = table_number

        await db.commit()
        await db.refresh(guest)

        return guest, None

    @staticmethod
    async def update_guest_dinner_selection(
        db: AsyncSession,
        registration_id: UUID,
        dinner_selection_id: UUID | None,
    ) -> RegistrationGuest | None:
        """Update dinner selection for a guest.

        Note: This updates the association, actual MealSelection records
        are managed separately.

        Args:
            db: Database session
            registration_id: Registration guest UUID
            dinner_selection_id: Food option UUID (can be None to clear)

        Returns:
            Updated RegistrationGuest or None if not found
        """
        stmt = (
            select(RegistrationGuest)
            .options(
                joinedload(RegistrationGuest.meal_selections),
            )
            .where(RegistrationGuest.id == registration_id)
        )

        result = await db.execute(stmt)
        guest = result.scalars().first()

        if not guest:
            return None

        # Note: The meal_selections relationship is managed through MealSelection model
        # This method is a placeholder for future implementation if needed
        # For now, we just return the guest

        await db.commit()
        await db.refresh(guest)

        return guest

    @staticmethod
    async def transfer_ticket(
        db: AsyncSession,
        event_id: UUID,
        registration_id: UUID,
        to_donor_id: UUID,
        transferred_by_user_id: UUID,
        note: str | None = None,
    ) -> tuple[RegistrationGuest | None, str | None]:
        """Transfer a ticket to another donor.

        Args:
            db: Database session
            event_id: Event UUID
            registration_id: Registration guest UUID
            to_donor_id: New donor user UUID
            transferred_by_user_id: User performing the transfer
            note: Optional transfer note

        Returns:
            Tuple of (RegistrationGuest, error_message)
            error_message is None on success
        """
        # Get the guest
        stmt = (
            select(RegistrationGuest)
            .options(
                joinedload(RegistrationGuest.registration),
                joinedload(RegistrationGuest.user),
            )
            .where(RegistrationGuest.id == registration_id)
        )

        result = await db.execute(stmt)
        guest = result.scalars().first()

        if not guest:
            return None, "Guest not found"

        # Get new donor user to validate
        new_donor_stmt = select(User).where(User.id == to_donor_id)
        new_donor_result = await db.execute(new_donor_stmt)
        new_donor = new_donor_result.scalars().first()

        if not new_donor:
            return None, "New donor not found"

        # Store old donor for audit
        from_donor_id = guest.user_id

        # Update guest user_id
        guest.user_id = to_donor_id

        # Create audit log entry
        now = datetime.now(UTC)
        transfer_record = TicketTransferRecord(
            event_id=event_id,
            registration_id=registration_id,
            from_donor_id=from_donor_id,
            to_donor_id=to_donor_id,
            transferred_by_user_id=transferred_by_user_id,
            transferred_at=now,
            note=note,
        )

        db.add(transfer_record)
        await db.commit()
        await db.refresh(guest)

        return guest, None

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
