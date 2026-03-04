"""Integration tests for social auth failure and cancellation scenarios."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_callback_with_invalid_state_returns_400(
    async_client: AsyncClient,
) -> None:
    """Callback with tampered/invalid state should fail."""
    response = await async_client.post(
        "/api/v1/auth/social/google/callback",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "code": "test_code",
            "state": "tampered_state_value",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_callback_with_expired_attempt_returns_400(
    async_client: AsyncClient,
) -> None:
    """Callback referencing a non-existent attempt should fail."""
    response = await async_client.post(
        "/api/v1/auth/social/google/callback",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000099",
            "code": "test_code",
            "state": "expired_state",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_callback_with_empty_code_returns_400(
    async_client: AsyncClient,
) -> None:
    """Callback with empty code should be handled gracefully."""
    response = await async_client.post(
        "/api/v1/auth/social/google/callback",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "code": "",
            "state": "some_state",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_unsupported_provider_returns_422(
    async_client: AsyncClient,
) -> None:
    """Request to unsupported provider should return 422."""
    response = await async_client.post(
        "/api/v1/auth/social/twitter/start",
        json={"app_context": "donor_pwa", "redirect_uri": "http://localhost:3000/callback"},
    )
    assert response.status_code == 422
