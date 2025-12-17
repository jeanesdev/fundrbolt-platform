"""Unit tests for BidderNumberService."""

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.registration_guest import RegistrationGuest
from app.services.bidder_number_service import BidderNumberService


class TestBidderNumberService:
    """Test suite for BidderNumberService."""

    @pytest.mark.asyncio
    async def test_assign_sequential(self, db_session: AsyncSession, test_active_event, test_donor):
        """Test sequential assignment starting from 100."""
        event_id = test_active_event.id

        # Create EventRegistration first
        from app.models.event_registration import EventRegistration, RegistrationStatus

        registration = EventRegistration(
            id=uuid4(),
            event_id=test_active_event.id,
            user_id=test_donor.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.commit()

        guests = []
        for i in range(3):
            guest = RegistrationGuest(
                id=uuid4(),
                registration_id=registration.id,
                name=f"Guest {i + 1}",
                email=f"guest{i + 1}@test.com",
            )
            db_session.add(guest)
            guests.append(guest)
        await db_session.commit()

        assigned = []
        for guest in guests:
            num = await BidderNumberService.assign_bidder_number(db_session, event_id, guest.id)
            assigned.append(num)

        assert assigned == [100, 101, 102]

    @pytest.mark.asyncio
    async def test_gap_filling(self, db_session: AsyncSession, test_active_event, test_donor):
        """Test filling gaps from cancelled registrations."""
        event_id = test_active_event.id

        # Create EventRegistration first
        from app.models.event_registration import EventRegistration, RegistrationStatus

        registration = EventRegistration(
            id=uuid4(),
            event_id=test_active_event.id,
            user_id=test_donor.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.commit()

        # Create guests with numbers 100, 102, 104 (gaps at 101, 103)
        for number in [100, 102, 104]:
            guest = RegistrationGuest(
                id=uuid4(),
                registration_id=registration.id,
                name=f"Guest {number}",
                email=f"g{number}@test.com",
                bidder_number=number,
            )
            db_session.add(guest)
        await db_session.commit()

        # New guest should get 101 (first gap)
        new_guest1 = RegistrationGuest(
            id=uuid4(),
            registration_id=registration.id,
            name="New 1",
            email="new1@test.com",
        )
        db_session.add(new_guest1)
        await db_session.commit()
        num1 = await BidderNumberService.assign_bidder_number(db_session, event_id, new_guest1.id)
        assert num1 == 101

        # Next guest should get 103 (next gap)
        new_guest2 = RegistrationGuest(
            id=uuid4(),
            registration_id=registration.id,
            name="New 2",
            email="new2@test.com",
        )
        db_session.add(new_guest2)
        await db_session.commit()
        num2 = await BidderNumberService.assign_bidder_number(db_session, event_id, new_guest2.id)
        assert num2 == 103

    @pytest.mark.asyncio
    async def test_get_available_numbers(
        self, db_session: AsyncSession, test_active_event, test_donor
    ):
        """Test getting list of available bidder numbers."""
        event_id = test_active_event.id

        # Create EventRegistration first
        from app.models.event_registration import EventRegistration, RegistrationStatus

        registration = EventRegistration(
            id=uuid4(),
            event_id=test_active_event.id,
            user_id=test_donor.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.commit()

        # Create guests with 100, 102, 104
        for number in [100, 102, 104]:
            guest = RegistrationGuest(
                id=uuid4(),
                registration_id=registration.id,
                name=f"Guest {number}",
                bidder_number=number,
            )
            db_session.add(guest)
        await db_session.commit()

        available = await BidderNumberService.get_available_bidder_numbers(
            db_session, event_id, limit=5
        )
        # Should return: 101, 103, 105, 106, 107
        assert available == [101, 103, 105, 106, 107]

    @pytest.mark.asyncio
    async def test_handle_cancellation(
        self, db_session: AsyncSession, test_active_event, test_donor
    ):
        """Test releasing bidder number on cancellation."""
        from app.models.event_registration import EventRegistration, RegistrationStatus

        registration = EventRegistration(
            id=uuid4(),
            event_id=test_active_event.id,
            user_id=test_donor.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.commit()

        guest = RegistrationGuest(
            id=uuid4(),
            registration_id=registration.id,
            name="Test",
            email="test@test.com",
            bidder_number=100,
        )
        db_session.add(guest)
        await db_session.commit()

        assert guest.bidder_number == 100

        await BidderNumberService.handle_registration_cancellation(db_session, guest.id)

        await db_session.refresh(guest)
        assert guest.bidder_number is None

    @pytest.mark.asyncio
    async def test_get_bidder_count(self, db_session: AsyncSession, test_active_event, test_donor):
        """Test counting assigned bidder numbers."""
        event_id = test_active_event.id

        from app.models.event_registration import EventRegistration, RegistrationStatus

        registration = EventRegistration(
            id=uuid4(),
            event_id=test_active_event.id,
            user_id=test_donor.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.commit()

        for i in range(5):
            guest = RegistrationGuest(
                id=uuid4(),
                registration_id=registration.id,
                name=f"Guest {i}",
                bidder_number=100 + i,
            )
            db_session.add(guest)
        await db_session.commit()

        count = await BidderNumberService.get_bidder_count(db_session, event_id)
        assert count == 5

    @pytest.mark.asyncio
    async def test_validate_uniqueness(
        self, db_session: AsyncSession, test_active_event, test_donor
    ):
        """Test validating bidder number uniqueness."""
        event_id = test_active_event.id

        from app.models.event_registration import EventRegistration, RegistrationStatus

        registration = EventRegistration(
            id=uuid4(),
            event_id=test_active_event.id,
            user_id=test_donor.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.commit()

        guest = RegistrationGuest(
            id=uuid4(),
            registration_id=registration.id,
            name="Test",
            bidder_number=100,
        )
        db_session.add(guest)
        await db_session.commit()

        # Should raise ValueError for duplicate number
        with pytest.raises(ValueError, match="already assigned"):
            await BidderNumberService.validate_bidder_number_uniqueness(db_session, event_id, 100)

        # Should not raise for unique number
        await BidderNumberService.validate_bidder_number_uniqueness(db_session, event_id, 101)

    @pytest.mark.asyncio
    async def test_reassign_available_number(
        self, db_session: AsyncSession, test_active_event, test_donor
    ):
        """Test reassigning to an available bidder number."""
        event_id = test_active_event.id

        from app.models.event_registration import EventRegistration, RegistrationStatus

        registration = EventRegistration(
            id=uuid4(),
            event_id=test_active_event.id,
            user_id=test_donor.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.commit()

        # Create guest with number 100
        guest = RegistrationGuest(
            id=uuid4(),
            registration_id=registration.id,
            name="Guest",
            email="guest@test.com",
            bidder_number=100,
        )
        db_session.add(guest)
        await db_session.commit()

        # Reassign to 200 (available)
        result = await BidderNumberService.reassign_bidder_number(
            db_session, event_id, guest.id, 200
        )

        assert result["guest_id"] == guest.id
        assert result["bidder_number"] == 200
        assert result["previous_holder_id"] is None

        # Verify database was updated
        await db_session.refresh(guest)
        assert guest.bidder_number == 200

    @pytest.mark.asyncio
    async def test_reassign_with_conflict_swap(
        self, db_session: AsyncSession, test_active_event, test_donor
    ):
        """Test reassigning to a number already in use (automatic swap)."""
        event_id = test_active_event.id

        from app.models.event_registration import EventRegistration, RegistrationStatus

        registration = EventRegistration(
            id=uuid4(),
            event_id=test_active_event.id,
            user_id=test_donor.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.commit()

        # Create two guests with numbers 100 and 200
        guest1 = RegistrationGuest(
            id=uuid4(),
            registration_id=registration.id,
            name="Guest 1",
            email="guest1@test.com",
            bidder_number=100,
        )
        guest2 = RegistrationGuest(
            id=uuid4(),
            registration_id=registration.id,
            name="Guest 2",
            email="guest2@test.com",
            bidder_number=200,
        )
        db_session.add_all([guest1, guest2])
        await db_session.commit()
        await db_session.refresh(guest1)
        await db_session.refresh(guest2)

        # Reassign guest1 to 200 (currently held by guest2)
        result = await BidderNumberService.reassign_bidder_number(
            db_session, event_id, guest1.id, 200
        )

        assert result["guest_id"] == guest1.id
        assert result["bidder_number"] == 200
        assert result["previous_holder_id"] == guest2.id

        # Verify both guests were updated
        await db_session.refresh(guest1)
        await db_session.refresh(guest2)
        assert guest1.bidder_number == 200
        assert guest2.bidder_number == 101  # Should be reassigned to next available

    @pytest.mark.asyncio
    async def test_reassign_invalid_range(
        self, db_session: AsyncSession, test_active_event, test_donor
    ):
        """Test reassigning with out-of-range bidder number."""
        event_id = test_active_event.id

        from app.models.event_registration import EventRegistration, RegistrationStatus

        registration = EventRegistration(
            id=uuid4(),
            event_id=test_active_event.id,
            user_id=test_donor.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.commit()

        guest = RegistrationGuest(
            id=uuid4(),
            registration_id=registration.id,
            name="Guest",
            email="guest@test.com",
            bidder_number=100,
        )
        db_session.add(guest)
        await db_session.commit()

        # Try to assign number below 100
        with pytest.raises(ValueError, match="must be between 100 and 999"):
            await BidderNumberService.reassign_bidder_number(db_session, event_id, guest.id, 99)

        # Try to assign number above 999
        with pytest.raises(ValueError, match="must be between 100 and 999"):
            await BidderNumberService.reassign_bidder_number(db_session, event_id, guest.id, 1000)

        # Verify original number unchanged
        await db_session.refresh(guest)
        assert guest.bidder_number == 100
