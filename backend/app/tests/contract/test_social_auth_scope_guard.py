"""Scope guard: ensure no provider-management endpoints exist.

Social auth only exposes sign-in flows. No CRUD for managing
provider configurations should be present.
"""

import pytest
from httpx import AsyncClient

FORBIDDEN_PATHS = [
    "/api/v1/auth/social/providers/create",
    "/api/v1/auth/social/providers/google",
    "/api/v1/auth/social/providers/google/config",
    "/api/v1/auth/social/providers/delete",
    "/api/v1/social/providers",
    "/api/v1/admin/social-providers",
]


@pytest.mark.asyncio
@pytest.mark.parametrize("path", FORBIDDEN_PATHS)
async def test_no_provider_management_endpoint(async_client: AsyncClient, path: str) -> None:
    """Ensure provider management endpoints do not exist."""
    for method in [async_client.get, async_client.post, async_client.put, async_client.delete]:
        response = await method(path)
        assert response.status_code in (
            404,
            405,
        ), f"{method.__name__.upper()} {path} returned {response.status_code}, expected 404/405"
