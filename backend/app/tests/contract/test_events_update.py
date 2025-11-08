"""Contract tests for PATCH /api/v1/events/{id} - Event update endpoint."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestEventUpdate:
    """Test PATCH /api/v1/events/{id} endpoint contract."""

    async def test_update_event_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test successful event update returns 200 with updated data."""
        initial_version = test_event.version  # Capture version before update

        payload = {
            "name": "Updated Event Name",
            "description": "Updated description with new details.",
            "venue_name": "New Venue Location",
            "version": initial_version,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}",
            json=payload,
        )

        assert response.status_code == 200
        data = response.json()

        # Validate updates applied
        assert data["id"] == str(test_event.id)
        assert data["name"] == "Updated Event Name"
        assert data["description"] == "Updated description with new details."
        assert data["venue_name"] == "New Venue Location"
        assert data["version"] == initial_version + 1  # Version incremented

        # Verify database persistence
        await db_session.refresh(test_event)
        assert test_event.name == "Updated Event Name"
        assert test_event.version == initial_version + 1

    async def test_update_event_partial_fields(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test updating only specific fields leaves others unchanged."""
        original_name = test_event.name
        original_description = test_event.description

        payload = {
            "venue_name": "Updated Venue Only",
            "version": test_event.version,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}",
            json=payload,
        )

        assert response.status_code == 200
        data = response.json()

        # Only venue_name should change
        assert data["venue_name"] == "Updated Venue Only"
        assert data["name"] == original_name
        assert data["description"] == original_description

    async def test_update_event_optimistic_locking_conflict(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test update fails with 409 when version number is stale."""
        # Simulate concurrent edit by using old version number
        payload = {
            "name": "Concurrent Update",
            "version": test_event.version - 1,  # Stale version
        }

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}",
            json=payload,
        )

        assert response.status_code == 409
        data = response.json()
        assert "detail" in data
        assert "concurrent" in data["detail"].lower() or "version" in data["detail"].lower()

    async def test_update_event_missing_version(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test update fails with 422 when version field is missing."""
        payload = {
            "name": "Update Without Version",
            # Missing version field
        }

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}",
            json=payload,
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    async def test_update_event_invalid_timezone(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test update fails with 422 for invalid timezone."""
        payload = {
            "timezone": "Invalid/Timezone",
            "version": test_event.version,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}",
            json=payload,
        )

        assert response.status_code == 422

    async def test_update_event_invalid_colors(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test update fails with 422 for invalid hex colors."""
        payload = {
            "primary_color": "not-hex",
            "secondary_color": "#12",
            "version": test_event.version,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}",
            json=payload,
        )

        assert response.status_code == 422

    async def test_update_event_past_datetime(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test update fails with 400 for past event_datetime."""
        past_datetime = (datetime.now(UTC) - timedelta(days=1)).isoformat()

        payload = {
            "event_datetime": past_datetime,
            "version": test_event.version,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}",
            json=payload,
        )

        assert response.status_code == 400
        data = response.json()
        assert "future" in data["detail"].lower()

    async def test_update_event_not_found(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Test update fails with 404 for non-existent event."""
        import uuid

        payload = {
            "name": "Update Non-existent",
            "version": 1,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/events/{uuid.uuid4()}",
            json=payload,
        )

        assert response.status_code == 404

    async def test_update_event_unauthenticated(
        self,
        client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test update fails with 401 for unauthenticated requests."""
        payload = {
            "name": "Unauthorized Update",
            "version": test_event.version,
        }

        response = await client.patch(
            f"/api/v1/events/{test_event.id}",
            json=payload,
        )

        assert response.status_code == 401

    async def test_update_event_colors(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test updating event colors with valid hex values."""
        payload = {
            "primary_color": "#ff0000",
            "secondary_color": "#00ff00",
            "version": test_event.version,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}",
            json=payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["primary_color"] == "#ff0000"
        assert data["secondary_color"] == "#00ff00"

    async def test_update_event_datetime_and_timezone(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test updating event datetime and timezone together."""
        future_datetime = (datetime.now(UTC) + timedelta(days=60)).isoformat()

        payload = {
            "event_datetime": future_datetime,
            "timezone": "America/Los_Angeles",
            "version": test_event.version,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}",
            json=payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["event_datetime"] == future_datetime
        assert data["timezone"] == "America/Los_Angeles"
