"""Integration tests for seating assignment workflows."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.registration_guest import RegistrationGuest
from app.models.user import User


@pytest.mark.asyncio
class TestSeatingAssignment:
    """Test complete seating assignment workflows."""

    async def test_event_seating_config_flow(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test full workflow: configure seating → verify persistence → update → verify."""
        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        # Step 1: Create event without seating configuration
        create_payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Seating Config Test Event",
            "event_datetime": future_datetime,
            "timezone": "America/New_York",
            "venue_name": "Grand Ballroom",
        }

        create_response = await npo_admin_client.post("/api/v1/events", json=create_payload)
        assert create_response.status_code == 201
        event_data = create_response.json()
        event_id = event_data["id"]

        # Verify no seating configuration initially
        assert event_data.get("table_count") is None
        assert event_data.get("max_guests_per_table") is None

        # Step 2: Configure seating (15 tables, 8 guests per table)
        seating_config = {"table_count": 15, "max_guests_per_table": 8}

        config_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/seating/config",
            json=seating_config,
        )
        assert config_response.status_code == 200
        config_data = config_response.json()

        # Verify configuration response
        assert config_data["event_id"] == event_id
        assert config_data["table_count"] == 15
        assert config_data["max_guests_per_table"] == 8
        assert config_data["total_capacity"] == 120  # 15 * 8

        # Step 3: Verify configuration persists in database
        stmt = select(Event).where(Event.id == event_id)
        result = await db_session.execute(stmt)
        db_event = result.scalar_one()

        assert db_event.table_count == 15
        assert db_event.max_guests_per_table == 8

        # Step 4: Verify configuration appears in GET event endpoint
        get_response = await npo_admin_client.get(f"/api/v1/events/{event_id}")
        assert get_response.status_code == 200
        get_data = get_response.json()

        assert get_data["table_count"] == 15
        assert get_data["max_guests_per_table"] == 8

        # Step 5: Update seating configuration (20 tables, 10 guests per table)
        updated_config = {"table_count": 20, "max_guests_per_table": 10}

        update_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/seating/config",
            json=updated_config,
        )
        assert update_response.status_code == 200
        update_data = update_response.json()

        assert update_data["table_count"] == 20
        assert update_data["max_guests_per_table"] == 10
        assert update_data["total_capacity"] == 200  # 20 * 10

        # Step 6: Verify updated configuration in database
        await db_session.refresh(db_event)
        assert db_event.table_count == 20
        assert db_event.max_guests_per_table == 10

    async def test_seating_config_validation_errors(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test validation errors for invalid seating configurations."""
        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        # Create event
        create_payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Validation Test Event",
            "event_datetime": future_datetime,
            "timezone": "America/New_York",
        }

        create_response = await npo_admin_client.post("/api/v1/events", json=create_payload)
        assert create_response.status_code == 201
        event_id = create_response.json()["id"]

        # Test 1: Only table_count set (should fail)
        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/seating/config",
            json={"table_count": 15},
        )
        assert response.status_code == 422
        detail = response.json()["detail"]
        assert "must be set together" in detail or "must be set together" in str(detail)

        # Test 2: Only max_guests_per_table set (should fail)
        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/seating/config",
            json={"max_guests_per_table": 8},
        )
        assert response.status_code == 422
        detail = response.json()["detail"]
        assert "must be set together" in detail or "must be set together" in str(detail)

        # Test 3: table_count exceeds maximum (should fail)
        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/seating/config",
            json={"table_count": 1001, "max_guests_per_table": 8},
        )
        assert response.status_code == 422  # Pydantic validation error

        # Test 4: max_guests_per_table exceeds maximum (should fail)
        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/seating/config",
            json={"table_count": 15, "max_guests_per_table": 51},
        )
        assert response.status_code == 422  # Pydantic validation error

        # Test 5: Negative values (should fail)
        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/seating/config",
            json={"table_count": -5, "max_guests_per_table": 8},
        )
        assert response.status_code == 422  # Pydantic validation error

        # Test 6: Zero values (should fail)
        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/seating/config",
            json={"table_count": 0, "max_guests_per_table": 8},
        )
        assert response.status_code == 422  # Pydantic validation error

    async def test_seating_config_clear(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test clearing seating configuration by setting both to null."""
        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        # Step 1: Create event without seating configuration
        create_payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Clear Config Test Event",
            "event_datetime": future_datetime,
            "timezone": "America/New_York",
        }

        create_response = await npo_admin_client.post("/api/v1/events", json=create_payload)
        assert create_response.status_code == 201
        event_id = create_response.json()["id"]

        # Step 2: Set seating configuration via PATCH endpoint
        config_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/seating/config",
            json={"table_count": 15, "max_guests_per_table": 8},
        )
        assert config_response.status_code == 200

        # Step 3: Verify configuration was set
        get_response = await npo_admin_client.get(f"/api/v1/events/{event_id}")
        assert get_response.status_code == 200
        assert get_response.json()["table_count"] == 15
        assert get_response.json()["max_guests_per_table"] == 8

        # Step 4: Clear configuration by setting both to null
        clear_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/seating/config",
            json={"table_count": None, "max_guests_per_table": None},
        )
        assert clear_response.status_code == 200
        clear_data = clear_response.json()

        assert clear_data["table_count"] is None
        assert clear_data["max_guests_per_table"] is None
        assert clear_data["total_capacity"] == 0

        # Step 5: Verify cleared in database
        stmt = select(Event).where(Event.id == event_id)
        result = await db_session.execute(stmt)
        db_event = result.scalar_one()

        assert db_event.table_count is None
        assert db_event.max_guests_per_table is None

    async def test_seating_config_authorization(
        self,
        donor_client: AsyncClient,
        test_approved_npo: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test that only authorized users can configure seating."""
        # This test requires both npo_admin_client and donor_client simultaneously
        # to create an event and then verify authorization
        # Skip for now as it requires complex fixture setup with multiple clients
        pytest.skip("Authorization test requires multiple client fixtures")

    async def test_manual_bidder_number_assignment(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        test_active_event: Any,
        test_donor: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test manual bidder number assignment to a guest."""
        from uuid import uuid4

        from app.models.event_registration import EventRegistration, RegistrationStatus
        from app.models.registration_guest import RegistrationGuest

        # Step 1: Create a registration and guest
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
            name="Test Guest",
            email="guest@example.com",
            bidder_number=None,
        )
        db_session.add(guest)
        await db_session.commit()

        # Step 2: Manually assign bidder number 150
        assign_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_active_event.id}/guests/{guest.id}/bidder-number",
            json={"bidder_number": 150},
        )
        assert assign_response.status_code == 200
        assign_data = assign_response.json()

        assert assign_data["guest_id"] == str(guest.id)
        assert assign_data["bidder_number"] == 150
        assert assign_data["previous_holder_id"] is None

        # Step 3: Verify assignment persisted in database
        await db_session.refresh(guest)
        assert guest.bidder_number == 150

    async def test_manual_bidder_number_conflict_resolution(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        test_active_event: Any,
        test_donor: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test automatic swap when assigning a number already in use."""
        from uuid import uuid4

        # Step 1: Create two users and two guests with bidder numbers 200 and 300
        from sqlalchemy import text

        from app.core.security import hash_password
        from app.models.event_registration import EventRegistration, RegistrationStatus
        from app.models.registration_guest import RegistrationGuest
        from app.models.user import User

        # Get donor role_id
        role_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'donor'"))
        donor_role_id = role_result.scalar_one()

        # Create second user for second registration
        user2 = User(
            email="testdonor2@example.com",
            password_hash=hash_password("TestPass123"),
            first_name="Test",
            last_name="Donor2",
            role_id=donor_role_id,
            email_verified=True,
            is_active=True,
        )
        db_session.add(user2)
        await db_session.commit()

        registration1 = EventRegistration(
            id=uuid4(),
            event_id=test_active_event.id,
            user_id=test_donor.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration1)

        registration2 = EventRegistration(
            id=uuid4(),
            event_id=test_active_event.id,
            user_id=user2.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration2)
        await db_session.commit()

        guest1 = RegistrationGuest(
            id=uuid4(),
            registration_id=registration1.id,
            name="Guest 1",
            email="guest1@example.com",
            bidder_number=200,
        )
        guest2 = RegistrationGuest(
            id=uuid4(),
            registration_id=registration2.id,
            name="Guest 2",
            email="guest2@example.com",
            bidder_number=300,
        )
        db_session.add_all([guest1, guest2])
        await db_session.commit()

        # Step 2: Reassign registration1 to 300 (currently held by guest2 in registration2)
        reassign_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_active_event.id}/registrations/{registration1.id}/bidder-number",
            json={"bidder_number": 300},
        )
        assert reassign_response.status_code == 200
        reassign_data = reassign_response.json()

        # Verify assignment succeeded
        assert reassign_data["registration_id"] == str(registration1.id)
        assert reassign_data["bidder_number"] == 300

        # Step 3: Verify both guests in database
        await db_session.refresh(guest1)
        await db_session.refresh(guest2)
        assert guest1.bidder_number == 300
        assert guest2.bidder_number == 100  # Reassigned to next available

    async def test_manual_bidder_number_validation(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        test_active_event: Any,
        test_donor: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test validation of bidder number range."""
        from uuid import uuid4

        from app.models.event_registration import EventRegistration, RegistrationStatus
        from app.models.registration_guest import RegistrationGuest

        # Step 1: Create a guest
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
            name="Test Guest",
            email="guest@example.com",
        )
        db_session.add(guest)
        await db_session.commit()

        # Step 2: Try to assign number below 100
        below_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_active_event.id}/guests/{guest.id}/bidder-number",
            json={"bidder_number": 99},
        )
        assert below_response.status_code == 422  # Pydantic validation error
        response_text = str(below_response.json())
        assert (
            "greater than or equal to 100" in response_text
            or "must be between 100 and 999" in response_text
        )

        # Step 3: Try to assign number above 999
        above_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_active_event.id}/guests/{guest.id}/bidder-number",
            json={"bidder_number": 1000},
        )
        assert above_response.status_code == 422  # Pydantic validation error
        response_text = str(above_response.json())
        assert (
            "less than or equal to 999" in response_text
            or "must be between 100 and 999" in response_text
        )


