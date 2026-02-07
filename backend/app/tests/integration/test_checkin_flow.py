"""Integration tests for event check-in feature.

Tests the complete check-in workflow:
- Guest search by name, email, phone
- Check-in with audit logging
- Check-out with required reason
- Dashboard with totals and checked-in list
- Donor information updates
- Seating assignment with uniqueness validation
- Ticket transfer with audit logging

This tests the integration of:
- API endpoints (admin_checkin.py)
- Services (checkin_service.py)
- Models (CheckinRecord, TicketTransferRecord, RegistrationGuest)
- Database (PostgreSQL)
"""

import pytest
from datetime import datetime, UTC
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest
from app.models.user import User
from app.models.checkin_record import CheckinRecord, CheckinAction
from app.models.ticket_transfer_record import TicketTransferRecord


class TestCheckinFlow:
    """Integration tests for check-in feature."""

    @pytest.mark.asyncio
    async def test_guest_search_by_name(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        admin_auth_headers: dict,
    ) -> None:
        """Test searching for guests by name."""
        # Create test event
        event = Event(
            name="Test Event",
            npo_id=admin_auth_headers.get("npo_id"),
            starts_at=datetime(2026, 12, 31, 18, 0, 0, tzinfo=UTC),
            ends_at=datetime(2026, 12, 31, 23, 0, 0, tzinfo=UTC),
            slug="test-event-checkin",
            status="published",
        )
        db_session.add(event)
        await db_session.flush()

        # Create test user and registration
        user = User(
            email="testguest@example.com",
            hashed_password="dummy",
            full_name="John Doe",
            is_active=True,
            email_verified=True,
        )
        db_session.add(user)
        await db_session.flush()

        registration = EventRegistration(
            user_id=user.id,
            event_id=event.id,
            status="confirmed",
            number_of_guests=1,
        )
        db_session.add(registration)
        await db_session.flush()

        guest = RegistrationGuest(
            registration_id=registration.id,
            user_id=user.id,
            name="John Doe",
            email="testguest@example.com",
            phone="555-1234",
            checked_in=False,
        )
        db_session.add(guest)
        await db_session.commit()

        # Search for guest by name
        response = await async_client.get(
            f"/api/v1/admin/events/{event.id}/checkins/search?q=John",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) >= 1
        assert any(r["donor_name"] == "John Doe" for r in data["results"])

    @pytest.mark.asyncio
    async def test_checkin_with_audit_log(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        admin_auth_headers: dict,
    ) -> None:
        """Test checking in a guest creates audit log."""
        # Create test event and guest
        event = Event(
            name="Test Event Audit",
            npo_id=admin_auth_headers.get("npo_id"),
            starts_at=datetime(2026, 12, 31, 18, 0, 0, tzinfo=UTC),
            ends_at=datetime(2026, 12, 31, 23, 0, 0, tzinfo=UTC),
            slug="test-event-audit",
            status="published",
        )
        db_session.add(event)
        await db_session.flush()

        user = User(
            email="auditguest@example.com",
            hashed_password="dummy",
            full_name="Jane Smith",
            is_active=True,
            email_verified=True,
        )
        db_session.add(user)
        await db_session.flush()

        registration = EventRegistration(
            user_id=user.id,
            event_id=event.id,
            status="confirmed",
        )
        db_session.add(registration)
        await db_session.flush()

        guest = RegistrationGuest(
            registration_id=registration.id,
            user_id=user.id,
            name="Jane Smith",
            checked_in=False,
        )
        db_session.add(guest)
        await db_session.commit()

        # Check in the guest
        response = await async_client.post(
            f"/api/v1/admin/events/{event.id}/checkins/{guest.id}/check-in",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "checked_in"
        assert data["checked_in_at"] is not None

        # Verify audit log was created
        result = await db_session.execute(
            select(CheckinRecord).where(
                CheckinRecord.registration_id == guest.id,
                CheckinRecord.action == CheckinAction.CHECK_IN,
            )
        )
        audit_record = result.scalars().first()
        assert audit_record is not None
        assert audit_record.event_id == event.id

    @pytest.mark.asyncio
    async def test_checkout_requires_reason(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        admin_auth_headers: dict,
    ) -> None:
        """Test checking out requires a reason."""
        # Create checked-in guest
        event = Event(
            name="Test Event Checkout",
            npo_id=admin_auth_headers.get("npo_id"),
            starts_at=datetime(2026, 12, 31, 18, 0, 0, tzinfo=UTC),
            ends_at=datetime(2026, 12, 31, 23, 0, 0, tzinfo=UTC),
            slug="test-event-checkout",
            status="published",
        )
        db_session.add(event)
        await db_session.flush()

        user = User(
            email="checkoutguest@example.com",
            hashed_password="dummy",
            full_name="Bob Johnson",
            is_active=True,
            email_verified=True,
        )
        db_session.add(user)
        await db_session.flush()

        registration = EventRegistration(
            user_id=user.id,
            event_id=event.id,
            status="confirmed",
        )
        db_session.add(registration)
        await db_session.flush()

        guest = RegistrationGuest(
            registration_id=registration.id,
            user_id=user.id,
            name="Bob Johnson",
            checked_in=True,
            checked_in_at=datetime.now(UTC),
        )
        db_session.add(guest)
        await db_session.commit()

        # Try to check out without reason
        response = await async_client.post(
            f"/api/v1/admin/events/{event.id}/checkins/{guest.id}/check-out",
            headers=admin_auth_headers,
            json={},
        )

        assert response.status_code == 422  # Validation error

        # Check out with reason
        response = await async_client.post(
            f"/api/v1/admin/events/{event.id}/checkins/{guest.id}/check-out",
            headers=admin_auth_headers,
            json={"reason": "Guest left early due to emergency"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "not_checked_in"

        # Verify audit log with reason
        result = await db_session.execute(
            select(CheckinRecord).where(
                CheckinRecord.registration_id == guest.id,
                CheckinRecord.action == CheckinAction.CHECK_OUT,
            )
        )
        audit_record = result.scalars().first()
        assert audit_record is not None
        assert audit_record.reason == "Guest left early due to emergency"

    @pytest.mark.asyncio
    async def test_dashboard_totals(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        admin_auth_headers: dict,
    ) -> None:
        """Test dashboard returns correct totals."""
        # Create event with multiple guests
        event = Event(
            name="Test Event Dashboard",
            npo_id=admin_auth_headers.get("npo_id"),
            starts_at=datetime(2026, 12, 31, 18, 0, 0, tzinfo=UTC),
            ends_at=datetime(2026, 12, 31, 23, 0, 0, tzinfo=UTC),
            slug="test-event-dashboard",
            status="published",
        )
        db_session.add(event)
        await db_session.flush()

        # Create 3 guests, 2 checked in
        for i in range(3):
            user = User(
                email=f"guest{i}@example.com",
                hashed_password="dummy",
                full_name=f"Guest {i}",
                is_active=True,
                email_verified=True,
            )
            db_session.add(user)
            await db_session.flush()

            registration = EventRegistration(
                user_id=user.id,
                event_id=event.id,
                status="confirmed",
            )
            db_session.add(registration)
            await db_session.flush()

            guest = RegistrationGuest(
                registration_id=registration.id,
                user_id=user.id,
                name=f"Guest {i}",
                checked_in=(i < 2),  # First 2 are checked in
                checked_in_at=datetime.now(UTC) if i < 2 else None,
            )
            db_session.add(guest)

        await db_session.commit()

        # Get dashboard
        response = await async_client.get(
            f"/api/v1/admin/events/{event.id}/checkins/dashboard",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_registered"] == 3
        assert data["total_checked_in"] == 2
        assert len(data["checked_in"]) == 2

    @pytest.mark.asyncio
    async def test_bidder_number_uniqueness(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        admin_auth_headers: dict,
    ) -> None:
        """Test bidder number uniqueness within event."""
        # Create event with 2 guests
        event = Event(
            name="Test Event Uniqueness",
            npo_id=admin_auth_headers.get("npo_id"),
            starts_at=datetime(2026, 12, 31, 18, 0, 0, tzinfo=UTC),
            ends_at=datetime(2026, 12, 31, 23, 0, 0, tzinfo=UTC),
            slug="test-event-uniqueness",
            status="published",
        )
        db_session.add(event)
        await db_session.flush()

        guests = []
        for i in range(2):
            user = User(
                email=f"unique{i}@example.com",
                hashed_password="dummy",
                full_name=f"Unique Guest {i}",
                is_active=True,
                email_verified=True,
            )
            db_session.add(user)
            await db_session.flush()

            registration = EventRegistration(
                user_id=user.id,
                event_id=event.id,
                status="confirmed",
            )
            db_session.add(registration)
            await db_session.flush()

            guest = RegistrationGuest(
                registration_id=registration.id,
                user_id=user.id,
                name=f"Unique Guest {i}",
            )
            db_session.add(guest)
            await db_session.flush()
            guests.append(guest)

        await db_session.commit()

        # Assign bidder number to first guest
        response = await async_client.patch(
            f"/api/v1/admin/events/{event.id}/checkins/{guests[0].id}/seating",
            headers=admin_auth_headers,
            json={"bidder_number": 100},
        )
        assert response.status_code == 200

        # Try to assign same bidder number to second guest
        response = await async_client.patch(
            f"/api/v1/admin/events/{event.id}/checkins/{guests[1].id}/seating",
            headers=admin_auth_headers,
            json={"bidder_number": 100},
        )
        assert response.status_code == 409  # Conflict
        assert "already assigned" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_ticket_transfer_with_audit(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        admin_auth_headers: dict,
    ) -> None:
        """Test ticket transfer creates audit log."""
        # Create event and 2 users
        event = Event(
            name="Test Event Transfer",
            npo_id=admin_auth_headers.get("npo_id"),
            starts_at=datetime(2026, 12, 31, 18, 0, 0, tzinfo=UTC),
            ends_at=datetime(2026, 12, 31, 23, 0, 0, tzinfo=UTC),
            slug="test-event-transfer",
            status="published",
        )
        db_session.add(event)
        await db_session.flush()

        user1 = User(
            email="user1@example.com",
            hashed_password="dummy",
            full_name="User One",
            is_active=True,
            email_verified=True,
        )
        user2 = User(
            email="user2@example.com",
            hashed_password="dummy",
            full_name="User Two",
            is_active=True,
            email_verified=True,
        )
        db_session.add_all([user1, user2])
        await db_session.flush()

        registration = EventRegistration(
            user_id=user1.id,
            event_id=event.id,
            status="confirmed",
        )
        db_session.add(registration)
        await db_session.flush()

        guest = RegistrationGuest(
            registration_id=registration.id,
            user_id=user1.id,
            name="User One",
        )
        db_session.add(guest)
        await db_session.commit()

        # Transfer ticket
        response = await async_client.post(
            f"/api/v1/admin/events/{event.id}/checkins/{guest.id}/transfer",
            headers=admin_auth_headers,
            json={
                "to_donor_id": str(user2.id),
                "note": "Transferred due to scheduling conflict",
            },
        )

        assert response.status_code == 200

        # Verify transfer audit log
        result = await db_session.execute(
            select(TicketTransferRecord).where(
                TicketTransferRecord.registration_id == guest.id,
                TicketTransferRecord.to_donor_id == user2.id,
            )
        )
        transfer_record = result.scalars().first()
        assert transfer_record is not None
        assert transfer_record.from_donor_id == user1.id
        assert transfer_record.note == "Transferred due to scheduling conflict"
