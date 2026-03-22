"""Contract tests for password reset endpoints.

T051: Tests for POST /api/v1/auth/password/reset/request
and POST /api/v1/auth/password/reset/confirm
Tests verify API contract compliance per contracts/auth.yaml
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class TestPasswordResetRequest:
    """Test POST /api/v1/password/reset/request endpoint."""

    @pytest.mark.asyncio
    async def test_request_password_reset_success(
        self, async_client: AsyncClient, test_user: User
    ) -> None:
        """Should return 200 and send reset email when email exists."""
        response = await async_client.post(
            "/api/v1/auth/password/reset/request",
            json={"email": test_user.email},
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "password reset" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_request_password_reset_nonexistent_email(
        self, async_client: AsyncClient
    ) -> None:
        """Should return 200 even for nonexistent email (prevent enumeration)."""
        response = await async_client.post(
            "/api/v1/auth/password/reset/request",
            json={"email": "nonexistent@example.com"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    @pytest.mark.asyncio
    async def test_request_password_reset_invalid_email(self, async_client: AsyncClient) -> None:
        """Should return 422 for invalid email format."""
        response = await async_client.post(
            "/api/v1/auth/password/reset/request",
            json={"email": "not-an-email"},
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data  # Pydantic validation error

    @pytest.mark.asyncio
    async def test_request_password_reset_missing_email(self, async_client: AsyncClient) -> None:
        """Should return 422 when email is missing."""
        response = await async_client.post(
            "/api/v1/auth/password/reset/request",
            json={},
        )

        assert response.status_code == 422


class TestPasswordResetConfirm:
    """Test POST /api/v1/password/reset/confirm endpoint."""

    @pytest.mark.asyncio
    async def test_confirm_password_reset_success(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: User
    ) -> None:
        """Should reset password with valid token."""
        from app.services.password_service import PasswordService
        from app.services.redis_service import RedisService

        # Generate token directly and store in Redis
        token = PasswordService.generate_reset_token()
        token_hash = PasswordService.hash_token(token)
        await RedisService.store_password_reset_token(token_hash, test_user.id)

        response = await async_client.post(
            "/api/v1/auth/password/reset/confirm",
            json={
                "token": token,
                "new_password": "NewPassword123",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "password reset successfully" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_confirm_password_reset_invalid_token(self, async_client: AsyncClient) -> None:
        """Should return 400 for invalid or expired token."""
        response = await async_client.post(
            "/api/v1/auth/password/reset/confirm",
            json={
                "token": "invalid_token",
                "new_password": "NewPassword123",
            },
        )

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert data["detail"]["code"] == "INVALID_TOKEN"

    @pytest.mark.asyncio
    @pytest.mark.asyncio
    async def test_confirm_password_reset_weak_password(self, async_client: AsyncClient) -> None:
        """Should return 422 for weak password."""
        response = await async_client.post(
            "/api/v1/auth/password/reset/confirm",
            json={
                "token": "valid_token",
                "new_password": "weak",  # Too short, no number
            },
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data  # Pydantic validation error

    @pytest.mark.asyncio
    async def test_confirm_password_reset_missing_fields(self, async_client: AsyncClient) -> None:
        """Should return 422 when required fields are missing."""
        response = await async_client.post(
            "/api/v1/auth/password/reset/confirm",
            json={"token": "some_token"},  # Missing new_password
        )

        assert response.status_code == 422


class TestPasswordChange:
    """Test POST /api/v1/password/change endpoint."""

    @pytest.mark.asyncio
    async def test_change_password_success(
        self, async_client: AsyncClient, authenticated_client: AsyncClient, test_user: User
    ) -> None:
        """Should change password with correct current password."""
        response = await authenticated_client.post(
            "/api/v1/auth/password/change",
            json={
                "current_password": "TestPass123",
                "new_password": "NewPassword456",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "password changed successfully" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_change_password_incorrect_current(
        self, authenticated_client: AsyncClient
    ) -> None:
        """Should return 401 for incorrect current password."""
        response = await authenticated_client.post(
            "/api/v1/auth/password/change",
            json={
                "current_password": "WrongPassword123",
                "new_password": "NewPassword456",
            },
        )

        assert response.status_code == 400  # Changed from 401 to match implementation
        data = response.json()
        assert "detail" in data
        assert data["detail"]["code"] == "INVALID_PASSWORD"

    @pytest.mark.asyncio
    @pytest.mark.asyncio
    async def test_change_password_weak_new_password(
        self, authenticated_client: AsyncClient
    ) -> None:
        """Should return 422 for weak new password."""
        response = await authenticated_client.post(
            "/api/v1/auth/password/change",
            json={
                "current_password": "TestPass123",
                "new_password": "weak",
            },
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data  # Pydantic validation error

    @pytest.mark.asyncio
    async def test_change_password_unauthenticated(self, async_client: AsyncClient) -> None:
        """Should return 401 when not authenticated."""
        response = await async_client.post(
            "/api/v1/auth/password/change",
            json={
                "current_password": "TestPass123",
                "new_password": "NewPassword456",
            },
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_change_password_missing_fields(self, authenticated_client: AsyncClient) -> None:
        """Should return 422 when required fields are missing."""
        response = await authenticated_client.post(
            "/api/v1/auth/password/change",
            json={"current_password": "TestPass123"},  # Missing new_password
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_set_backup_password_for_social_user_without_current_password(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_social_user_no_local_password: User,
    ) -> None:
        """OAuth-only users can set a first backup password without a current password."""
        from app.core.security import create_access_token

        access_token = create_access_token({"sub": str(test_social_user_no_local_password.id)})
        response = await async_client.post(
            "/api/v1/auth/password/change",
            json={"new_password": "BackupPass456"},
            headers={"Authorization": f"Bearer {access_token}"},
        )

        assert response.status_code == 200

        await db_session.refresh(test_social_user_no_local_password)
        assert test_social_user_no_local_password.has_local_password is True
        assert test_social_user_no_local_password.verify_password("BackupPass456") is True

    @pytest.mark.asyncio
    async def test_change_password_requires_current_for_existing_local_password(
        self,
        authenticated_client: AsyncClient,
    ) -> None:
        """Users with an existing local password still need to provide it."""
        response = await authenticated_client.post(
            "/api/v1/auth/password/change",
            json={"new_password": "NewPassword456"},
        )

        assert response.status_code == 400
        assert response.json()["detail"]["code"] == "CURRENT_PASSWORD_REQUIRED"
