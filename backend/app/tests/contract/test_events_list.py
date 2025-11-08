"""Contract tests for GET /api/v1/events - Event listing endpoint."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestEventListing:
    """Test GET /api/v1/events endpoint contract."""

    async def test_list_events_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_active_event: Any,
    ) -> None:
        """Test listing events returns paginated results."""
        response = await npo_admin_client.get("/api/v1/events")

        assert response.status_code == 200
        data = response.json()

        # Validate response schema matches EventListResponse
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert "total_pages" in data

        assert isinstance(data["items"], list)
        assert data["total"] >= 2  # At least test_event and test_active_event
        assert data["page"] == 1
        assert data["per_page"] == 20  # Default per_page

        # Validate item schema matches EventSummaryResponse
        if len(data["items"]) > 0:
            item = data["items"][0]
            assert "id" in item
            assert "npo_id" in item
            assert "name" in item
            assert "slug" in item
            assert "status" in item
            assert "event_datetime" in item
            assert "timezone" in item
            assert "venue_name" in item
            assert "logo_url" in item
            assert "created_at" in item
            assert "updated_at" in item

    async def test_list_events_pagination(
        self,
        npo_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Test event listing pagination with page and per_page parameters."""
        from app.models.event import Event, EventStatus

        # Create 5 events for pagination testing
        events = []
        for i in range(5):
            event = Event(
                npo_id=test_approved_npo.id,
                name=f"Event {i}",
                slug=f"event-{i}",
                status=EventStatus.DRAFT,
                event_datetime=datetime.now(UTC) + timedelta(days=i + 1),
                timezone="America/New_York",
                venue_name=f"Venue {i}",
                version=1,
                created_by_user_id=test_npo_admin_user.id,
                updated_by_user_id=test_npo_admin_user.id,
            )
            events.append(event)
        db_session.add_all(events)
        await db_session.commit()

        # Page 1 with 2 items per page
        response = await npo_admin_client.get("/api/v1/events?page=1&per_page=2")
        assert response.status_code == 200
        data = response.json()

        assert len(data["items"]) <= 2
        assert data["page"] == 1
        assert data["per_page"] == 2
        assert data["total"] >= 5

        # Page 2
        response = await npo_admin_client.get("/api/v1/events?page=2&per_page=2")
        assert response.status_code == 200
        data = response.json()

        assert data["page"] == 2
        assert data["per_page"] == 2

    async def test_list_events_filter_by_npo(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        test_event: Any,
    ) -> None:
        """Test filtering events by npo_id."""
        response = await npo_admin_client.get(f"/api/v1/events?npo_id={test_approved_npo.id}")

        assert response.status_code == 200
        data = response.json()

        # All returned events should belong to test_approved_npo
        for item in data["items"]:
            assert item["npo_id"] == str(test_approved_npo.id)

    async def test_list_events_filter_by_status(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,  # DRAFT
        test_active_event: Any,  # ACTIVE
    ) -> None:
        """Test filtering events by status."""
        # Filter for draft events
        response = await npo_admin_client.get("/api/v1/events?status=draft")

        assert response.status_code == 200
        data = response.json()

        # All returned events should have status=draft
        for item in data["items"]:
            assert item["status"] == "draft"

        # Filter for active events
        response = await npo_admin_client.get("/api/v1/events?status=active")

        assert response.status_code == 200
        data = response.json()

        # All returned events should have status=active
        for item in data["items"]:
            assert item["status"] == "active"

    async def test_list_events_filter_combined(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        test_event: Any,
    ) -> None:
        """Test filtering events by both npo_id and status."""
        response = await npo_admin_client.get(
            f"/api/v1/events?npo_id={test_approved_npo.id}&status=draft"
        )

        assert response.status_code == 200
        data = response.json()

        # All returned events should match both filters
        for item in data["items"]:
            assert item["npo_id"] == str(test_approved_npo.id)
            assert item["status"] == "draft"

    async def test_list_events_empty_result(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Test listing events with filters that return no results."""
        import uuid

        # Filter by non-existent NPO
        response = await npo_admin_client.get(f"/api/v1/events?npo_id={uuid.uuid4()}")

        assert response.status_code == 200
        data = response.json()

        assert data["items"] == []
        assert data["total"] == 0

    async def test_list_events_invalid_page(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Test listing with invalid page number."""
        response = await npo_admin_client.get("/api/v1/events?page=0")

        # Should return 422 for invalid page (must be >= 1)
        assert response.status_code == 422

    async def test_list_events_invalid_per_page(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Test listing with invalid per_page."""
        response = await npo_admin_client.get("/api/v1/events?per_page=0")

        # Should return 422 for invalid per_page (must be >= 1)
        assert response.status_code == 422

    async def test_list_events_unauthenticated(
        self,
        client: AsyncClient,
    ) -> None:
        """Test listing fails with 401 for unauthenticated requests."""
        response = await client.get("/api/v1/events")

        assert response.status_code == 401

    async def test_list_events_total_pages_calculation(
        self,
        npo_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Test total_pages is calculated correctly."""
        from app.models.event import Event, EventStatus

        # Create exactly 7 events
        events = []
        for i in range(7):
            event = Event(
                npo_id=test_approved_npo.id,
                name=f"Event {i}",
                slug=f"event-calc-{i}",
                status=EventStatus.DRAFT,
                event_datetime=datetime.now(UTC) + timedelta(days=i + 1),
                timezone="America/New_York",
                venue_name=f"Venue {i}",
                version=1,
                created_by_user_id=test_npo_admin_user.id,
                updated_by_user_id=test_npo_admin_user.id,
            )
            events.append(event)
        db_session.add_all(events)
        await db_session.commit()

        # Request with 3 per page (7 events / 3 per page = 3 pages)
        response = await npo_admin_client.get(
            f"/api/v1/events?npo_id={test_approved_npo.id}&per_page=3"
        )

        assert response.status_code == 200
        data = response.json()

        # Should have at least 7 events from this NPO
        assert data["total"] >= 7
        # With 3 per page, should be at least 3 pages
        assert data["total_pages"] >= 3
