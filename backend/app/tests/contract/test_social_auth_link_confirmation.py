"""Contract tests for POST /auth/social/link-confirmation endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_link_confirmation_missing_attempt_id_returns_422(
    async_client: AsyncClient,
) -> None:
    """Verify link confirmation without attempt_id returns 422."""
    response = await async_client.post(
        "/api/v1/auth/social/link-confirmation",
        json={"email_login_confirmation_token": "password123"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_link_confirmation_invalid_attempt_returns_400(
    async_client: AsyncClient,
) -> None:
    """Verify link confirmation with invalid attempt ID returns 400."""
    response = await async_client.post(
        "/api/v1/auth/social/link-confirmation",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "email_login_confirmation_token": "password123",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_link_confirmation_missing_token_returns_422(
    async_client: AsyncClient,
) -> None:
    """Verify link confirmation without token returns 422."""
    response = await async_client.post(
        "/api/v1/auth/social/link-confirmation",
        json={"attempt_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_link_confirmation_response_shape(
    async_client: AsyncClient,
) -> None:
    """Verify response includes expected fields."""
    response = await async_client.post(
        "/api/v1/auth/social/link-confirmation",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "email_login_confirmation_token": "password123",
        },
    )
    data = response.json()
    assert "detail" in data or "status" in data
