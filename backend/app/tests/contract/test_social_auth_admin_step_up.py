"""Contract tests for POST /auth/social/admin-step-up endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_step_up_missing_attempt_id_returns_422(
    async_client: AsyncClient,
) -> None:
    """Verify admin step-up without attempt_id returns 422."""
    response = await async_client.post(
        "/api/v1/auth/social/admin-step-up",
        json={"password": "admin_password"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_admin_step_up_invalid_attempt_returns_400(
    async_client: AsyncClient,
) -> None:
    """Verify admin step-up with invalid attempt ID returns 400."""
    response = await async_client.post(
        "/api/v1/auth/social/admin-step-up",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "step_up_token": "admin_password",
        },
    )
    assert response.status_code in (400, 401)


@pytest.mark.asyncio
async def test_admin_step_up_missing_password_returns_422(
    async_client: AsyncClient,
) -> None:
    """Verify admin step-up without step_up_token returns 422."""
    response = await async_client.post(
        "/api/v1/auth/social/admin-step-up",
        json={"attempt_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_admin_step_up_response_shape(
    async_client: AsyncClient,
) -> None:
    """Verify response includes expected fields."""
    response = await async_client.post(
        "/api/v1/auth/social/admin-step-up",
        json={
            "attempt_id": "00000000-0000-0000-0000-000000000000",
            "step_up_token": "admin_password",
        },
    )
    data = response.json()
    assert "detail" in data or "status" in data
