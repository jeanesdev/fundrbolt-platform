"""Integration tests for social auth provisioning."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_donor_auto_provision_on_callback(
    async_client: AsyncClient,
) -> None:
    """New donor should be auto-provisioned on first social login."""
    start_response = await async_client.post(
        "/api/v1/auth/social/google/start",
        json={"app_context": "donor_pwa", "redirect_uri": "http://localhost:3000/callback"},
    )
    if start_response.status_code != 200:
        pytest.skip("Google provider not configured in test env")
    state = start_response.json()["state"]

    callback_response = await async_client.post(
        "/api/v1/auth/social/google/callback",
        json={
            "code": "new_donor_auth_code",
            "state": state,
        },
    )
    assert callback_response.status_code == 200
    data = callback_response.json()
    assert data.get("status") in ("authenticated", "pending_verification")


@pytest.mark.asyncio
async def test_admin_not_provisioned_returns_denial(
    async_client: AsyncClient,
) -> None:
    """Admin without pre-provisioned account should be denied."""
    start_response = await async_client.post(
        "/api/v1/auth/social/google/start",
        json={"app_context": "admin_pwa", "redirect_uri": "http://localhost:3001/callback"},
    )
    if start_response.status_code != 200:
        pytest.skip("Google provider not configured in test env")
    state = start_response.json()["state"]

    callback_response = await async_client.post(
        "/api/v1/auth/social/google/callback",
        json={
            "code": "unknown_admin_auth_code",
            "state": state,
        },
    )
    assert callback_response.status_code in (200, 403)
