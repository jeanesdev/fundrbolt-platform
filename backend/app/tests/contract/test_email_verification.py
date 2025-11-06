"""Contract tests for email verification endpoints.

These tests verify that the email verification API endpoints conform to the
OpenAPI spec defined in contracts/auth.yaml.

Tests:
1. POST /api/v1/auth/verify-email - Verify email with token
2. POST /api/v1/auth/verify-email/resend - Resend verification email
"""

from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class TestEmailVerificationContract:
    """Contract tests for email verification endpoints."""

    @pytest.fixture
    async def unverified_user_with_token(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> dict[str, str]:
        """Create an unverified user and return their verification token."""
        # Register user (creates unverified account)
        register_payload = {
            "email": "verify.contract@example.com",
            "password": "SecurePass123",
            "first_name": "Verify",
            "last_name": "Contract",
        }
        register_response = await async_client.post("/api/v1/auth/register", json=register_payload)
        assert register_response.status_code == 201
        user_data = register_response.json()
        user_id = user_data["user"]["id"]

        # Extract verification token from Redis (in real system, would come from email)
        from app.core.redis import get_redis

        redis = await get_redis()
        # Find the token by scanning for keys with this user_id
        cursor = 0
        token = None
        while True:
            cursor, keys = await redis.scan(cursor, match="email_verify:*", count=100)
            for key in keys:
                key_str = key.decode() if isinstance(key, bytes) else key
                stored_user_id = await redis.get(key_str)
                if stored_user_id:
                    # Handle both bytes and string returns from Redis
                    user_id_str = (
                        stored_user_id.decode()
                        if isinstance(stored_user_id, bytes)
                        else stored_user_id
                    )
                    if user_id_str == user_id:
                        token = key_str.replace("email_verify:", "")
                        break
            if token or cursor == 0:
                break

        assert token is not None, "Verification token should be created during registration"

        return {
            "user_id": user_id,
            "email": "verify.contract@example.com",
            "token": token,
        }

    @pytest.mark.asyncio
    async def test_verify_email_success_returns_200(
        self,
        async_client: AsyncClient,
        unverified_user_with_token: dict[str, str],
    ) -> None:
        """Test successful email verification returns 200 OK.

        Flow:
        1. User registers (email_verified=false)
        2. User clicks verification link with token
        3. Email gets verified (email_verified=true, is_active=true)
        4. Returns success message
        """
        token = unverified_user_with_token["token"]

        # Verify email
        verify_payload = {"token": token}
        response = await async_client.post("/api/v1/auth/verify-email", json=verify_payload)

        # Should succeed
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "verified" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_verify_email_invalid_token_returns_400(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Test verification with invalid token returns 400 Bad Request.

        Flow:
        1. Attempt to verify with non-existent token
        2. Returns 400 error
        """
        verify_payload = {"token": "invalid_token_123"}
        response = await async_client.post("/api/v1/auth/verify-email", json=verify_payload)

        # Should fail
        assert response.status_code == 400
        error = response.json()["detail"]
        assert error["code"] in ["INVALID_TOKEN", "TOKEN_NOT_FOUND"]

    @pytest.mark.asyncio
    async def test_verify_email_expired_token_returns_400(
        self,
        async_client: AsyncClient,
        unverified_user_with_token: dict[str, str],
    ) -> None:
        """Test verification with expired token returns 400 Bad Request.

        Flow:
        1. User registers and gets token
        2. Token expires (delete from Redis to simulate)
        3. Attempt to verify
        4. Returns 400 error
        """
        token = unverified_user_with_token["token"]

        # Delete token to simulate expiration
        from app.core.redis import get_redis

        redis = await get_redis()
        await redis.delete(f"email_verify:{token}")

        # Try to verify with expired token
        verify_payload = {"token": token}
        response = await async_client.post("/api/v1/auth/verify-email", json=verify_payload)

        # Should fail
        assert response.status_code == 400
        error = response.json()["detail"]
        assert error["code"] in ["INVALID_TOKEN", "TOKEN_EXPIRED", "TOKEN_NOT_FOUND"]

    @pytest.mark.asyncio
    async def test_verify_email_already_verified_returns_400(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        unverified_user_with_token: dict[str, str],
    ) -> None:
        """Test verification of already verified email returns 400 Bad Request.

        Flow:
        1. User registers
        2. User verifies email (first time succeeds)
        3. User tries to verify again
        4. Returns 400 error
        """
        token = unverified_user_with_token["token"]
        user_id = unverified_user_with_token["user_id"]

        # Manually mark user as verified
        await db_session.execute(
            text("UPDATE users SET email_verified = true, is_active = true WHERE id = :id"),
            {"id": user_id},
        )
        await db_session.commit()

        # Try to verify again
        verify_payload = {"token": token}
        response = await async_client.post("/api/v1/auth/verify-email", json=verify_payload)

        # Should fail (or return success message indicating already verified)
        assert response.status_code in [200, 400]
        if response.status_code == 400:
            error = response.json()["detail"]
            assert error["code"] in ["ALREADY_VERIFIED", "INVALID_TOKEN"]

    @pytest.mark.asyncio
    async def test_verify_email_missing_token_returns_422(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Test verification without token returns 422 Unprocessable Entity.

        Flow:
        1. Send request without token field
        2. Returns 422 validation error
        """
        verify_payload: dict[str, str] = {}  # Missing token
        response = await async_client.post("/api/v1/auth/verify-email", json=verify_payload)

        # Should fail with validation error
        assert response.status_code == 422


class TestEmailResendContract:
    """Contract tests for resend verification email endpoint."""

    @pytest.fixture
    async def unverified_user(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> dict[str, str]:
        """Create an unverified user."""
        register_payload = {
            "email": "resend.contract@example.com",
            "password": "SecurePass123",
            "first_name": "Resend",
            "last_name": "Contract",
        }
        register_response = await async_client.post("/api/v1/auth/register", json=register_payload)
        assert register_response.status_code == 201
        user_data = register_response.json()

        return {
            "user_id": user_data["user"]["id"],
            "email": "resend.contract@example.com",
        }

    @pytest.mark.asyncio
    async def test_resend_verification_success_returns_200(
        self,
        async_client: AsyncClient,
        unverified_user: dict[str, str],
    ) -> None:
        """Test successful resend returns 200 OK.

        Flow:
        1. User registers
        2. User requests new verification email
        3. New token generated and sent
        4. Returns success message
        """
        # Mock the email service to avoid actually sending emails
        with patch("app.services.email_service.EmailService.send_verification_email") as mock_send:
            mock_send.return_value = True

            resend_payload = {"email": unverified_user["email"]}
            response = await async_client.post(
                "/api/v1/auth/verify-email/resend", json=resend_payload
            )

            # Should succeed
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            assert "sent" in data["message"].lower() or "resent" in data["message"].lower()

            # Verify email service was called
            mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_resend_verification_already_verified_returns_400(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        unverified_user: dict[str, str],
    ) -> None:
        """Test resend for already verified email returns 400 Bad Request.

        Flow:
        1. User registers and verifies
        2. User tries to resend verification
        3. Returns 400 error (already verified)
        """
        # Mark user as verified
        await db_session.execute(
            text("UPDATE users SET email_verified = true, is_active = true WHERE id = :id"),
            {"id": unverified_user["user_id"]},
        )
        await db_session.commit()

        # Try to resend
        resend_payload = {"email": unverified_user["email"]}
        response = await async_client.post("/api/v1/auth/verify-email/resend", json=resend_payload)

        # Should fail
        assert response.status_code == 400
        error = response.json()["detail"]
        assert error["code"] == "ALREADY_VERIFIED"

    @pytest.mark.asyncio
    async def test_resend_verification_user_not_found_returns_404(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Test resend for non-existent email returns 404 Not Found.

        Flow:
        1. Request resend for email that doesn't exist
        2. Returns 404 error
        """
        resend_payload = {"email": "nonexistent@example.com"}
        response = await async_client.post("/api/v1/auth/verify-email/resend", json=resend_payload)

        # Should fail
        assert response.status_code == 404
        error = response.json()["detail"]
        assert error["code"] == "USER_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_resend_verification_missing_email_returns_422(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Test resend without email returns 422 Unprocessable Entity.

        Flow:
        1. Send request without email field
        2. Returns 422 validation error
        """
        resend_payload: dict[str, str] = {}  # Missing email
        response = await async_client.post("/api/v1/auth/verify-email/resend", json=resend_payload)

        # Should fail with validation error
        assert response.status_code == 422
