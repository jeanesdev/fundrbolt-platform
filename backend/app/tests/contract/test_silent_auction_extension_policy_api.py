"""Contract tests for event-level silent auction extension policy API."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestSilentAuctionExtensionPolicyAPI:
    async def test_get_policy_returns_defaults(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        response = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/silent-auction/extension-policy"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["event_id"] == str(test_event.id)
        assert data["auto_extension_enabled"] is True
        assert data["trigger_window_minutes"] == 3
        assert data["extension_duration_minutes"] == 3
        assert data["max_total_extension_minutes"] == 30

    async def test_update_policy_accepts_valid_bounds(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        response = await npo_admin_client.put(
            f"/api/v1/admin/events/{test_event.id}/silent-auction/extension-policy",
            json={
                "auto_extension_enabled": False,
                "extension_duration_minutes": 10,
                "max_total_extension_minutes": 60,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["auto_extension_enabled"] is False
        assert data["extension_duration_minutes"] == 10
        assert data["max_total_extension_minutes"] == 60

    async def test_update_policy_rejects_out_of_range_values(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        response = await npo_admin_client.put(
            f"/api/v1/admin/events/{test_event.id}/silent-auction/extension-policy",
            json={
                "auto_extension_enabled": True,
                "extension_duration_minutes": 11,
                "max_total_extension_minutes": 61,
            },
        )

        assert response.status_code == 422