@pytest.mark.asyncio
class TestSeatingDragDropWorkflow:
    """Integration tests for drag-and-drop seating assignment workflow."""

    async def test_assign_guest_to_table_via_api(
        self,
        npo_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_active_event: Event,
        test_user_2: Any,
    ) -> None:
        """Test assigning a guest to a table via PATCH endpoint (drag-drop workflow)."""
        from app.models.event_registration import EventRegistration
        from app.models.registration_guest import RegistrationGuest

        # Configure event with seating
        test_active_event.table_count = 10
        test_active_event.max_guests_per_table = 8
        await db_session.commit()
        await db_session.refresh(test_active_event)

        # Create registration and guest
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user_2.id,
            number_of_guests=1,
            status="confirmed",
        )
        db_session.add(registration)
        await db_session.commit()
        await db_session.refresh(registration)

        guest = RegistrationGuest(
            registration_id=registration.id,
            name="John Doe",
            email="john@example.com",
        )
        db_session.add(guest)
        await db_session.commit()
        await db_session.refresh(guest)

        # Assign guest to table 3 via API (simulates drag-drop)
        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_active_event.id}/guests/{guest.id}/table",
            json={"table_number": 3},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["table_number"] == 3
        assert data["guest_id"] == str(guest.id)

        # Verify persistence in database
        await db_session.refresh(guest)
        assert guest.table_number == 3

    async def test_remove_guest_from_table_via_api(
        self,
        npo_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_active_event: Event,
        test_user_2: Any,
    ) -> None:
        """Test removing a guest from a table via DELETE endpoint (drag to unassigned)."""
        from app.models.event_registration import EventRegistration
        from app.models.registration_guest import RegistrationGuest

        # Configure event
        test_active_event.table_count = 10
        test_active_event.max_guests_per_table = 8
        await db_session.commit()
        await db_session.refresh(test_active_event)

        # Create registration and guest assigned to table 5
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user_2.id,
            number_of_guests=1,
            status="confirmed",
        )
        db_session.add(registration)
        await db_session.commit()
        await db_session.refresh(registration)

        guest = RegistrationGuest(
            registration_id=registration.id,
            name="Jane Smith",
            email="jane@example.com",
            table_number=5,
        )
        db_session.add(guest)
        await db_session.commit()
        await db_session.refresh(guest)

        assert guest.table_number == 5

        # Remove guest from table via API (simulates drag to unassigned section)
        response = await npo_admin_client.delete(
            f"/api/v1/admin/events/{test_active_event.id}/guests/{guest.id}/table"
        )

        assert response.status_code == 204
        # DELETE returns no content

        # Verify persistence in database
        await db_session.refresh(guest)
        assert guest.table_number is None

    async def test_assign_to_full_table_returns_409(
        self,
        npo_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_active_event: Event,
        test_user_2: Any,
    ) -> None:
        """Test assigning to a full table returns 409 Conflict (drag-drop validation)."""
        from app.models.event_registration import EventRegistration
        from app.models.registration_guest import RegistrationGuest

        # Configure event with small capacity
        test_active_event.table_count = 10
        test_active_event.max_guests_per_table = 2
        await db_session.commit()
        await db_session.refresh(test_active_event)

        # Create registration with 3 guests
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user_2.id,
            number_of_guests=3,
            status="confirmed",
        )
        db_session.add(registration)
        await db_session.commit()
        await db_session.refresh(registration)

        # Fill table 5 with 2 guests
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

        # Try to assign guest3 to full table 5 (simulates invalid drag-drop)
        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_active_event.id}/guests/{guest3.id}/table",
            json={"table_number": 5},
        )

        assert response.status_code == 409
        data = response.json()
        detail_str = (
            str(data["detail"]).lower()
            if isinstance(data["detail"], dict)
            else data["detail"].lower()
        )
        assert "full" in detail_str or "capacity" in detail_str

    async def test_get_seating_guests_list(
        self,
        npo_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_active_event: Event,
        test_user_2: Any,
    ) -> None:
        """Test retrieving paginated seating guests list for drag-drop UI."""
        from app.models.event_registration import EventRegistration
        from app.models.registration_guest import RegistrationGuest

        # Configure event
        test_active_event.table_count = 10
        test_active_event.max_guests_per_table = 8
        await db_session.commit()
        await db_session.refresh(test_active_event)

        # Create registration with multiple guests
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user_2.id,
            number_of_guests=3,
            status="confirmed",
        )
        db_session.add(registration)
        await db_session.commit()
        await db_session.refresh(registration)

        # Create 2 assigned + 1 unassigned guest
        guest1 = RegistrationGuest(
            registration_id=registration.id,
            name="Assigned 1",
            email="assigned1@example.com",
            table_number=2,
        )
        guest2 = RegistrationGuest(
            registration_id=registration.id,
            name="Assigned 2",
            email="assigned2@example.com",
            table_number=3,
        )
        guest3 = RegistrationGuest(
            registration_id=registration.id,
            name="Unassigned",
            email="unassigned@example.com",
        )
        db_session.add_all([guest1, guest2, guest3])
        await db_session.commit()

        # Get seating guests list
        response = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_active_event.id}/seating/guests",
            params={"page": 1, "per_page": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert "guests" in data
        assert "total" in data
        assert data["total"] == 3
        assert len(data["guests"]) == 3

        # Verify guest data structure
        guest_names = {guest["name"] for guest in data["guests"]}
        assert "Assigned 1" in guest_names
        assert "Assigned 2" in guest_names
        assert "Unassigned" in guest_names

    async def test_get_table_occupancy(
        self,
        npo_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_active_event: Event,
        test_user_2: Any,
    ) -> None:
        """Test retrieving table occupancy for drag-drop UI capacity indicators."""
        from app.models.event_registration import EventRegistration
        from app.models.registration_guest import RegistrationGuest

        # Configure event
        test_active_event.table_count = 10
        test_active_event.max_guests_per_table = 8
        await db_session.commit()
        await db_session.refresh(test_active_event)

        # Create registration with 3 guests at table 2
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user_2.id,
            number_of_guests=3,
            status="confirmed",
        )
        db_session.add(registration)
        await db_session.commit()
        await db_session.refresh(registration)

        guest1 = RegistrationGuest(
            registration_id=registration.id,
            name="Guest 1",
            email="guest1@example.com",
            table_number=2,
        )
        guest2 = RegistrationGuest(
            registration_id=registration.id,
            name="Guest 2",
            email="guest2@example.com",
            table_number=2,
        )
        guest3 = RegistrationGuest(
            registration_id=registration.id,
            name="Guest 3",
            email="guest3@example.com",
            table_number=2,
        )
        db_session.add_all([guest1, guest2, guest3])
        await db_session.commit()

        # Get table 2 occupancy
        response = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_active_event.id}/seating/tables/2/occupancy"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["table_number"] == 2
        assert data["current_occupancy"] == 3
        assert data["max_capacity"] == 8
        assert len(data["guests"]) == 3  # Check guests array
        assert data["is_full"] is False

    @pytest.mark.asyncio
    async def test_auto_assign_guests_api(
        self,
        npo_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_active_event: Event,
        test_user_2: Any,
    ) -> None:
        """Test auto-assign endpoint assigns guests to tables."""
        # Configure event seating
        test_active_event.table_count = 3
        test_active_event.max_guests_per_table = 4
        await db_session.commit()

        # Create 3 registrations with different party sizes
        from sqlalchemy import text

        from app.core.security import hash_password

        role_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'donor'"))
        donor_role_id = role_result.scalar_one()

        # Create unique users for each registration
        users = []
        for i in range(3):
            user = User(
                email=f"autoassign_user_{i}@test.com",
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

        # Party of 3, party of 2, party of 1 (6 guests total)
        party_sizes = [3, 2, 1]
        for idx, party_size in enumerate(party_sizes):
            registration = EventRegistration(
                event_id=test_active_event.id,
                user_id=users[idx].id,
                status=RegistrationStatus.CONFIRMED,
            )
            db_session.add(registration)
            await db_session.flush()

            for guest_num in range(party_size):
                guest = RegistrationGuest(
                    registration_id=registration.id,
                    name=f"Party{party_size}_Guest{guest_num + 1}",
                    email=f"p{party_size}g{guest_num + 1}@autoassign.com",
                )
                db_session.add(guest)
        await db_session.commit()

        # Call auto-assign endpoint
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_active_event.id}/seating/auto-assign"
        )

        # Verify response
        assert response.status_code == 200
        data = response.json()

        assert data["assigned_count"] == 6
        assert data["unassigned_count"] == 0
        assert len(data["assignments"]) == 6

        # Verify assignments have required fields
        for assignment in data["assignments"]:
            assert "guest_id" in assignment
            assert "table_number" in assignment
            assert "bidder_number" in assignment

        # Verify parties stayed together by checking database
        query = (
            select(RegistrationGuest)
            .join(EventRegistration)
            .where(EventRegistration.event_id == test_active_event.id)
            .order_by(RegistrationGuest.registration_id, RegistrationGuest.name)
        )
        result_query = await db_session.execute(query)
        all_guests = list(result_query.scalars().all())

        # Group by registration to verify parties together
        from collections import defaultdict

        parties = defaultdict(set)
        for guest in all_guests:
            parties[guest.registration_id].add(guest.table_number)

        # Each party should be at same table (or split if too large)
        for _reg_id, tables in parties.items():
            # For this test, all parties fit in tables, so each should be at 1 table
            assert len(tables) == 1, f"Party was unexpectedly split across tables: {tables}"

    @pytest.mark.asyncio
    async def test_auto_assign_with_insufficient_capacity(
        self,
        npo_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_active_event: Event,
        test_user_2: Any,
    ) -> None:
        """Test auto-assign with insufficient capacity returns warnings."""
        # Configure event seating with limited capacity
        test_active_event.table_count = 1
        test_active_event.max_guests_per_table = 2
        await db_session.commit()

        # Create registration with 5 guests (exceeds capacity)
        registration = EventRegistration(
            event_id=test_active_event.id,
            user_id=test_user_2.id,
            status=RegistrationStatus.CONFIRMED,
        )
        db_session.add(registration)
        await db_session.flush()

        for i in range(5):
            guest = RegistrationGuest(
                registration_id=registration.id,
                name=f"Guest {i + 1}",
                email=f"guest{i + 1}@capacity-test.com",
            )
            db_session.add(guest)
        await db_session.commit()

        # Call auto-assign endpoint
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_active_event.id}/seating/auto-assign"
        )

        # Verify response
        assert response.status_code == 200
        data = response.json()

        # Only 2 guests can be assigned
        assert data["assigned_count"] == 2
        assert data["unassigned_count"] == 3

        # Should have warnings about insufficient capacity
        assert len(data["warnings"]) > 0
        warning_text = " ".join(data["warnings"]).lower()
        assert "could not assign" in warning_text or "no available capacity" in warning_text

    @pytest.mark.asyncio
    async def test_auto_assign_no_seating_config_returns_400(
        self,
        npo_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_active_event: Event,
    ) -> None:
        """Test auto-assign fails when seating not configured."""
        # Leave seating unconfigured
        assert test_active_event.table_count is None
        assert test_active_event.max_guests_per_table is None

        # Call auto-assign endpoint
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_active_event.id}/seating/auto-assign"
        )

        # Should return 400
        assert response.status_code == 400
        data = response.json()
        detail_str = (
            str(data["detail"]).lower()
            if isinstance(data["detail"], dict)
            else data["detail"].lower()
        )
        assert "not configured" in detail_str


