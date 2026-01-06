"""Unit tests for SeatingService."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.registration_guest import RegistrationGuest
from app.models.user import User
from app.services.seating_service import SeatingService


@pytest.mark.asyncio
class TestSeatingService:
    """Test SeatingService validation and configuration logic."""

    async def test_validate_seating_config_both_set(self, db_session: AsyncSession) -> None:
        """Test validation passes when both table_count and max_guests_per_table are set."""
        # Should not raise
        await SeatingService.validate_seating_config(15, 8)
        await SeatingService.validate_seating_config(1, 1)
        await SeatingService.validate_seating_config(1000, 50)

    async def test_validate_seating_config_both_none(self, db_session: AsyncSession) -> None:
        """Test validation passes when both values are None."""
        # Should not raise
        await SeatingService.validate_seating_config(None, None)

    async def test_validate_seating_config_only_table_count(self, db_session: AsyncSession) -> None:
        """Test validation fails when only table_count is set."""
        with pytest.raises(ValueError, match="must be set together"):
            await SeatingService.validate_seating_config(15, None)

    async def test_validate_seating_config_only_max_guests(self, db_session: AsyncSession) -> None:
        """Test validation fails when only max_guests_per_table is set."""
        with pytest.raises(ValueError, match="must be set together"):
            await SeatingService.validate_seating_config(None, 8)

    async def test_validate_seating_config_table_count_too_high(
        self, db_session: AsyncSession
    ) -> None:
        """Test validation fails when table_count exceeds maximum."""
        with pytest.raises(ValueError, match="table_count cannot exceed 1000"):
            await SeatingService.validate_seating_config(1001, 8)

    async def test_validate_seating_config_table_count_zero(self, db_session: AsyncSession) -> None:
        """Test validation fails when table_count is zero."""
        with pytest.raises(ValueError, match="table_count must be positive"):
            await SeatingService.validate_seating_config(0, 8)

    async def test_validate_seating_config_table_count_negative(
        self, db_session: AsyncSession
    ) -> None:
        """Test validation fails when table_count is negative."""
        with pytest.raises(ValueError, match="table_count must be positive"):
            await SeatingService.validate_seating_config(-5, 8)

    async def test_validate_seating_config_max_guests_too_high(
        self, db_session: AsyncSession
    ) -> None:
        """Test validation fails when max_guests_per_table exceeds maximum."""
        with pytest.raises(ValueError, match="max_guests_per_table cannot exceed 50"):
            await SeatingService.validate_seating_config(15, 51)

    async def test_validate_seating_config_max_guests_zero(self, db_session: AsyncSession) -> None:
        """Test validation fails when max_guests_per_table is zero."""
        with pytest.raises(ValueError, match="max_guests_per_table must be positive"):
            await SeatingService.validate_seating_config(15, 0)

    async def test_validate_seating_config_max_guests_negative(
        self, db_session: AsyncSession
    ) -> None:
        """Test validation fails when max_guests_per_table is negative."""
        with pytest.raises(ValueError, match="max_guests_per_table must be positive"):
            await SeatingService.validate_seating_config(15, -3)

    async def test_validate_seating_config_edge_cases(self, db_session: AsyncSession) -> None:
        """Test edge case values."""
        # Minimum valid values
        await SeatingService.validate_seating_config(1, 1)

        # Maximum valid values
        await SeatingService.validate_seating_config(1000, 50)

        # Typical values
        await SeatingService.validate_seating_config(20, 10)
        await SeatingService.validate_seating_config(15, 8)

    @pytest.mark.asyncio
    async def test_assign_guest_to_table(
        self, db_session: AsyncSession, test_active_event: Event, test_user_2: "User"
    ) -> None:
        """Test assigning a guest to a specific table."""
        # Configure event with seating
        test_active_event.table_count = 10
        test_active_event.max_guests_per_table = 8
        db_session.add(test_active_event)
        await db_session.commit()

        # Create registration and guest
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user_2.id,
            status=RegistrationStatus.CONFIRMED,
            number_of_guests=1,
        )
        db_session.add(registration)
        await db_session.flush()

        guest = RegistrationGuest(
            registration_id=registration.id,
            name="John Doe",
            email="john@example.com",
        )
        db_session.add(guest)
        await db_session.commit()
        await db_session.refresh(guest)

        # Assign to table 3
        await SeatingService.assign_guest_to_table(db_session, test_active_event.id, guest.id, 3)
        await db_session.refresh(guest)

        assert guest.table_number == 3

    @pytest.mark.asyncio
    async def test_validate_capacity_exceeded(
        self, db_session: AsyncSession, test_active_event: Event, test_user_2: "User"
    ) -> None:
        """Test that assigning to a full table raises an error."""
        # Configure event with capacity of 2 per table
        test_active_event.table_count = 10
        test_active_event.max_guests_per_table = 2
        db_session.add(test_active_event)
        await db_session.commit()

        # Create registration
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user_2.id,
            status=RegistrationStatus.CONFIRMED,
            number_of_guests=3,
        )
        db_session.add(registration)
        await db_session.flush()

        # Fill table 5 to capacity (2 guests)
        guest1 = RegistrationGuest(
            registration_id=registration.id,
            name="Guest 1",
            email="guest1@example.com",
            table_number=5,
        )
        guest2 = RegistrationGuest(
            registration_id=registration.id,
            name="Guest 2",
            email="guest2@example.com",
            table_number=5,
        )
        guest3 = RegistrationGuest(
            registration_id=registration.id,
            name="Guest 3",
            email="guest3@example.com",
        )
        db_session.add_all([guest1, guest2, guest3])
        await db_session.commit()
        await db_session.refresh(guest3)

        # Try to assign guest3 to full table 5
        with pytest.raises(ValueError, match=r"Table 5 is full \(\d+/\d+ seats\)"):
            await SeatingService.assign_guest_to_table(
                db_session, test_active_event.id, guest3.id, 5
            )

    @pytest.mark.asyncio
    async def test_remove_guest_from_table(
        self, db_session: AsyncSession, test_active_event: Event, test_user_2: "User"
    ) -> None:
        """Test removing a guest from their assigned table."""
        # Configure event
        test_active_event.table_count = 10
        test_active_event.max_guests_per_table = 8
        db_session.add(test_active_event)
        await db_session.commit()

        # Create guest assigned to table 5
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user_2.id,
            status=RegistrationStatus.CONFIRMED,
            number_of_guests=1,
        )
        db_session.add(registration)
        await db_session.flush()

        guest = RegistrationGuest(
            registration_id=registration.id,
            name="Jane Smith",
            email="jane@example.com",
            table_number=5,
        )
        db_session.add(guest)
        await db_session.commit()
        await db_session.refresh(guest)

        # Remove from table
        await SeatingService.remove_guest_from_table(db_session, guest.id)
        await db_session.refresh(guest)

        assert guest.table_number is None

    @pytest.mark.asyncio
    async def test_get_table_occupancy(
        self, db_session: AsyncSession, test_active_event: Event, test_user_2: "User"
    ) -> None:
        """Test getting the current occupancy of a table."""
        # Configure event
        test_active_event.table_count = 10
        test_active_event.max_guests_per_table = 8
        db_session.add(test_active_event)
        await db_session.commit()

        # Create registration
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user_2.id,
            status=RegistrationStatus.CONFIRMED,
            number_of_guests=3,
        )
        db_session.add(registration)
        await db_session.flush()

        # Add 3 guests to table 2
        guests = [
            RegistrationGuest(
                registration_id=registration.id,
                name=f"Guest {i}",
                email=f"guest{i}@example.com",
                table_number=2,
            )
            for i in range(1, 4)
        ]
        db_session.add_all(guests)
        await db_session.commit()

        # Check occupancy
        occupancy = await SeatingService.get_table_occupancy(db_session, test_active_event.id, 2)

        assert occupancy == 3

    @pytest.mark.asyncio
    async def test_get_unassigned_guests(
        self, db_session: AsyncSession, test_active_event: Event, test_user_2: "User"
    ) -> None:
        """Test getting list of unassigned guests."""
        # Configure event
        test_active_event.table_count = 10
        test_active_event.max_guests_per_table = 8
        db_session.add(test_active_event)
        await db_session.commit()

        # Create registration
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user_2.id,
            status=RegistrationStatus.CONFIRMED,
            number_of_guests=3,
        )
        db_session.add(registration)
        await db_session.flush()

        # Create 2 unassigned + 1 assigned guest
        guest1 = RegistrationGuest(
            registration_id=registration.id,
            name="Unassigned 1",
            email="unassigned1@example.com",
        )
        guest2 = RegistrationGuest(
            registration_id=registration.id,
            name="Unassigned 2",
            email="unassigned2@example.com",
        )
        guest3 = RegistrationGuest(
            registration_id=registration.id,
            name="Assigned",
            email="assigned@example.com",
            table_number=7,
        )
        db_session.add_all([guest1, guest2, guest3])
        await db_session.commit()

        # Get unassigned guests
        unassigned = await SeatingService.get_unassigned_guests(db_session, test_active_event.id)

        assert len(unassigned) == 2
        assert all(g.table_number is None for g in unassigned)

    @pytest.mark.asyncio
    async def test_validate_table_number_out_of_range(
        self, db_session: AsyncSession, test_active_event: Event, test_user_2: "User"
    ) -> None:
        """Test that assigning to a non-existent table raises an error."""
        # Configure event with 5 tables
        test_active_event.table_count = 5
        test_active_event.max_guests_per_table = 8
        db_session.add(test_active_event)
        await db_session.commit()

        # Create guest
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user_2.id,
            status=RegistrationStatus.CONFIRMED,
            number_of_guests=1,
        )
        db_session.add(registration)
        await db_session.flush()

        guest = RegistrationGuest(
            registration_id=registration.id,
            name="Test Guest",
            email="test@example.com",
        )
        db_session.add(guest)
        await db_session.commit()
        await db_session.refresh(guest)

        # Try to assign to table 10 (out of range)
        with pytest.raises(ValueError, match="Table number 10 is out of range"):
            await SeatingService.assign_guest_to_table(
                db_session, test_active_event.id, guest.id, 10
            )
