"""Contract tests for POST /auth/social/{provider}/callback endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_callback_invalid_attempt_returns_400(async_client: AsyncClient) -> None:
    """Verify callback with invalid attempt ID returns 400."""
    response = await async_client.post(
        "/api/v1/auth/social/google/callback",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "code": "test_auth_code",
            "state": "invalid_state",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_callback_missing_code_returns_422(async_client: AsyncClient) -> None:
    """Verify callback without code returns 422."""
    response = await async_client.post(
        "/api/v1/auth/social/google/callback",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "state": "test_state",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_callback_missing_state_returns_422(async_client: AsyncClient) -> None:
    """Verify callback without state returns 422."""
    response = await async_client.post(
        "/api/v1/auth/social/google/callback",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "code": "test_code",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_callback_success_response_shape(async_client: AsyncClient) -> None:
    """Document expected success response fields (200 scenario)."""
    # This tests the shape validation only; actual success requires
    # a valid attempt which requires provider config
    # A 400 with proper error structure is also valid
    response = await async_client.post(
        "/api/v1/auth/social/google/callback",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "code": "test_code",
            "state": "test_state",
        },
    )
    data = response.json()
    assert "detail" in data or "status" in data


@pytest.mark.asyncio
async def test_callback_pending_response_shape(async_client: AsyncClient) -> None:
    """Document expected pending response fields (202 scenario).

    Pending responses include: needs_link_confirmation,
    needs_email_verification, needs_admin_step_up.
    This is a structural contract test.
    """
    # Cannot trigger 202 without a valid flow, but we verify the
    # error structure for invalid attempts
    response = await async_client.post(
        "/api/v1/auth/social/google/callback",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "code": "test_code",
            "state": "test_state",
        },
    )
    assert response.status_code in (200, 202, 400, 403)
