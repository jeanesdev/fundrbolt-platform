"""Contract tests for POST /api/v1/auth/register endpoint.

Tests validate API contract compliance per contracts/auth.yaml specification.
These tests verify:
- Request/response schemas match OpenAPI spec
- Status codes are correct
- Error responses follow error schema
- Business rules are enforced
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


class TestAuthRegisterContract:
    """Contract tests for user registration endpoint."""

    @pytest.mark.asyncio
    async def test_register_success_returns_201(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test successful registration returns 201 with correct schema.

        Contract: POST /api/v1/auth/register
        Expected: 201 Created with UserRegisterResponse schema
        """
        payload = {
            "email": "john.doe@example.com",
            "password": "SecurePass123",
            "first_name": "John",
            "last_name": "Doe",
            "phone": "+1-555-0123",
        }

        response = await async_client.post("/api/v1/auth/register", json=payload)

        # Verify status code
        assert response.status_code == 201

        # Verify response schema
        data = response.json()
        assert "user" in data
        assert "message" in data

        # Verify user object schema
        user = data["user"]
        assert "id" in user
        assert "email" in user
        assert user["email"] == "john.doe@example.com"
        assert "first_name" in user
        assert user["first_name"] == "John"
        assert "last_name" in user
        assert user["last_name"] == "Doe"
        assert "phone" in user
        assert user["phone"] == "+1-555-0123"
        assert "email_verified" in user
        assert user["email_verified"] is False  # Should be false initially
        assert "is_active" in user
        assert user["is_active"] is False  # Should be false until email verified
        assert "role" in user
        assert user["role"] == "donor"  # Default role
        assert "npo_id" in user
        assert user["npo_id"] is None  # Donors don't have NPO
        assert "created_at" in user

        # Verify message
        assert "Verification email sent" in data["message"]

    @pytest.mark.asyncio
    async def test_register_duplicate_email_returns_409(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test duplicate email returns 409 Conflict.

        Contract: POST /api/v1/auth/register
        Expected: 409 Conflict with error schema
        """
        payload = {
            "email": "duplicate@example.com",
            "password": "SecurePass123",
            "first_name": "John",
            "last_name": "Doe",
        }

        # First registration should succeed
        response1 = await async_client.post("/api/v1/auth/register", json=payload)
        assert response1.status_code == 201

        # Second registration with same email should fail
        response2 = await async_client.post("/api/v1/auth/register", json=payload)

        # Verify status code
        assert response2.status_code == 409

        # Verify error schema
        data = response2.json()
        assert "detail" in data
        error = data["detail"]
        assert "code" in error
        assert error["code"] == "DUPLICATE_EMAIL"
        assert "message" in error
        assert "Email already registered" in error["message"]

    @pytest.mark.asyncio
    async def test_register_weak_password_returns_422(self, async_client: AsyncClient) -> None:
        """Test weak password returns 422 Validation Error.

        Contract: Password must be 8-100 chars with at least 1 letter and 1 number
        Expected: 422 Unprocessable Entity with validation error schema
        """
        test_cases = [
            {
                "password": "short",  # Too short
                "expected_field": "password",
            },
            {
                "password": "NoNumbers",  # No numbers
                "expected_field": "password",
            },
            {
                "password": "12345678",  # No letters
                "expected_field": "password",
            },
        ]

        for test_case in test_cases:
            payload = {
                "email": f"test_{test_case['password']}@example.com",
                "password": test_case["password"],
                "first_name": "John",
                "last_name": "Doe",
            }

            response = await async_client.post("/api/v1/auth/register", json=payload)

            # Verify status code
            assert response.status_code == 422

            # Verify error schema
            data = response.json()
            assert "detail" in data
            error = data["detail"]
            assert "code" in error
            assert error["code"] == "VALIDATION_ERROR"
            assert "details" in error
            # Details should be an array of validation errors
            assert isinstance(error["details"], list)
            assert len(error["details"]) > 0

    @pytest.mark.asyncio
    async def test_register_missing_required_fields_returns_422(
        self, async_client: AsyncClient
    ) -> None:
        """Test missing required fields returns 422 Validation Error.

        Contract: email, password, first_name, last_name are required
        Expected: 422 Unprocessable Entity
        """
        required_fields = ["email", "password", "first_name", "last_name"]

        for field in required_fields:
            payload = {
                "email": "test@example.com",
                "password": "SecurePass123",
                "first_name": "John",
                "last_name": "Doe",
            }
            # Remove one required field
            del payload[field]

            response = await async_client.post("/api/v1/auth/register", json=payload)

            # Verify status code
            assert response.status_code == 422

            # Verify error schema
            data = response.json()
            assert "detail" in data

    @pytest.mark.asyncio
    async def test_register_invalid_email_format_returns_422(
        self, async_client: AsyncClient
    ) -> None:
        """Test invalid email format returns 422 Validation Error.

        Contract: email must be valid email format
        Expected: 422 Unprocessable Entity
        """
        invalid_emails = ["notanemail", "missing@domain", "@nodomain.com", "spaces in@email.com"]

        for email in invalid_emails:
            payload = {
                "email": email,
                "password": "SecurePass123",
                "first_name": "John",
                "last_name": "Doe",
            }

            response = await async_client.post("/api/v1/auth/register", json=payload)

            # Verify status code
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_email_case_insensitive(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test email is stored and compared case-insensitively.

        Contract: Email uniqueness check should be case-insensitive
        Expected: Second registration with different case should return 409
        """
        payload1 = {
            "email": "Case@Example.com",
            "password": "SecurePass123",
            "first_name": "John",
            "last_name": "Doe",
        }

        # First registration
        response1 = await async_client.post("/api/v1/auth/register", json=payload1)
        assert response1.status_code == 201

        # Verify email is normalized to lowercase
        data1 = response1.json()
        assert data1["user"]["email"] == "case@example.com"

        # Try to register with different case
        payload2 = {
            "email": "case@EXAMPLE.COM",
            "password": "SecurePass123",
            "first_name": "Jane",
            "last_name": "Smith",
        }

        response2 = await async_client.post("/api/v1/auth/register", json=payload2)

        # Should fail with duplicate email
        assert response2.status_code == 409

    @pytest.mark.asyncio
    async def test_register_phone_optional(self, async_client: AsyncClient) -> None:
        """Test phone number is optional.

        Contract: phone field is nullable
        Expected: 201 Created without phone number
        """
        payload = {
            "email": "nophone@example.com",
            "password": "SecurePass123",
            "first_name": "John",
            "last_name": "Doe",
            # No phone field
        }

        response = await async_client.post("/api/v1/auth/register", json=payload)

        # Should succeed
        assert response.status_code == 201

        # Verify phone is null
        data = response.json()
        assert data["user"]["phone"] is None

    @pytest.mark.asyncio
    async def test_register_default_role_is_donor(self, async_client: AsyncClient) -> None:
        """Test new users get 'donor' role by default.

        Contract: Default role should be 'donor'
        Expected: Created user has role='donor'
        """
        payload = {
            "email": "newdonor@example.com",
            "password": "SecurePass123",
            "first_name": "John",
            "last_name": "Doe",
        }

        response = await async_client.post("/api/v1/auth/register", json=payload)

        assert response.status_code == 201

        data = response.json()
        assert data["user"]["role"] == "donor"

    @pytest.mark.asyncio
    async def test_register_user_inactive_until_verified(self, async_client: AsyncClient) -> None:
        """Test new users are inactive until email verified.

        Contract: email_verified=false, is_active=false on registration
        Expected: User cannot login until email is verified
        """
        payload = {
            "email": "unverified@example.com",
            "password": "SecurePass123",
            "first_name": "John",
            "last_name": "Doe",
        }

        response = await async_client.post("/api/v1/auth/register", json=payload)

        assert response.status_code == 201

        data = response.json()
        assert data["user"]["email_verified"] is False
        assert data["user"]["is_active"] is False

    @pytest.mark.asyncio
    async def test_register_organization_name_max_length(self, async_client: AsyncClient) -> None:
        """Test organization_name field validation for max length (255 chars).

        Contract: organization_name VARCHAR(255)
        Expected: 422 Validation Error if exceeds 255 characters
        """
        # Valid: exactly 255 characters
        valid_org_name = "A" * 255
        valid_payload = {
            "email": "valid-org@example.com",
            "password": "SecurePass123",
            "first_name": "Test",
            "last_name": "User",
            "organization_name": valid_org_name,
        }

        response = await async_client.post("/api/v1/auth/register", json=valid_payload)
        assert response.status_code == 201

        # Invalid: 256 characters (exceeds max)
        invalid_org_name = "A" * 256
        invalid_payload = {
            "email": "invalid-org@example.com",
            "password": "SecurePass123",
            "first_name": "Test",
            "last_name": "User",
            "organization_name": invalid_org_name,
        }

        response = await async_client.post("/api/v1/auth/register", json=invalid_payload)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_address_fields_max_lengths(self, async_client: AsyncClient) -> None:
        """Test address field validations for max lengths.

        Contract:
        - address_line1: VARCHAR(255)
        - address_line2: VARCHAR(255)
        - city: VARCHAR(100)
        - state: VARCHAR(100)
        - postal_code: VARCHAR(20)
        - country: VARCHAR(100)

        Expected: 422 Validation Error if any field exceeds its max length
        """
        # Test address_line1 exceeds 255
        payload = {
            "email": "test1@example.com",
            "password": "SecurePass123",
            "first_name": "Test",
            "last_name": "User",
            "address_line1": "A" * 256,  # Exceeds 255
        }
        response = await async_client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 422

        # Test city exceeds 100
        payload = {
            "email": "test2@example.com",
            "password": "SecurePass123",
            "first_name": "Test",
            "last_name": "User",
            "city": "A" * 101,  # Exceeds 100
        }
        response = await async_client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 422

        # Test postal_code exceeds 20
        payload = {
            "email": "test3@example.com",
            "password": "SecurePass123",
            "first_name": "Test",
            "last_name": "User",
            "postal_code": "A" * 21,  # Exceeds 20
        }
        response = await async_client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 422

        # Test valid max lengths (all at limit)
        valid_payload = {
            "email": "valid-address@example.com",
            "password": "SecurePass123",
            "first_name": "Test",
            "last_name": "User",
            "address_line1": "A" * 255,
            "address_line2": "B" * 255,
            "city": "C" * 100,
            "state": "D" * 100,
            "postal_code": "E" * 20,
            "country": "F" * 100,
        }
        response = await async_client.post("/api/v1/auth/register", json=valid_payload)
        assert response.status_code == 201
