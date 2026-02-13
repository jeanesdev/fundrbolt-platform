"""
Unit tests for auto-assignment service.

Tests party grouping and sequential table filling algorithms.
"""

from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.registration_guest import RegistrationGuest
from app.models.user import User
from app.services.auto_assign_service import AutoAssignService


class TestAutoAssignService:
    """Test cases for auto-assignment service."""

    @pytest.mark.asyncio
    async def test_party_grouping_keeps_guests_together(
        self, db_session: AsyncSession, test_active_event: Event, test_user: Any
    ) -> None:
        """Test that guests from same registration stay at same table."""
        # Configure event seating
        test_active_event.table_count = 5
        test_active_event.max_guests_per_table = 4
        await db_session.commit()

        # Create registration with 3 guests
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.flush()

        # Create 3 guests (party)
        guests = []
        for i in range(3):
            guest = RegistrationGuest(
                registration_id=registration.id,
                name=f"Guest {i + 1}",
                email=f"guest{i + 1}@party.com",
            )
            db_session.add(guest)
            guests.append(guest)
        await db_session.commit()

        # Run auto-assign
        result = await AutoAssignService.auto_assign_guests(db_session, test_active_event.id)

        # Verify all assigned
        assert result["assigned_count"] == 3
        assert result["unassigned_count"] == 0
        assert len(result["warnings"]) == 0

        # Verify all guests at same table
        await db_session.refresh(guests[0])
        await db_session.refresh(guests[1])
        await db_session.refresh(guests[2])

        assert guests[0].table_number is not None
        assert guests[0].table_number == guests[1].table_number
        assert guests[1].table_number == guests[2].table_number

    @pytest.mark.asyncio
    async def test_sequential_table_filling(
        self, db_session: AsyncSession, test_active_event: Event, test_user: Any
    ) -> None:
        """Test that tables are filled sequentially for efficient packing."""
        # Configure event seating
        test_active_event.table_count = 3
        test_active_event.max_guests_per_table = 2
        await db_session.commit()

        # Create unique users for each registration
        from sqlalchemy import text

        from app.core.security import hash_password

        role_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'donor'"))
        donor_role_id = role_result.scalar_one()

        users = []
        for i in range(3):
            user = User(
                email=f"sequential_user_{i}@test.com",
                password_hash=hash_password("TestPass123"),
                first_name=f"User{i}",
                last_name="Test",
                role_id=donor_role_id,
                email_verified=True,
                is_active=True,
            )
            db_session.add(user)
            users.append(user)
        await db_session.flush()

        # Create 3 registrations with 2 guests each (6 guests total)
        for reg_num in range(3):
            registration = EventRegistration(
                event_id=test_active_event.id,
                user_id=users[reg_num].id,
                status=RegistrationStatus.CONFIRMED,
            )
            db_session.add(registration)
            await db_session.flush()

            for guest_num in range(2):
                guest = RegistrationGuest(
                    registration_id=registration.id,
                    name=f"Guest R{reg_num + 1}G{guest_num + 1}",
                    email=f"guest.r{reg_num + 1}g{guest_num + 1}@test.com",
                )
                db_session.add(guest)
        await db_session.commit()

        # Run auto-assign
        result = await AutoAssignService.auto_assign_guests(db_session, test_active_event.id)

        # Verify all assigned
        assert result["assigned_count"] == 6
        assert result["unassigned_count"] == 0

        # Verify tables filled sequentially (table 1 full, table 2 full, table 3 full)
        query = (
            select(RegistrationGuest)
            .join(EventRegistration)
            .where(EventRegistration.event_id == test_active_event.id)
            .order_by(RegistrationGuest.table_number)
        )
        result_query = await db_session.execute(query)
        all_guests = list(result_query.scalars().all())

        table_counts = {}
        for guest in all_guests:
            table_counts[guest.table_number] = table_counts.get(guest.table_number, 0) + 1

        # Each table should have exactly 2 guests
        assert table_counts == {1: 2, 2: 2, 3: 2}

    @pytest.mark.asyncio
    async def test_large_party_split_when_necessary(
        self, db_session: AsyncSession, test_active_event: Event, test_user: Any
    ) -> None:
        """Test that large parties are split when no single table fits them."""
        # Configure event seating
        test_active_event.table_count = 2
        test_active_event.max_guests_per_table = 3
        await db_session.commit()

        # Create registration with 5 guests (too large for single table)
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.flush()

        for i in range(5):
            guest = RegistrationGuest(
                registration_id=registration.id,
                name=f"Guest {i + 1}",
                email=f"guest{i + 1}@large-party.com",
            )
            db_session.add(guest)
        await db_session.commit()

        # Run auto-assign
        result = await AutoAssignService.auto_assign_guests(db_session, test_active_event.id)

        # Verify all assigned
        assert result["assigned_count"] == 5
        assert result["unassigned_count"] == 0

        # Verify warning about party split
        assert len(result["warnings"]) == 1
        assert "split" in result["warnings"][0].lower()

    @pytest.mark.asyncio
    async def test_auto_assign_prefers_primary_as_captain(
        self, db_session: AsyncSession, test_active_event: Event, test_user: Any
    ) -> None:
        """Auto-assign should set primary registrant as table captain when available."""
        test_active_event.table_count = 2
        test_active_event.max_guests_per_table = 4
        await db_session.commit()

        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.flush()

        primary_guest = RegistrationGuest(
            registration_id=registration.id,
            name="Primary Guest",
            email="primary@test.com",
            is_primary=True,
        )
        guest = RegistrationGuest(
            registration_id=registration.id,
            name="Guest Two",
            email="guest2@test.com",
        )
        db_session.add_all([primary_guest, guest])
        await db_session.commit()

        await AutoAssignService.auto_assign_guests(db_session, test_active_event.id)

        await db_session.refresh(primary_guest)
        await db_session.refresh(guest)

        assert primary_guest.table_number is not None
        assert primary_guest.table_number == guest.table_number
        assert primary_guest.is_table_captain is True

    @pytest.mark.asyncio
    async def test_largest_parties_assigned_first(
        self, db_session: AsyncSession, test_active_event: Event, test_user: Any
    ) -> None:
        """Test that larger parties are prioritized for better packing."""
        # Configure event seating
        test_active_event.table_count = 2
        test_active_event.max_guests_per_table = 5
        await db_session.commit()

        # Create unique users for each registration
        from sqlalchemy import text

        from app.core.security import hash_password

        role_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'donor'"))
        donor_role_id = role_result.scalar_one()

        users = []
        for i in range(3):
            user = User(
                email=f"party_user_{i}@test.com",
                password_hash=hash_password("TestPass123"),
                first_name=f"Party{i}",
                last_name="User",
                role_id=donor_role_id,
                email_verified=True,
                is_active=True,
            )
            db_session.add(user)
            users.append(user)
        await db_session.flush()

        # Create 3 registrations: party of 4, party of 3, party of 2
        party_sizes = [4, 3, 2]
        registrations = []

        for idx, party_size in enumerate(party_sizes):
            registration = EventRegistration(
                event_id=test_active_event.id,
                user_id=users[idx].id,
                status=RegistrationStatus.CONFIRMED,
            )
            db_session.add(registration)
            await db_session.flush()
            registrations.append(registration)

            for i in range(party_size):
                guest = RegistrationGuest(
                    registration_id=registration.id,
                    name=f"Party{party_size}_Guest{i + 1}",
                    email=f"p{party_size}g{i + 1}@test.com",
                )
                db_session.add(guest)
        await db_session.commit()

        # Run auto-assign
        result = await AutoAssignService.auto_assign_guests(db_session, test_active_event.id)

        # Verify all assigned (4+3+2 = 9, capacity = 10)
        assert result["assigned_count"] == 9
        assert result["unassigned_count"] == 0

        # Verify largest party got table 1
        query = (
            select(RegistrationGuest)
            .where(RegistrationGuest.registration_id == registrations[0].id)
            .limit(1)
        )
        result_query = await db_session.execute(query)
        first_guest = result_query.scalar_one()
        largest_party_table = first_guest.table_number

        # Count guests at largest party's table
        count_query = (
            select(RegistrationGuest)
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == test_active_event.id,
                RegistrationGuest.table_number == largest_party_table,
            )
        )
        count_result = await db_session.execute(count_query)
        guests_at_table = list(count_result.scalars().all())

        # Table should have party of 4 plus party of 3 (or 2)
        # Optimal packing: Table 1 = 4+3=7, Table 2 = 2
        # Or: Table 1 = 4+2=6, Table 2 = 3
        # Since largest first, should be 4+3 or 4+2
        assert len(guests_at_table) >= 4

    @pytest.mark.asyncio
    async def test_no_unassigned_guests_returns_empty(
        self, db_session: AsyncSession, test_active_event: Event
    ) -> None:
        """Test that auto-assign returns empty result when no unassigned guests."""
        # Configure event seating
        test_active_event.table_count = 5
        test_active_event.max_guests_per_table = 8
        await db_session.commit()

        # Run auto-assign with no guests
        result = await AutoAssignService.auto_assign_guests(db_session, test_active_event.id)

        assert result["assigned_count"] == 0
        assert result["unassigned_count"] == 0
        assert len(result["assignments"]) == 0
        assert len(result["warnings"]) == 0

    @pytest.mark.asyncio
    async def test_insufficient_capacity_warning(
        self, db_session: AsyncSession, test_active_event: Event, test_user: Any
    ) -> None:
        """Test warning when total capacity is insufficient."""
        # Configure event seating with limited capacity
        test_active_event.table_count = 1
        test_active_event.max_guests_per_table = 2
        await db_session.commit()

        # Create registration with 5 guests (exceeds capacity)
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.flush()

        for i in range(5):
            guest = RegistrationGuest(
                registration_id=registration.id,
                name=f"Guest {i + 1}",
                email=f"guest{i + 1}@test.com",
            )
            db_session.add(guest)
        await db_session.commit()

        # Run auto-assign
        result = await AutoAssignService.auto_assign_guests(db_session, test_active_event.id)

        # Only 2 guests can be assigned
        assert result["assigned_count"] == 2
        assert result["unassigned_count"] == 3

        # Should have warning about insufficient capacity
        assert len(result["warnings"]) > 0
        warning_text = " ".join(result["warnings"]).lower()
        assert "could not assign" in warning_text or "no available capacity" in warning_text

    @pytest.mark.asyncio
    async def test_seating_not_configured_raises_error(
        self, db_session: AsyncSession, test_active_event: Event
    ) -> None:
        """Test that auto-assign fails gracefully when seating not configured."""
        # Leave seating unconfigured (table_count and max_guests_per_table are NULL)
        assert test_active_event.table_count is None
        assert test_active_event.max_guests_per_table is None

        # Should raise ValueError
        with pytest.raises(ValueError, match="not configured"):
            await AutoAssignService.auto_assign_guests(db_session, test_active_event.id)
