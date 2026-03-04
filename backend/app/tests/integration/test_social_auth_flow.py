"""Integration test for social sign-in baseline flow."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_social_auth_flow_providers_available(async_client: AsyncClient) -> None:
    """Verify social providers endpoint is accessible and returns valid data."""
    response = await async_client.get(
        "/api/v1/auth/social/providers", params={"app_context": "donor_pwa"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["app_context"] == "donor_pwa"
    assert isinstance(data["providers"], list)


@pytest.mark.asyncio
async def test_social_auth_flow_start_and_callback_invalid(
    async_client: AsyncClient,
) -> None:
    """Verify callback with nonexistent attempt returns error (not crash)."""
    response = await async_client.post(
        "/api/v1/auth/social/google/callback",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "code": "dummy_code",
            "state": "dummy_state",
        },
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert data["detail"]["code"] == "SOCIAL_AUTH_CALLBACK_FAILED"


@pytest.mark.asyncio
async def test_social_auth_admin_step_up_invalid(async_client: AsyncClient) -> None:
    """Verify admin step-up with invalid token returns error."""
    response = await async_client.post(
        "/api/v1/auth/social/admin-step-up",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "step_up_token": "invalid_token",
        },
    )
    assert response.status_code in (401, 400)
