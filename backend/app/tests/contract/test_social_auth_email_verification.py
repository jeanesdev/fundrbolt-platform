"""Contract tests for POST /auth/social/email-verification endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_email_verification_missing_attempt_id_returns_422(
    async_client: AsyncClient,
) -> None:
    """Verify email verification without attempt_id returns 422."""
    response = await async_client.post(
        "/api/v1/auth/social/email-verification",
        json={
            "email": "test@example.com",
            "verification_token": "123456",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_email_verification_invalid_attempt_returns_400(
    async_client: AsyncClient,
) -> None:
    """Verify email verification with invalid attempt ID returns 400."""
    response = await async_client.post(
        "/api/v1/auth/social/email-verification",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "email": "test@example.com",
            "verification_token": "123456",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_email_verification_missing_token_returns_422(
    async_client: AsyncClient,
) -> None:
    """Verify email verification without token returns 422."""
    response = await async_client.post(
        "/api/v1/auth/social/email-verification",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "email": "test@example.com",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_email_verification_response_shape(
    async_client: AsyncClient,
) -> None:
    """Verify response includes expected fields."""
    response = await async_client.post(
        "/api/v1/auth/social/email-verification",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "email": "test@example.com",
            "verification_token": "123456",
        },
    )
    data = response.json()
    assert "detail" in data or "status" in data
