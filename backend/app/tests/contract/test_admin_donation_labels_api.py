"""Contract tests for admin donation labels API."""

from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestDonationLabelContract:
    """Contract tests for donation label management endpoints."""

    async def test_create_get_update_retire_label_lifecycle(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Create, read, update, retire, and list labels for an event."""
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donation-labels",
            json={"name": "Last Hero"},
        )
        assert create_response.status_code == 201
        created = create_response.json()
        label_id = created["id"]
        assert created["event_id"] == str(test_event.id)
        assert created["name"] == "Last Hero"
        assert created["is_active"] is True

        get_response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/donation-labels/{label_id}"
        )
        assert get_response.status_code == 200
        assert get_response.json()["id"] == label_id

        update_response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/donation-labels/{label_id}",
            json={"name": "Coin Toss"},
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["name"] == "Coin Toss"
        assert updated["is_active"] is True

        retire_response = await npo_admin_client.delete(
            f"/api/v1/events/{test_event.id}/donation-labels/{label_id}"
        )
        assert retire_response.status_code == 200
        retired = retire_response.json()
        assert retired["is_active"] is False

        list_active_response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/donation-labels"
        )
        assert list_active_response.status_code == 200
        assert list_active_response.json()["items"] == []

        list_all_response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/donation-labels",
            params={"include_inactive": True},
        )
        assert list_all_response.status_code == 200
        all_items = list_all_response.json()["items"]
        assert len(all_items) == 1
        assert all_items[0]["id"] == label_id
        assert all_items[0]["is_active"] is False

    async def test_update_label_requires_at_least_one_field(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Reject empty patch payload for label update."""
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donation-labels",
            json={"name": "VIP"},
        )
        assert create_response.status_code == 201
        label_id = create_response.json()["id"]

        patch_response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/donation-labels/{label_id}",
            json={},
        )
        assert patch_response.status_code == 422
