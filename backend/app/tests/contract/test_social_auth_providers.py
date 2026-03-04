"""Contract tests for GET /auth/social/providers endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_providers_returns_provider_list(async_client: AsyncClient) -> None:
    """Verify provider listing returns expected structure."""
    response = await async_client.get(
        "/api/v1/auth/social/providers", params={"app_context": "donor_pwa"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "app_context" in data
    assert data["app_context"] == "donor_pwa"
    assert "providers" in data
    assert isinstance(data["providers"], list)


@pytest.mark.asyncio
async def test_list_providers_admin_context(async_client: AsyncClient) -> None:
    """Verify provider listing works for admin context."""
    response = await async_client.get(
        "/api/v1/auth/social/providers", params={"app_context": "admin_pwa"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["app_context"] == "admin_pwa"


@pytest.mark.asyncio
async def test_list_providers_invalid_context(async_client: AsyncClient) -> None:
    """Verify invalid app_context returns 422."""
    response = await async_client.get(
        "/api/v1/auth/social/providers", params={"app_context": "invalid"}
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_providers_has_expected_fields(async_client: AsyncClient) -> None:
    """Verify each provider has required fields."""
    response = await async_client.get(
        "/api/v1/auth/social/providers", params={"app_context": "donor_pwa"}
    )
    assert response.status_code == 200
    data = response.json()
    for provider in data["providers"]:
        assert "provider" in provider
        assert "display_name" in provider
        assert "enabled" in provider
        assert provider["provider"] in ["apple", "google", "facebook", "microsoft"]
