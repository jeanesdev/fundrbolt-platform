"""Contract tests for seating API endpoints."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest


@pytest.mark.asyncio
class TestSeatingEndpoints:
    """Test admin seating API endpoint contracts."""

    async def test_configure_event_seating_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test PATCH /admin/events/{event_id}/seating/config returns 200 with config."""
        payload = {
            "table_count": 15,
            "max_guests_per_table": 8,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/seating/config",
            json=payload,
        )

        # Assert response contract
        assert response.status_code == 200
        data = response.json()

        # Validate response schema matches EventSeatingConfigResponse
        assert "event_id" in data
        assert data["event_id"] == str(test_event.id)
        assert data["table_count"] == 15
        assert data["max_guests_per_table"] == 8
        assert data["total_capacity"] == 120  # 15 tables * 8 guests

        # Verify database persistence
        await db_session.refresh(test_event)
        assert test_event.table_count == 15
        assert test_event.max_guests_per_table == 8

    async def test_configure_event_seating_invalid_values(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test seating config validation rejects invalid values."""
        payload = {
            "table_count": 0,  # Invalid: must be > 0
            "max_guests_per_table": 8,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/seating/config",
            json=payload,
        )

        assert response.status_code == 400
        assert "must be greater than 0" in response.json()["detail"].lower()

    async def test_get_available_bidder_numbers_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test GET /admin/events/{event_id}/seating/bidder-numbers/available returns available numbers."""
        response = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/seating/bidder-numbers/available",
            params={"limit": 5},
        )

        # Assert response contract
        assert response.status_code == 200
        data = response.json()

        # Validate response schema matches AvailableBidderNumbersResponse
        assert "available_numbers" in data
        assert isinstance(data["available_numbers"], list)
        assert len(data["available_numbers"]) <= 5
        assert all(100 <= num <= 999 for num in data["available_numbers"])
        assert "total_available" in data
        assert isinstance(data["total_available"], int)

    async def test_assign_bidder_number_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test PATCH /admin/events/{event_id}/registrations/{registration_id}/bidder-number returns 200."""
        payload = {
            "bidder_number": 150,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/registrations/{test_registration.id}/bidder-number",
            json=payload,
        )

        # Assert response contract
        assert response.status_code == 200
        data = response.json()

        # Validate response schema matches BidderNumberAssignmentResponse
        assert "registration_id" in data
        assert data["registration_id"] == str(test_registration.id)
        assert data["bidder_number"] == 150
        assert "assigned_at" in data

        # Verify database persistence
        await db_session.refresh(test_registration)
        assert test_registration.bidder_number == 150
        assert test_registration.bidder_number_assigned_at is not None

    async def test_assign_bidder_number_duplicate(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test bidder number assignment rejects duplicate numbers."""
        # Assign bidder number to first registration
        test_registration.bidder_number = 200
        test_registration.bidder_number_assigned_at = datetime.now(UTC)
        await db_session.commit()

        # Create second registration
        second_user = await self._create_test_user(db_session, "second@example.com")
        second_registration = EventRegistration(
            event_id=test_event.id,
            user_id=second_user.id,
            status="confirmed",
            ticket_tier="general_admission",
            total_amount_cents=10000,
            currency="USD",
        )
        db_session.add(second_registration)
        await db_session.commit()

        # Try to assign same bidder number
        payload = {"bidder_number": 200}
        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/registrations/{second_registration.id}/bidder-number",
            json=payload,
        )

        assert response.status_code == 400
        assert "already assigned" in response.json()["detail"].lower()

    async def test_assign_table_number_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test PATCH /admin/events/{event_id}/registrations/{registration_id}/table returns 200."""
        # Configure event seating first
        test_event.table_count = 10
        test_event.max_guests_per_table = 8
        await db_session.commit()

        payload = {
            "table_number": 5,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/registrations/{test_registration.id}/table",
            json=payload,
        )

        # Assert response contract
        assert response.status_code == 200
        data = response.json()

        # Validate response schema matches TableAssignmentResponse
        assert "registration_id" in data
        assert data["registration_id"] == str(test_registration.id)
        assert data["table_number"] == 5
        assert "assigned_at" in data

        # Verify database persistence
        await db_session.refresh(test_registration)
        assert test_registration.table_number == 5
        assert test_registration.table_assigned_at is not None

    async def test_unassign_table_number_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test DELETE /admin/events/{event_id}/registrations/{registration_id}/table returns 200."""
        # Assign table first
        test_registration.table_number = 5
        test_registration.table_assigned_at = datetime.now(UTC)
        await db_session.commit()

        response = await npo_admin_client.delete(
            f"/api/v1/admin/events/{test_event.id}/registrations/{test_registration.id}/table"
        )

        # Assert response contract
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Table assignment removed"

        # Verify database persistence
        await db_session.refresh(test_registration)
        assert test_registration.table_number is None
        assert test_registration.table_assigned_at is None

    async def test_get_seating_guests_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test GET /admin/events/{event_id}/seating/guests returns paginated guest list."""
        # Add guest to registration
        guest = RegistrationGuest(
            registration_id=test_registration.id,
            name="John Doe",
            email="john@example.com",
        )
        db_session.add(guest)
        await db_session.commit()

        response = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/seating/guests",
            params={"page": 1, "per_page": 20},
        )

        # Assert response contract
        assert response.status_code == 200
        data = response.json()

        # Validate response schema matches GuestSeatingListResponse
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert "pages" in data

        # Check guest item schema
        assert len(data["items"]) > 0
        guest_item = data["items"][0]
        assert "guest_id" in guest_item
        assert "registration_id" in guest_item
        assert "name" in guest_item
        assert "email" in guest_item
        assert "table_number" in guest_item
        assert "bidder_number" in guest_item
        assert "is_guest_of_primary" in guest_item
        assert isinstance(guest_item["is_guest_of_primary"], bool)

    async def test_get_table_occupancy_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test GET /admin/events/{event_id}/seating/tables returns table occupancy data."""
        # Configure event and assign table
        test_event.table_count = 10
        test_event.max_guests_per_table = 8
        test_registration.table_number = 3
        await db_session.commit()

        response = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/seating/tables"
        )

        # Assert response contract
        assert response.status_code == 200
        data = response.json()

        # Validate response schema matches TableOccupancyResponse
        assert "tables" in data
        assert isinstance(data["tables"], list)
        assert len(data["tables"]) == 10  # All configured tables

        # Check table item schema
        table_item = data["tables"][0]
        assert "table_number" in table_item
        assert "guest_count" in table_item
        assert "capacity" in table_item
        assert "guests" in table_item
        assert isinstance(table_item["guests"], list)

        # Find table 3 (assigned)
        table_3 = next((t for t in data["tables"] if t["table_number"] == 3), None)
        assert table_3 is not None
        assert table_3["guest_count"] >= 1

    async def test_auto_assign_bidders_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
    ) -> None:
        """Test POST /admin/events/{event_id}/seating/auto-assign returns assignment summary."""
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/seating/auto-assign"
        )

        # Assert response contract
        assert response.status_code == 200
        data = response.json()

        # Validate response schema matches AutoAssignResponse
        assert "total_guests" in data
        assert "assigned_count" in data
        assert "skipped_count" in data
        assert isinstance(data["total_guests"], int)
        assert isinstance(data["assigned_count"], int)
        assert isinstance(data["skipped_count"], int)
        assert data["total_guests"] == data["assigned_count"] + data["skipped_count"]

    async def _create_test_user(self, db_session: AsyncSession, email: str) -> Any:
        """Helper to create test user."""
        from app.models.user import User

        user = User(
            email=email,
            first_name="Test",
            last_name="User",
            password_hash="$2b$12$test",
            role_name="donor",
            email_verified=True,
        )
        db_session.add(user)
        await db_session.commit()
        return user


