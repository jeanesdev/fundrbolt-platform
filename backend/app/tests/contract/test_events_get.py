"""Contract tests for GET /api/v1/events/{id} and GET /api/v1/events/public/{slug}."""

from typing import Any

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestEventRetrieval:
    """Test GET /api/v1/events/{id} endpoint contract."""

    async def test_get_event_by_id_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test successful event retrieval by ID returns 200 with complete data."""
        response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}")

        assert response.status_code == 200
        data = response.json()

        # Validate response schema matches EventDetailResponse
        assert data["id"] == str(test_event.id)
        assert data["npo_id"] == str(test_event.npo_id)
        assert data["name"] == test_event.name
        assert data["slug"] == test_event.slug
        assert data["status"] == test_event.status.value
        assert data["timezone"] == test_event.timezone
        assert data["venue_name"] == test_event.venue_name
        assert data["venue_address"] == test_event.venue_address
        assert data["description"] == test_event.description
        assert data["logo_url"] == test_event.logo_url
        assert data["primary_color"] == test_event.primary_color
        assert data["secondary_color"] == test_event.secondary_color
        assert data["version"] == test_event.version
        assert "created_at" in data
        assert "updated_at" in data
        assert "media" in data
        assert "links" in data
        assert "food_options" in data
        assert isinstance(data["media"], list)
        assert isinstance(data["links"], list)
        assert isinstance(data["food_options"], list)

    async def test_get_event_not_found(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Test event retrieval returns 404 for non-existent event."""
        import uuid

        response = await npo_admin_client.get(f"/api/v1/events/{uuid.uuid4()}")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    async def test_get_event_invalid_uuid(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Test event retrieval returns 422 for invalid UUID format."""
        response = await npo_admin_client.get("/api/v1/events/not-a-uuid")

        assert response.status_code == 422

    async def test_get_event_unauthenticated(
        self,
        client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test event retrieval fails with 401 for unauthenticated requests."""
        response = await client.get(f"/api/v1/events/{test_event.id}")

        assert response.status_code == 401


@pytest.mark.asyncio
class TestPublicEventRetrieval:
    """Test GET /api/v1/events/public/{slug} endpoint contract."""

    async def test_get_public_event_success(
        self,
        client: AsyncClient,
        test_active_event: Any,
    ) -> None:
        """Test public event retrieval by slug returns 200 (no auth required)."""
        response = await client.get(f"/api/v1/events/public/{test_active_event.slug}")

        assert response.status_code == 200
        data = response.json()

        # Validate response schema
        assert data["id"] == str(test_active_event.id)
        assert data["slug"] == test_active_event.slug
        assert data["status"] == "active"
        assert data["name"] == test_active_event.name
        assert "media" in data
        assert "links" in data
        assert "food_options" in data

    async def test_get_public_event_draft_not_accessible(
        self,
        client: AsyncClient,
        test_event: Any,  # DRAFT status
    ) -> None:
        """Test public endpoint returns 404 for draft events."""
        response = await client.get(f"/api/v1/events/public/{test_event.slug}")

        # Should return 404 because only ACTIVE events are public
        assert response.status_code == 404

    async def test_get_public_event_not_found(
        self,
        client: AsyncClient,
    ) -> None:
        """Test public event retrieval returns 404 for non-existent slug."""
        response = await client.get("/api/v1/events/public/non-existent-slug")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    async def test_get_public_event_no_auth_required(
        self,
        client: AsyncClient,
        test_active_event: Any,
    ) -> None:
        """Test public event retrieval works without authentication."""
        # Explicitly remove any auth headers
        if "Authorization" in client.headers:
            del client.headers["Authorization"]

        response = await client.get(f"/api/v1/events/public/{test_active_event.slug}")

        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == test_active_event.slug
