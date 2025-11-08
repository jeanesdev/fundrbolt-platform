"""Contract tests for POST /api/v1/events/{id}/publish and /close endpoints."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestEventPublish:
    """Test POST /api/v1/events/{id}/publish endpoint contract."""

    async def test_publish_event_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test publishing event changes status from DRAFT to ACTIVE."""
        response = await npo_admin_client.post(f"/api/v1/events/{test_event.id}/publish")

        assert response.status_code == 200
        data = response.json()

        # Validate status changed
        assert data["id"] == str(test_event.id)
        assert data["status"] == "active"

        # Verify database persistence
        await db_session.refresh(test_event)
        assert test_event.status.value == "active"

    async def test_publish_event_already_active(
        self,
        npo_admin_client: AsyncClient,
        test_active_event: Any,
    ) -> None:
        """Test publishing already active event returns 400."""
        response = await npo_admin_client.post(f"/api/v1/events/{test_active_event.id}/publish")

        # Should fail because event is already active
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data

    async def test_publish_event_not_found(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Test publish fails with 404 for non-existent event."""
        import uuid

        response = await npo_admin_client.post(f"/api/v1/events/{uuid.uuid4()}/publish")

        assert response.status_code == 404

    async def test_publish_event_unauthenticated(
        self,
        client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test publish fails with 401 for unauthenticated requests."""
        response = await client.post(f"/api/v1/events/{test_event.id}/publish")

        assert response.status_code == 401

    async def test_publish_event_increments_metrics(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test publishing event increments EVENTS_PUBLISHED_TOTAL metric."""
        # Publish event
        response = await npo_admin_client.post(f"/api/v1/events/{test_event.id}/publish")
        assert response.status_code == 200

        # Check metrics
        metrics_response = await npo_admin_client.get("/metrics")
        metrics = metrics_response.text

        assert "augeo_events_published_total" in metrics


@pytest.mark.asyncio
class TestEventClose:
    """Test POST /api/v1/events/{id}/close endpoint contract."""

    async def test_close_event_success(
        self,
        npo_admin_client: AsyncClient,
        test_active_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test closing active event changes status to CLOSED."""
        response = await npo_admin_client.post(f"/api/v1/events/{test_active_event.id}/close")

        assert response.status_code == 200
        data = response.json()

        # Validate status changed
        assert data["id"] == str(test_active_event.id)
        assert data["status"] == "closed"

        # Verify database persistence
        await db_session.refresh(test_active_event)
        assert test_active_event.status.value == "closed"

    async def test_close_event_draft_fails(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,  # DRAFT status
    ) -> None:
        """Test closing draft event returns 400."""
        response = await npo_admin_client.post(f"/api/v1/events/{test_event.id}/close")

        # Should fail because event must be active to close
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data

    async def test_close_event_already_closed(
        self,
        npo_admin_client: AsyncClient,
        test_active_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test closing already closed event returns 400."""
        from app.models.event import EventStatus

        # First close the event
        test_active_event.status = EventStatus.CLOSED
        await db_session.commit()

        # Try to close again
        response = await npo_admin_client.post(f"/api/v1/events/{test_active_event.id}/close")

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data

    async def test_close_event_not_found(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Test close fails with 404 for non-existent event."""
        import uuid

        response = await npo_admin_client.post(f"/api/v1/events/{uuid.uuid4()}/close")

        assert response.status_code == 404

    async def test_close_event_unauthenticated(
        self,
        client: AsyncClient,
        test_active_event: Any,
    ) -> None:
        """Test close fails with 401 for unauthenticated requests."""
        response = await client.post(f"/api/v1/events/{test_active_event.id}/close")

        assert response.status_code == 401

    async def test_close_event_increments_metrics(
        self,
        npo_admin_client: AsyncClient,
        test_active_event: Any,
    ) -> None:
        """Test closing event increments EVENTS_CLOSED_TOTAL metric with manual label."""
        # Close event
        response = await npo_admin_client.post(f"/api/v1/events/{test_active_event.id}/close")
        assert response.status_code == 200

        # Check metrics
        metrics_response = await npo_admin_client.get("/metrics")
        metrics = metrics_response.text

        assert "augeo_events_closed_total" in metrics
        # Manual closure should have closure_type="manual" label
        assert 'closure_type="manual"' in metrics
