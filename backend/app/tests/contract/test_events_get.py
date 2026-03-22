"""Contract tests for GET /api/v1/events/{id} and GET /api/v1/events/public/{slug}."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


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

    async def test_list_public_events_success(
        self,
        client: AsyncClient,
        test_active_event: Any,
    ) -> None:
        """Test public event list returns active events without authentication."""
        response = await client.get("/api/v1/events/public", params={"page": 1, "per_page": 10})

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert data["page"] == 1
        assert data["per_page"] == 10
        assert any(item["id"] == str(test_active_event.id) for item in data["items"])

    async def test_list_public_events_prefers_tagged_logo_media(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_active_event: Any,
        test_npo_admin_user: Any,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test public event list uses tagged media for logo_url when available."""
        from app.models.event import (
            EventMedia,
            EventMediaStatus,
            EventMediaType,
            EventMediaUsageTag,
        )
        from app.services.media_service import MediaService

        monkeypatch.setattr(
            MediaService,
            "generate_read_sas_url",
            staticmethod(
                lambda blob_name, expiry_hours=24: (
                    f"https://teststorage.blob.core.windows.net/test-container/{blob_name}"
                    "?mock_sas_token=test"
                )
            ),
        )

        test_active_event.logo_url = None
        media = EventMedia(
            event_id=test_active_event.id,
            media_type=EventMediaType.IMAGE,
            usage_tag=EventMediaUsageTag.EVENT_LOGO,
            file_url=(
                "https://teststorage.blob.core.windows.net/npo-assets/"
                "events/test-event/test-logo.png"
            ),
            file_name="test-logo.png",
            file_type="image/png",
            mime_type="image/png",
            blob_name="events/test-event/test-logo.png",
            file_size=1024,
            display_order=0,
            status=EventMediaStatus.SCANNED,
            uploaded_by=test_npo_admin_user.id,
        )
        db_session.add(media)
        await db_session.commit()

        response = await client.get("/api/v1/events/public", params={"page": 1, "per_page": 10})

        assert response.status_code == 200
        data = response.json()
        event_summary = next(
            item for item in data["items"] if item["id"] == str(test_active_event.id)
        )
        assert event_summary["logo_url"] == (
            "https://teststorage.blob.core.windows.net/test-container/"
            "events/test-event/test-logo.png?mock_sas_token=test"
        )

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

    async def test_get_public_event_signs_media_urls(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_active_event: Any,
        test_npo_admin_user: Any,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test public event media URLs are returned as signed SAS URLs."""
        from app.models.event import (
            EventMedia,
            EventMediaStatus,
            EventMediaType,
            EventMediaUsageTag,
        )
        from app.services.media_service import MediaService

        monkeypatch.setattr(
            MediaService,
            "generate_read_sas_url",
            staticmethod(
                lambda blob_name, expiry_hours=24: (
                    f"https://teststorage.blob.core.windows.net/test-container/{blob_name}"
                    "?mock_sas_token=test"
                )
            ),
        )

        media = EventMedia(
            event_id=test_active_event.id,
            media_type=EventMediaType.IMAGE,
            usage_tag=EventMediaUsageTag.MAIN_EVENT_PAGE_HERO,
            file_url=(
                "https://teststorage.blob.core.windows.net/npo-assets/"
                "events/test-event/test-hero.jpg"
            ),
            file_name="test-hero.jpg",
            file_type="image/jpeg",
            mime_type="image/jpeg",
            blob_name="events/test-event/test-hero.jpg",
            file_size=1024,
            display_order=0,
            status=EventMediaStatus.SCANNED,
            uploaded_by=test_npo_admin_user.id,
        )
        db_session.add(media)
        await db_session.commit()

        response = await client.get(f"/api/v1/events/public/{test_active_event.slug}")

        assert response.status_code == 200
        data = response.json()
        hero_media = next(
            item for item in data["media"] if item["usage_tag"] == "main_event_page_hero"
        )
        assert hero_media["file_url"].startswith(
            "https://teststorage.blob.core.windows.net/test-container/events/test-event/test-hero.jpg?"
        )
        assert "mock_sas_token=test" in hero_media["file_url"]

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
