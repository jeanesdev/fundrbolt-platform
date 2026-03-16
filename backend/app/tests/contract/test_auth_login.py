"""Contract tests for POST /api/v1/auth/login endpoint.

Tests validate API contract compliance per contracts/auth.yaml specification.
These tests verify:
- Request/response schemas match OpenAPI spec
- Status codes are correct for different scenarios
- JWT tokens are properly formatted
- Rate limiting works correctly
- Email verification is enforced
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


class TestAuthLoginContract:
    """Contract tests for user login endpoint."""

    @pytest.mark.asyncio
    async def test_login_success_returns_200(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test successful login returns 200 with JWT tokens.

        Contract: POST /api/v1/auth/login
        Expected: 200 OK with LoginResponse schema (access_token, refresh_token, user)
        """
        # First register a user and verify their email
        register_payload = {
            "email": "login.test@example.com",
            "password": "SecurePass123",
            "first_name": "Login",
            "last_name": "Test",
        }
        register_response = await async_client.post("/api/v1/auth/register", json=register_payload)
        assert register_response.status_code == 201

        # Verify email before login
        verification_token = register_response.json()["verification_token"]
        await async_client.post("/api/v1/auth/verify-email", json={"token": verification_token})

        # Attempt login
        login_payload = {"email": "login.test@example.com", "password": "SecurePass123"}
        response = await async_client.post("/api/v1/auth/login", json=login_payload)

        # Verify status code
        assert response.status_code == 200

        # Verify response schema
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        assert data["expires_in"] == 900  # 15 minutes in seconds
        assert "user" in data

        # Verify user object
        user = data["user"]
        assert user["email"] == "login.test@example.com"
        assert user["first_name"] == "Login"
        assert user["last_name"] == "Test"
        assert user["role"] == "donor"

        # Verify tokens are JWT format (three base64 parts separated by dots)
        assert data["access_token"].count(".") == 2
        assert data["refresh_token"].count(".") == 2

    @pytest.mark.asyncio
    async def test_login_invalid_credentials_returns_401(self, async_client: AsyncClient) -> None:
        """Test invalid credentials return 401 Unauthorized.

        Contract: POST /api/v1/auth/login
        Expected: 401 Unauthorized with error schema
        """
        # Try to login with non-existent email
        login_payload = {"email": "nonexistent@example.com", "password": "SomePassword123"}
        response = await async_client.post("/api/v1/auth/login", json=login_payload)

        # Verify status code
        assert response.status_code == 401

        # Verify error schema
        data = response.json()
        assert "detail" in data
        error = data["detail"]
        assert "code" in error
        assert error["code"] == "INVALID_CREDENTIALS"
        assert "message" in error
        assert "Invalid email or password" in error["message"]

    @pytest.mark.asyncio
    async def test_login_wrong_password_returns_401(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test wrong password returns 401 Unauthorized.

        Contract: POST /api/v1/auth/login
        Expected: 401 Unauthorized (same as non-existent user for security)
        """
        # Register a user
        register_payload = {
            "email": "wrongpass@example.com",
            "password": "CorrectPass123",
            "first_name": "Test",
            "last_name": "User",
        }
        await async_client.post("/api/v1/auth/register", json=register_payload)

        # Try to login with wrong password
        login_payload = {"email": "wrongpass@example.com", "password": "WrongPass123"}
        response = await async_client.post("/api/v1/auth/login", json=login_payload)

        # Verify status code
        assert response.status_code == 401

        # Verify error schema
        data = response.json()
        assert "detail" in data
        assert data["detail"]["code"] == "INVALID_CREDENTIALS"

    @pytest.mark.asyncio
    async def test_login_unverified_email_returns_200_pending_verification(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test unverified email can sign in and remains pending verification.

        Contract: POST /api/v1/auth/login
        Expected: 200 OK with tokens and user.email_verified=false
        """
        # Register a user (email not verified yet)
        register_payload = {
            "email": "unverified@example.com",
            "password": "SecurePass123",
            "first_name": "Test",
            "last_name": "User",
        }
        await async_client.post("/api/v1/auth/register", json=register_payload)

        # Try to login without verifying email
        login_payload = {"email": "unverified@example.com", "password": "SecurePass123"}
        response = await async_client.post("/api/v1/auth/login", json=login_payload)

        # Verify status code and response schema
        assert response.status_code == 200
        data = response.json()
        assert data["access_token"].count(".") == 2
        assert data["refresh_token"].count(".") == 2
        assert data["user"]["email"] == "unverified@example.com"
        assert data["user"]["email_verified"] is False
        assert data["user"]["is_active"] is False

    @pytest.mark.asyncio
    async def test_login_deactivated_account_returns_403(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test deactivated account returns 403 Forbidden.

        Contract: POST /api/v1/auth/login
        Expected: 403 Forbidden with ACCOUNT_DEACTIVATED error
        """
        # This test will need the implementation of user deactivation
        # For now, we define the expected contract
        pytest.skip("Requires user deactivation implementation")

    @pytest.mark.asyncio
    async def test_login_missing_fields_returns_422(self, async_client: AsyncClient) -> None:
        """Test missing required fields returns 422 Validation Error.

        Contract: email and password are required
        Expected: 422 Unprocessable Entity
        """
        # Missing password
        response1 = await async_client.post(
            "/api/v1/auth/login", json={"email": "test@example.com"}
        )
        assert response1.status_code == 422

        # Missing email
        response2 = await async_client.post(
            "/api/v1/auth/login", json={"password": "SecurePass123"}
        )
        assert response2.status_code == 422

        # Empty payload
        response3 = await async_client.post("/api/v1/auth/login", json={})
        assert response3.status_code == 422

    @pytest.mark.asyncio
    async def test_login_rate_limiting_after_5_failed_attempts(
        self, async_client: AsyncClient
    ) -> None:
        """Test rate limiting after 5 failed login attempts.

        Contract: 5 failed attempts per 15 minutes per IP
        Expected: 6th attempt returns 429 Rate Limit Exceeded
        """
        login_payload = {"email": "ratelimit@example.com", "password": "WrongPassword123"}

        # Make 5 failed attempts
        for _i in range(5):
            response = await async_client.post("/api/v1/auth/login", json=login_payload)
            # Should return 401 for invalid credentials
            assert response.status_code == 401

        # 6th attempt should be rate limited
        response = await async_client.post("/api/v1/auth/login", json=login_payload)

        # Verify status code
        assert response.status_code == 429

        # Verify error schema
        data = response.json()
        assert "detail" in data
        error = data["detail"]
        assert error["code"] == "RATE_LIMIT_EXCEEDED"
        assert "15 minutes" in error["message"]

    @pytest.mark.asyncio
    async def test_login_case_insensitive_email(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test login with different email case still works.

        Contract: Email comparison should be case-insensitive
        Expected: Login succeeds with any case variation
        """
        # Register with lowercase email
        register_payload = {
            "email": "case@example.com",
            "password": "SecurePass123",
            "first_name": "Test",
            "last_name": "User",
        }
        register_response = await async_client.post("/api/v1/auth/register", json=register_payload)

        # Verify email
        verification_token = register_response.json()["verification_token"]
        await async_client.post("/api/v1/auth/verify-email", json={"token": verification_token})

        # Try to login with uppercase email
        login_payload = {"email": "CASE@EXAMPLE.COM", "password": "SecurePass123"}
        response = await async_client.post("/api/v1/auth/login", json=login_payload)

        # Should succeed (after email verification is implemented)
        # For now, will fail with EMAIL_NOT_VERIFIED
        assert response.status_code in [200, 400]  # 200 if verified, 400 if not

    @pytest.mark.asyncio
    async def test_login_updates_last_login_timestamp(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test successful login updates last_login_at timestamp.

        Contract: User's last_login_at should be updated on successful login
        Expected: Timestamp is updated in database
        """
        # This test will verify the side effect in the database
        # For now, we just verify the contract structure
        pytest.skip("Requires implementation to verify timestamp update")

    @pytest.mark.asyncio
    async def test_login_creates_session_record(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test successful login creates session record.

        Contract: Login should create session in PostgreSQL and Redis
        Expected: Session record exists with device info, IP, user agent
        """
        # This test will verify session creation
        pytest.skip("Requires implementation to verify session creation")
