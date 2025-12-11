"""Integration tests for event lifecycle workflows."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestEventLifecycle:
    """Test complete event lifecycle workflows."""

    async def test_complete_event_lifecycle(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test full workflow: create → update → publish → close."""
        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        # Step 1: Create event
        create_payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Lifecycle Test Event",
            "event_datetime": future_datetime,
            "timezone": "America/New_York",
            "venue_name": "Initial Venue",
            "description": "Initial description",
        }

        create_response = await npo_admin_client.post("/api/v1/events", json=create_payload)
        assert create_response.status_code == 201
        event_data = create_response.json()
        event_id = event_data["id"]

        # Verify initial state
        assert event_data["status"] == "draft"
        assert event_data["version"] == 1
        assert event_data["name"] == "Lifecycle Test Event"
        assert event_data["venue_name"] == "Initial Venue"

        # Step 2: Update event
        update_payload = {
            "name": "Updated Lifecycle Event",
            "venue_name": "Updated Venue",
            "description": "Updated description with more details",
            "version": event_data["version"],
        }

        update_response = await npo_admin_client.patch(
            f"/api/v1/events/{event_id}",
            json=update_payload,
        )
        assert update_response.status_code == 200
        event_data = update_response.json()

        # Verify updates applied
        assert event_data["name"] == "Updated Lifecycle Event"
        assert event_data["venue_name"] == "Updated Venue"
        assert event_data["description"] == "Updated description with more details"
        assert event_data["version"] == 2  # Version incremented
        assert event_data["status"] == "draft"  # Still draft

        # Step 3: Publish event
        publish_response = await npo_admin_client.post(f"/api/v1/events/{event_id}/publish")
        assert publish_response.status_code == 200
        event_data = publish_response.json()

        # Verify status changed
        assert event_data["status"] == "active"

        # Step 4: Verify event is publicly accessible
        public_response = await npo_admin_client.get(f"/api/v1/events/public/{event_data['slug']}")
        assert public_response.status_code == 200
        public_data = public_response.json()
        assert public_data["id"] == event_id
        assert public_data["status"] == "active"

        # Step 5: Close event
        close_response = await npo_admin_client.post(f"/api/v1/events/{event_id}/close")
        assert close_response.status_code == 200
        event_data = close_response.json()

        # Verify final state
        assert event_data["status"] == "closed"

        # Verify database state
        from sqlalchemy import select

        from app.models.event import Event

        stmt = select(Event).where(Event.id == event_id)
        result = await db_session.execute(stmt)
        db_event = result.scalar_one()

        assert db_event.status.value == "closed"
        assert db_event.version == 4  # Version: 1 (create) + 1 (update) + 1 (publish) + 1 (close)
        assert db_event.name == "Updated Lifecycle Event"

    async def test_draft_to_active_to_closed_transitions(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test state transitions are enforced correctly."""
        event_id = str(test_event.id)

        # Initial state: DRAFT
        assert test_event.status.value == "draft"

        # Cannot close draft event
        close_response = await npo_admin_client.post(f"/api/v1/events/{event_id}/close")
        assert close_response.status_code == 400

        # Publish to make ACTIVE
        publish_response = await npo_admin_client.post(f"/api/v1/events/{event_id}/publish")
        assert publish_response.status_code == 200
        await db_session.refresh(test_event)
        assert test_event.status.value == "active"

        # Cannot publish again
        republish_response = await npo_admin_client.post(f"/api/v1/events/{event_id}/publish")
        assert republish_response.status_code == 400

        # Can close active event
        close_response = await npo_admin_client.post(f"/api/v1/events/{event_id}/close")
        assert close_response.status_code == 200
        await db_session.refresh(test_event)
        assert test_event.status.value == "closed"

        # Cannot close again
        reclose_response = await npo_admin_client.post(f"/api/v1/events/{event_id}/close")
        assert reclose_response.status_code == 400

    async def test_event_with_media_and_links_lifecycle(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test event lifecycle with media and links (when endpoints are implemented)."""
        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        # Create event
        create_payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Event with Media",
            "event_datetime": future_datetime,
            "timezone": "America/New_York",
            "venue_name": "Media Venue",
        }

        create_response = await npo_admin_client.post("/api/v1/events", json=create_payload)
        assert create_response.status_code == 201
        event_data = create_response.json()
        event_id = event_data["id"]

        # Verify media/links arrays are empty initially
        assert event_data["media"] == []
        assert event_data["links"] == []
        assert event_data["food_options"] == []

        # TODO: Add media upload when endpoint is implemented
        # TODO: Add links when endpoint is implemented
        # TODO: Add food options when endpoint is implemented

        # Publish event
        publish_response = await npo_admin_client.post(f"/api/v1/events/{event_id}/publish")
        assert publish_response.status_code == 200

        # Verify event can be retrieved with nested data
        get_response = await npo_admin_client.get(f"/api/v1/events/{event_id}")
        assert get_response.status_code == 200
        event_data = get_response.json()
        assert "media" in event_data
        assert "links" in event_data
        assert "food_options" in event_data

    async def test_multiple_events_for_same_npo(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test creating and managing multiple events for same NPO."""
        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        # Create first event
        event1_payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "First Event",
            "event_datetime": future_datetime,
            "timezone": "America/New_York",
            "venue_name": "Venue 1",
        }
        event1_response = await npo_admin_client.post("/api/v1/events", json=event1_payload)
        assert event1_response.status_code == 201
        event1_id = event1_response.json()["id"]

        # Create second event
        event2_payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Second Event",
            "event_datetime": future_datetime,
            "timezone": "America/Los_Angeles",
            "venue_name": "Venue 2",
        }
        event2_response = await npo_admin_client.post("/api/v1/events", json=event2_payload)
        assert event2_response.status_code == 201
        event2_id = event2_response.json()["id"]

        # Publish first event
        await npo_admin_client.post(f"/api/v1/events/{event1_id}/publish")

        # List events for NPO
        list_response = await npo_admin_client.get(f"/api/v1/events?npo_id={test_approved_npo.id}")
        assert list_response.status_code == 200
        list_data = list_response.json()

        # Should have at least 2 events for this NPO
        npo_events = [e for e in list_data["items"] if e["npo_id"] == str(test_approved_npo.id)]
        assert len(npo_events) >= 2

        # Verify one is active, one is draft
        statuses = {e["status"] for e in npo_events if e["id"] in [event1_id, event2_id]}
        assert "active" in statuses
        assert "draft" in statuses

    async def test_event_update_preserves_relationships(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test updating event preserves NPO relationship and created_by."""
        original_npo_id = str(test_event.npo_id)
        original_created_by = str(test_event.created_by)
        event_id = str(test_event.id)

        # Update event name
        update_payload = {
            "name": "New Name After Update",
            "version": test_event.version,
        }

        update_response = await npo_admin_client.patch(
            f"/api/v1/events/{event_id}",
            json=update_payload,
        )
        assert update_response.status_code == 200

        # Verify NPO relationship unchanged
        get_response = await npo_admin_client.get(f"/api/v1/events/{event_id}")
        event_data = get_response.json()

        assert event_data["npo_id"] == original_npo_id

        # Verify database state
        await db_session.refresh(test_event)
        assert str(test_event.npo_id) == original_npo_id
        assert str(test_event.created_by) == original_created_by
        assert test_event.name == "New Name After Update"