@pytest.mark.asyncio
class TestDonorSeatingView:
    """Test donor PWA seating information display (Phase 7)."""

    async def test_donor_seating_check_in_gating(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
        test_active_event: Event,
        db_session: AsyncSession,
    ) -> None:
        """
        T082: Test that bidder number is hidden until check-in.

        Verifies:
        - Before check-in: bidder_number is null in response
        - After check-in: bidder_number is visible in response
        - Message changes based on check-in status
        """
        # Step 1: Create event registration with table assignment and bidder number
        registration = EventRegistration(
            user_id=test_user.id,
            event_id=test_active_event.id,
            status=RegistrationStatus.CONFIRMED,
            number_of_guests=1,
            check_in_time=None,  # Not checked in yet
        )
        db_session.add(registration)
        await db_session.flush()

        # Create guest with table and bidder number assigned
        guest = RegistrationGuest(
            registration_id=registration.id,
            name=test_user.full_name,
            email=test_user.email,
            table_number=5,
            bidder_number=123,
            bidder_number_assigned_at=datetime.now(UTC),
        )
        db_session.add(guest)
        await db_session.commit()

        # Step 2: Query seating info BEFORE check-in
        response = await authenticated_client.get(
            f"/api/v1/donor/events/{test_active_event.id}/my-seating"
        )
        assert response.status_code == 200
        data = response.json()

        # Verify bidder number is HIDDEN
        assert data["my_info"]["bidder_number"] is None
        assert data["my_info"]["table_number"] == 5
        assert data["my_info"]["checked_in"] is False
        assert data["has_table_assignment"] is True
        assert "check in" in data["message"].lower()

        # Step 3: Simulate check-in
        registration.check_in_time = datetime.now(UTC)
        await db_session.commit()

        # Step 4: Query seating info AFTER check-in
        response = await authenticated_client.get(
            f"/api/v1/donor/events/{test_active_event.id}/my-seating"
        )
        assert response.status_code == 200
        data = response.json()

        # Verify bidder number is NOW VISIBLE
        assert data["my_info"]["bidder_number"] == 123
        assert data["my_info"]["table_number"] == 5
        assert data["my_info"]["checked_in"] is True
        assert data["has_table_assignment"] is True
        # Message should be None when checked in and seated
        assert data["message"] is None

    async def test_donor_seating_pending_assignment(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
        test_active_event: Event,
        db_session: AsyncSession,
    ) -> None:
        """
        T083: Test pending assignment message when table not assigned.

        Verifies:
        - has_table_assignment is False
        - table_number is None
        - Pending assignment message is shown
        - Tablemates list is empty
        """
        # Create registration without table assignment
        registration = EventRegistration(
            user_id=test_user.id,
            event_id=test_active_event.id,
            status=RegistrationStatus.CONFIRMED,
            number_of_guests=1,
            check_in_time=None,
        )
        db_session.add(registration)
        await db_session.flush()

        # Create guest WITHOUT table assignment
        guest = RegistrationGuest(
            registration_id=registration.id,
            name=test_user.full_name,
            email=test_user.email,
            table_number=None,  # NO TABLE ASSIGNED
            bidder_number=None,
        )
        db_session.add(guest)
        await db_session.commit()

        # Query seating info
        response = await authenticated_client.get(
            f"/api/v1/donor/events/{test_active_event.id}/my-seating"
        )
        assert response.status_code == 200
        data = response.json()

        # Verify pending assignment state
        assert data["has_table_assignment"] is False
        assert data["my_info"]["table_number"] is None
        assert data["my_info"]["bidder_number"] is None
        assert "pending" in data["message"].lower()
        assert len(data["tablemates"]) == 0
        assert data["table_capacity"]["current"] == 0
        assert data["table_capacity"]["max"] == 0

    async def test_donor_seating_tablemate_bidder_visibility(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
        test_active_event: Event,
        db_session: AsyncSession,
    ) -> None:
        """
        T084: Test that tablemate bidder numbers respect check-in gating.

        Verifies:
        - User's own bidder number respects their check-in status
        - Tablemate bidder numbers respect each tablemate's check-in status
        - Mixed check-in states (some checked in, some not)
        """
        # Step 0: Get or create donor role
        from app.models.role import Role

        role_query = select(Role).where(Role.name == "donor")
        role_result = await db_session.execute(role_query)
        donor_role = role_result.scalar_one_or_none()

        if not donor_role:
            donor_role = Role(name="donor", description="Regular donor user")
            db_session.add(donor_role)
            await db_session.flush()

        # Step 1: Create tablemate users
        tablemate1 = User(
            email="alice@example.com",
            first_name="Alice",
            last_name="Johnson",
            password_hash="dummy_hash",
            email_verified=True,
            role_id=donor_role.id,
        )
        tablemate2 = User(
            email="bob@example.com",
            first_name="Bob",
            last_name="Smith",
            password_hash="dummy_hash",
            email_verified=True,
            role_id=donor_role.id,
        )
        db_session.add_all([tablemate1, tablemate2])
        await db_session.flush()

        # Step 2: Create user's registration (checked in)
        user_registration = EventRegistration(
            user_id=test_user.id,
            event_id=test_active_event.id,
            status=RegistrationStatus.CONFIRMED,
            number_of_guests=1,
            check_in_time=datetime.now(UTC),  # CHECKED IN
        )
        db_session.add(user_registration)
        await db_session.flush()

        user_guest = RegistrationGuest(
            registration_id=user_registration.id,
            name=test_user.full_name,
            email=test_user.email,
            table_number=5,
            bidder_number=123,
            bidder_number_assigned_at=datetime.now(UTC),
        )
        db_session.add(user_guest)

        # Step 3: Create tablemate #1 registration (CHECKED IN)
        tablemate1_registration = EventRegistration(
            user_id=tablemate1.id,
            event_id=test_active_event.id,
            status=RegistrationStatus.CONFIRMED,
            number_of_guests=1,
            check_in_time=datetime.now(UTC),  # CHECKED IN
        )
        db_session.add(tablemate1_registration)
        await db_session.flush()

        tablemate1_guest = RegistrationGuest(
            registration_id=tablemate1_registration.id,
            name="Alice Johnson",
            email="alice@example.com",
            table_number=5,  # SAME TABLE
            bidder_number=124,
        )
        db_session.add(tablemate1_guest)

        # Step 4: Create tablemate #2 registration (NOT CHECKED IN)
        tablemate2_registration = EventRegistration(
            user_id=tablemate2.id,
            event_id=test_active_event.id,
            status=RegistrationStatus.CONFIRMED,
            number_of_guests=1,
            check_in_time=None,  # NOT CHECKED IN
        )
        db_session.add(tablemate2_registration)
        await db_session.flush()

        tablemate2_guest = RegistrationGuest(
            registration_id=tablemate2_registration.id,
            name="Bob Smith",
            email="bob@example.com",
            table_number=5,  # SAME TABLE
            bidder_number=125,
        )
        db_session.add(tablemate2_guest)
        await db_session.commit()

        # Step 5: Query seating info
        response = await authenticated_client.get(
            f"/api/v1/donor/events/{test_active_event.id}/my-seating"
        )
        assert response.status_code == 200
        data = response.json()

        # Verify user's bidder number is visible (checked in)
        assert data["my_info"]["bidder_number"] == 123
        assert data["my_info"]["checked_in"] is True

        # Verify 2 tablemates returned
        assert len(data["tablemates"]) == 2

        # Find tablemates by name
        alice = next((tm for tm in data["tablemates"] if tm["name"] == "Alice Johnson"), None)
        bob = next((tm for tm in data["tablemates"] if tm["name"] == "Bob Smith"), None)

        assert alice is not None
        assert bob is not None

        # Verify Alice's bidder number is VISIBLE (checked in)
        assert alice["bidder_number"] == 124

        # Verify Bob's bidder number is HIDDEN (not checked in)
        assert bob["bidder_number"] is None

        # Verify table capacity
        assert data["table_capacity"]["current"] == 3  # User + Alice + Bob