@pytest.mark.asyncio
class TestDonorSeatingEndpoint:
    """Test donor seating API endpoint contract."""

    async def test_get_donor_seating_info_success(
        self,
        donor_client: AsyncClient,
        test_event: Any,
        test_donor: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test GET /donor/events/{event_id}/my-seating returns seating info with tablemates."""
        # Configure event and assign table
        test_event.table_count = 10
        test_event.max_guests_per_table = 8
        test_registration.table_number = 5
        test_registration.bidder_number = 150
        test_registration.check_in_time = datetime.now(UTC)
        await db_session.commit()

        response = await donor_client.get(
            f"/api/v1/donor/events/{test_event.id}/my-seating"
        )

        # Assert response contract
        assert response.status_code == 200
        data = response.json()

        # Validate response schema matches SeatingInfoResponse
        assert "table_number" in data
        assert data["table_number"] == 5
        assert "bidder_number" in data
        assert data["bidder_number"] == 150  # Visible after check-in
        assert "tablemates" in data
        assert isinstance(data["tablemates"], list)
        assert "capacity" in data
        assert data["capacity"] == 8
        assert "has_table_assignment" in data
        assert data["has_table_assignment"] is True
        assert "message" in data

    async def test_get_donor_seating_info_before_check_in(
        self,
        donor_client: AsyncClient,
        test_event: Any,
        test_donor: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test bidder number is hidden before check-in."""
        # Configure event and assign table without checking in
        test_event.table_count = 10
        test_event.max_guests_per_table = 8
        test_registration.table_number = 5
        test_registration.bidder_number = 150
        test_registration.check_in_time = None  # Not checked in
        await db_session.commit()

        response = await donor_client.get(
            f"/api/v1/donor/events/{test_event.id}/my-seating"
        )

        # Assert response contract
        assert response.status_code == 200
        data = response.json()

        # Bidder number should be None before check-in
        assert data["bidder_number"] is None
        assert "check in at the event" in data["message"].lower()

    async def test_get_donor_seating_info_no_assignment(
        self,
        donor_client: AsyncClient,
        test_event: Any,
        test_donor: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test response when donor has no table assignment."""
        # Ensure no table assignment
        test_registration.table_number = None
        await db_session.commit()

        response = await donor_client.get(
            f"/api/v1/donor/events/{test_event.id}/my-seating"
        )

        # Assert response contract
        assert response.status_code == 200
        data = response.json()

        assert data["table_number"] is None
        assert data["has_table_assignment"] is False
        assert "pending" in data["message"].lower() or "not yet assigned" in data["message"].lower()
        assert data["tablemates"] == []

    async def test_get_donor_seating_info_no_registration(
        self,
        donor_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test 404 when donor has no registration for event."""
        # Use non-existent event ID
        from uuid import uuid4
        fake_event_id = uuid4()

        response = await donor_client.get(
            f"/api/v1/donor/events/{fake_event_id}/my-seating"
        )

        assert response.status_code == 404
        assert "registration not found" in response.json()["detail"].lower()
