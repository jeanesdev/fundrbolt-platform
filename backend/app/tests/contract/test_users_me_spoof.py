"""Contract tests for super-admin user spoofing via X-Spoof-User-Id."""

import uuid

import pytest
from httpx import AsyncClient

from app.models.user import User


class TestUsersMeSpoofing:
    """Verify `/api/v1/users/me` spoofing behavior."""

    @pytest.mark.asyncio
    async def test_super_admin_can_spoof_user_profile(
        self,
        super_admin_client: AsyncClient,
        test_user: User,
    ) -> None:
        """Super admin receives spoofed user's profile when header is set."""
        response = await super_admin_client.get(
            "/api/v1/users/me",
            headers={"X-Spoof-User-Id": str(test_user.id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_user.id)
        assert data["email"] == test_user.email
        assert data["role"] == "donor"

    @pytest.mark.asyncio
    async def test_non_super_admin_cannot_spoof_user_profile(
        self,
        authenticated_client: AsyncClient,
        test_super_admin_user: User,
    ) -> None:
        """Non-super-admin users are blocked from spoofing."""
        response = await authenticated_client.get(
            "/api/v1/users/me",
            headers={"X-Spoof-User-Id": str(test_super_admin_user.id)},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_spoof_user_id_must_be_valid_uuid(
        self,
        super_admin_client: AsyncClient,
    ) -> None:
        """Invalid UUID format is rejected."""
        response = await super_admin_client.get(
            "/api/v1/users/me",
            headers={"X-Spoof-User-Id": "not-a-uuid"},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_spoof_user_id_must_exist(
        self,
        super_admin_client: AsyncClient,
    ) -> None:
        """Unknown UUID is rejected."""
        response = await super_admin_client.get(
            "/api/v1/users/me",
            headers={"X-Spoof-User-Id": str(uuid.uuid4())},
        )

        assert response.status_code == 404
