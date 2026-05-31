"""Integration tests for representative RBAC route matrix."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_users_me_allows_authenticated_roles(
    async_client: AsyncClient,
    test_super_admin_token: str,
    test_donor_token: str,
) -> None:
    for token in (test_super_admin_token, test_donor_token):
        response = await async_client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200


async def test_dashboard_route_enforces_rbac(
    async_client: AsyncClient,
    test_active_event: Any,
    test_npo_admin_token: str,
    test_donor_token: str,
) -> None:
    admin_response = await async_client.get(
        f"/api/v1/admin/events/{test_active_event.id}/dashboard",
        headers={"Authorization": f"Bearer {test_npo_admin_token}"},
    )
    assert admin_response.status_code in {200, 400}

    donor_response = await async_client.get(
        f"/api/v1/admin/events/{test_active_event.id}/dashboard",
        headers={"Authorization": f"Bearer {test_donor_token}"},
    )
    assert donor_response.status_code == 403
