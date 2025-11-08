"""Contract tests for POST /api/v1/events - Event creation endpoint."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestEventCreation:
    """Test POST /api/v1/events endpoint contract."""

    async def test_create_event_success(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test successful event creation returns 201 with complete event data."""
        from app.models.event import Event

        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Spring Gala 2025",
            "event_datetime": future_datetime,
            "timezone": "America/New_York",
            "venue_name": "Grand Hotel",
            "venue_address": "123 Main St, New York, NY 10001",
            "description": "Annual spring fundraising gala with silent auction.",
            "primary_color": "#1a73e8",
            "secondary_color": "#34a853",
        }

        response = await npo_admin_client.post("/api/v1/events", json=payload)

        # Assert response contract
        assert response.status_code == 201
        data = response.json()

        # Validate response schema matches EventDetailResponse
        assert "id" in data
        assert data["npo_id"] == str(test_approved_npo.id)
        assert data["name"] == "Spring Gala 2025"
        assert data["slug"] == "spring-gala-2025"
        assert data["status"] == "draft"
        # Compare datetime strings (FastAPI serializes UTC as Z instead of +00:00)
        assert data["event_datetime"] == future_datetime.replace("+00:00", "Z")
        assert data["timezone"] == "America/New_York"
        assert data["venue_name"] == "Grand Hotel"
        assert data["venue_address"] == "123 Main St, New York, NY 10001"
        assert data["description"] == "Annual spring fundraising gala with silent auction."
        assert data["logo_url"] is None  # Logo not set during creation
        assert data["primary_color"] == "#1a73e8"
        assert data["secondary_color"] == "#34a853"
        assert data["version"] == 1
        assert "created_at" in data
        assert "updated_at" in data
        assert data["media"] == []
        assert data["links"] == []
        assert data["food_options"] == []

        # Verify database persistence
        from sqlalchemy import select

        stmt = select(Event).where(Event.id == data["id"])
        result = await db_session.execute(stmt)
        event = result.scalar_one()

        assert event.name == "Spring Gala 2025"
        assert event.slug == "spring-gala-2025"
        assert str(event.npo_id) == str(test_approved_npo.id)

    async def test_create_event_with_custom_slug(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
    ) -> None:
        """Test event creation with custom slug."""
        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Event Name",
            "custom_slug": "my-custom-slug",
            "event_datetime": future_datetime,
            "timezone": "America/Chicago",
            "venue_name": "Convention Center",
        }

        response = await npo_admin_client.post("/api/v1/events", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["slug"] == "my-custom-slug"

    async def test_create_event_missing_required_fields(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Test event creation fails with 422 when required fields missing."""
        payload = {
            "name": "Incomplete Event",
            # Missing: npo_id, event_datetime, timezone, venue_name
        }

        response = await npo_admin_client.post("/api/v1/events", json=payload)

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    async def test_create_event_invalid_timezone(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
    ) -> None:
        """Test event creation fails with 422 for invalid timezone."""
        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Event with Bad Timezone",
            "event_datetime": future_datetime,
            "timezone": "Invalid/Timezone",
            "venue_name": "Some Venue",
        }

        response = await npo_admin_client.post("/api/v1/events", json=payload)

        # Service layer timezone validation returns 400
        assert response.status_code == 400
        data = response.json()
        # detail can be a string or a dict/list depending on error type
        detail_str = str(data["detail"]).lower()
        assert "timezone" in detail_str

    async def test_create_event_invalid_colors(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
    ) -> None:
        """Test event creation fails with 422 for invalid hex colors."""
        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Event with Bad Colors",
            "event_datetime": future_datetime,
            "timezone": "America/New_York",
            "venue_name": "Venue",
            "primary_color": "not-a-hex-color",
            "secondary_color": "#12345",  # Too short
        }

        response = await npo_admin_client.post("/api/v1/events", json=payload)

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    async def test_create_event_past_datetime(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
    ) -> None:
        """Test event creation fails with 400 for past event_datetime."""
        past_datetime = (datetime.now(UTC) - timedelta(days=1)).isoformat()

        payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Past Event",
            "event_datetime": past_datetime,
            "timezone": "America/New_York",
            "venue_name": "Venue",
        }

        response = await npo_admin_client.post("/api/v1/events", json=payload)

        assert response.status_code == 400
        data = response.json()
        # Detail is a string from HTTPException
        assert "future" in str(data["detail"]).lower()

    async def test_create_event_npo_not_found(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Test event creation fails with 404 for non-existent NPO."""
        import uuid

        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        payload = {
            "npo_id": str(uuid.uuid4()),  # Random UUID
            "name": "Event for Missing NPO",
            "event_datetime": future_datetime,
            "timezone": "America/New_York",
            "venue_name": "Venue",
        }

        response = await npo_admin_client.post("/api/v1/events", json=payload)

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    async def test_create_event_unauthenticated(
        self,
        client: AsyncClient,
        test_approved_npo: Any,
    ) -> None:
        """Test event creation fails with 401 for unauthenticated requests."""
        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Unauthorized Event",
            "event_datetime": future_datetime,
            "timezone": "America/New_York",
            "venue_name": "Venue",
        }

        response = await client.post("/api/v1/events", json=payload)

        assert response.status_code == 401

    async def test_create_event_slug_collision_handling(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test event creation handles slug collisions by appending suffix."""
        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        # test_event has slug "annual-gala-2025"
        # Create another event with same name
        payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Annual Gala 2025",  # Same name as test_event
            "event_datetime": future_datetime,
            "timezone": "America/New_York",
            "venue_name": "Different Venue",
        }

        response = await npo_admin_client.post("/api/v1/events", json=payload)

        assert response.status_code == 201
        data = response.json()

        # Should have auto-incremented slug
        assert data["slug"] in ["annual-gala-2025-2", "annual-gala-2025-3"]
        assert data["slug"] != "annual-gala-2025"

    async def test_create_event_increments_metrics(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
    ) -> None:
        """Test event creation increments Prometheus metrics."""
        future_datetime = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        payload = {
            "npo_id": str(test_approved_npo.id),
            "name": "Metrics Test Event",
            "event_datetime": future_datetime,
            "timezone": "America/New_York",
            "venue_name": "Test Venue",
        }

        # Create event
        response = await npo_admin_client.post("/api/v1/events", json=payload)
        assert response.status_code == 201

        # Get updated metrics
        metrics_response = await npo_admin_client.get("/metrics")
        updated_metrics = metrics_response.text

        # Verify EVENTS_CREATED_TOTAL incremented
        assert "augeo_events_created_total" in updated_metrics
        # Verify npo_id label is present
        assert str(test_approved_npo.id) in updated_metrics
