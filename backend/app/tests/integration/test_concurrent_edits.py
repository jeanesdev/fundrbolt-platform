"""Integration tests for concurrent event edits and optimistic locking."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestConcurrentEdits:
    """Test concurrent edit scenarios with optimistic locking."""

    async def test_concurrent_update_version_conflict(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test concurrent updates fail with 409 when version is stale."""
        event_id = str(test_event.id)
        current_version = test_event.version

        # User A gets the event (version 1)
        # User B gets the event (version 1)

        # User A updates successfully
        update_a_payload = {
            "name": "User A Update",
            "version": current_version,
        }
        response_a = await npo_admin_client.patch(
            f"/api/v1/events/{event_id}",
            json=update_a_payload,
        )
        assert response_a.status_code == 200
        data_a = response_a.json()
        assert data_a["version"] == current_version + 1

        # User B tries to update with stale version
        update_b_payload = {
            "name": "User B Update",
            "version": current_version,  # Stale version
        }
        response_b = await npo_admin_client.patch(
            f"/api/v1/events/{event_id}",
            json=update_b_payload,
        )

        # Should fail with 409 Conflict
        assert response_b.status_code == 409
        data_b = response_b.json()
        assert "detail" in data_b

        # Verify User A's update persisted
        await db_session.refresh(test_event)
        assert test_event.name == "User A Update"
        assert test_event.version == current_version + 1

    async def test_retry_after_version_conflict(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test client can retry after getting fresh version on 409."""
        event_id = str(test_event.id)
        current_version = test_event.version

        # First update succeeds
        update_1_payload = {
            "description": "First update",
            "version": current_version,
        }
        response_1 = await npo_admin_client.patch(
            f"/api/v1/events/{event_id}",
            json=update_1_payload,
        )
        assert response_1.status_code == 200
        assert response_1.json()["version"] == current_version + 1

        # Second update with stale version fails
        update_2_payload = {
            "description": "Second update with stale version",
            "version": current_version,  # Stale
        }
        response_2 = await npo_admin_client.patch(
            f"/api/v1/events/{event_id}",
            json=update_2_payload,
        )
        assert response_2.status_code == 409

        # Client fetches fresh event
        get_response = await npo_admin_client.get(f"/api/v1/events/{event_id}")
        assert get_response.status_code == 200
        fresh_event = get_response.json()
        fresh_version = fresh_event["version"]

        # Retry with fresh version succeeds
        update_3_payload = {
            "description": "Retry with fresh version",
            "version": fresh_version,
        }
        response_3 = await npo_admin_client.patch(
            f"/api/v1/events/{event_id}",
            json=update_3_payload,
        )
        assert response_3.status_code == 200
        assert response_3.json()["version"] == fresh_version + 1
        assert response_3.json()["description"] == "Retry with fresh version"

    async def test_multiple_sequential_updates_increment_version(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test version increments correctly through multiple updates."""
        event_id = str(test_event.id)
        current_version = test_event.version

        # Update 1
        update_1 = {"name": "Update 1", "version": current_version}
        response_1 = await npo_admin_client.patch(f"/api/v1/events/{event_id}", json=update_1)
        assert response_1.status_code == 200
        assert response_1.json()["version"] == current_version + 1

        # Update 2
        update_2 = {"name": "Update 2", "version": current_version + 1}
        response_2 = await npo_admin_client.patch(f"/api/v1/events/{event_id}", json=update_2)
        assert response_2.status_code == 200
        assert response_2.json()["version"] == current_version + 2

        # Update 3
        update_3 = {"name": "Update 3", "version": current_version + 2}
        response_3 = await npo_admin_client.patch(f"/api/v1/events/{event_id}", json=update_3)
        assert response_3.status_code == 200
        assert response_3.json()["version"] == current_version + 3

        # Verify final state
        await db_session.refresh(test_event)
        assert test_event.version == current_version + 3
        assert test_event.name == "Update 3"

    async def test_publish_does_not_require_version(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test publish endpoint does not use optimistic locking."""
        event_id = str(test_event.id)

        # Publish does not require version in request
        response = await npo_admin_client.post(f"/api/v1/events/{event_id}/publish")
        assert response.status_code == 200

    async def test_close_does_not_require_version(
        self,
        npo_admin_client: AsyncClient,
        test_active_event: Any,
    ) -> None:
        """Test close endpoint does not use optimistic locking."""
        event_id = str(test_active_event.id)

        # Close does not require version in request
        response = await npo_admin_client.post(f"/api/v1/events/{event_id}/close")
        assert response.status_code == 200

    async def test_version_persists_through_status_changes(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test version number is preserved when status changes."""
        event_id = str(test_event.id)
        initial_version = test_event.version

        # Update to increment version
        update_payload = {"name": "Updated Before Publish", "version": initial_version}
        update_response = await npo_admin_client.patch(
            f"/api/v1/events/{event_id}",
            json=update_payload,
        )
        assert update_response.status_code == 200
        assert update_response.json()["version"] == initial_version + 1

        # Publish (does not change version)
        publish_response = await npo_admin_client.post(f"/api/v1/events/{event_id}/publish")
        assert publish_response.status_code == 200

        # Verify version unchanged by publish
        get_response = await npo_admin_client.get(f"/api/v1/events/{event_id}")
        assert get_response.json()["version"] == initial_version + 1

        # Close (does not change version)
        close_response = await npo_admin_client.post(f"/api/v1/events/{event_id}/close")
        assert close_response.status_code == 200

        # Verify version still unchanged
        await db_session.refresh(test_event)
        assert test_event.version == initial_version + 1

    async def test_conflict_with_detailed_error_message(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test 409 response includes helpful error message."""
        event_id = str(test_event.id)
        current_version = test_event.version

        # First update
        await npo_admin_client.patch(
            f"/api/v1/events/{event_id}",
            json={"name": "Update 1", "version": current_version},
        )

        # Second update with stale version
        response = await npo_admin_client.patch(
            f"/api/v1/events/{event_id}",
            json={"name": "Update 2", "version": current_version},
        )

        assert response.status_code == 409
        data = response.json()
        assert "detail" in data

        # Error message should mention conflict or version
        detail_lower = data["detail"].lower()
        assert (
            "concurrent" in detail_lower or "version" in detail_lower or "conflict" in detail_lower
        )
