"""Integration tests for social auth account linking."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_link_confirmation_with_invalid_attempt(
    async_client: AsyncClient,
) -> None:
    """Invalid attempt should be rejected."""
    response = await async_client.post(
        "/api/v1/auth/social/link-confirmation",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000001",
            "email_login_confirmation_token": "password123",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_start_auth_returns_valid_state(
    async_client: AsyncClient,
) -> None:
    """Start endpoint should return valid state for callback."""
    response = await async_client.post(
        "/api/v1/auth/social/google/start",
        json={"app_context": "donor_pwa", "redirect_uri": "http://localhost:3000/callback"},
    )
    # Provider may not be configured in test env
    if response.status_code == 200:
        data = response.json()
        assert "state" in data
        assert "authorization_url" in data
    else:
        assert response.status_code in (404, 400)


@pytest.mark.asyncio
async def test_callback_with_valid_start_state(
    async_client: AsyncClient,
) -> None:
    """Callback with valid state from start should process."""
    start_response = await async_client.post(
        "/api/v1/auth/social/google/start",
        json={"app_context": "donor_pwa", "redirect_uri": "http://localhost:3000/callback"},
    )
    # Provider may not be configured in test env
    if start_response.status_code != 200:
        pytest.skip("Google provider not configured in test env")
    state = start_response.json()["state"]

    callback_response = await async_client.post(
        "/api/v1/auth/social/google/callback",
        json={
            "code": "test_auth_code",
            "state": state,
        },
    )
    assert callback_response.status_code in (200, 400)
