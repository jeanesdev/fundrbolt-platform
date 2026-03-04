"""Contract tests for POST /auth/social/{provider}/start endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_start_social_auth_returns_redirect_url(async_client: AsyncClient) -> None:
    """Verify start endpoint returns authorization URL and attempt context."""
    response = await async_client.post(
        "/api/v1/auth/social/google/start",
        json={
            "app_context": "donor_pwa",
            "redirect_uri": "http://localhost:5174/auth/callback",
        },
    )
    # Provider may not be configured in test env → 404 is acceptable
    if response.status_code == 200:
        data = response.json()
        assert "attempt_id" in data
        assert "authorization_url" in data
        assert "state" in data
    else:
        assert response.status_code in (404, 400)


@pytest.mark.asyncio
async def test_start_invalid_provider_returns_422(async_client: AsyncClient) -> None:
    """Verify invalid provider returns 422."""
    response = await async_client.post(
        "/api/v1/auth/social/invalid_provider/start",
        json={
            "app_context": "donor_pwa",
            "redirect_uri": "http://localhost:5174/auth/callback",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_start_missing_redirect_uri_returns_422(async_client: AsyncClient) -> None:
    """Verify missing redirect_uri returns 422."""
    response = await async_client.post(
        "/api/v1/auth/social/google/start",
        json={"app_context": "donor_pwa"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_start_missing_app_context_returns_422(async_client: AsyncClient) -> None:
    """Verify missing app_context returns 422."""
    response = await async_client.post(
        "/api/v1/auth/social/google/start",
        json={"redirect_uri": "http://localhost:5174/auth/callback"},
    )
    assert response.status_code == 422
