"""Contract tests for POST /api/v1/users endpoint.

Tests validate API contract compliance per contracts/users.yaml specification.
These tests verify:
- Request/response schemas match OpenAPI spec
- Only admins (super_admin, npo_admin) can create users
- Role assignment validation (npo_admin can only create within their NPO)
- npo_id constraints enforced (npo_admin/event_coordinator MUST have npo_id)
- Status codes are correct for different scenarios
"""

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class TestUsersCreateContract:
    """Contract tests for POST /api/v1/users endpoint."""

    @pytest.mark.asyncio
    async def test_create_user_requires_authentication(self, async_client: AsyncClient) -> None:
        """Test that creating users requires authentication.

        Contract: POST /api/v1/users
        Expected: 401 Unauthorized when no token provided
        """
        payload = {
            "email": "newuser@example.com",
            "first_name": "New",
            "last_name": "User",
            "role": "donor",
        }
        response = await async_client.post("/api/v1/users", json=payload)

        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_create_user_donor_role_forbidden(
        self, authenticated_client: AsyncClient
    ) -> None:
        """Test that donor role cannot create users.

        Contract: POST /api/v1/users
        Expected: 403 Forbidden for non-admin roles

        Note: Due to FastAPI's request validation order, validation errors (422)
        are returned before authorization errors (403) when request body is invalid.
        This test uses a VALID request to ensure we get the 403 authorization error.
        """
        # authenticated_client uses test_user which has donor role
        # Use VALID request body to get past validation and hit authorization check
        payload = {
            "email": "newuser@example.com",
            "password": "ValidPass123",
            "first_name": "New",
            "last_name": "User",
            "phone": "+1-555-0123",
            "role": "donor",
        }
        response = await authenticated_client.post("/api/v1/users", json=payload)

        assert response.status_code == 403
        data = response.json()
        assert "detail" in data
        # Handle both error structures: {"detail": {"error": {"message": "..."}}} or {"detail": {"message": "..."}}
        if isinstance(data["detail"], dict):
            error_msg = (
                data["detail"].get("error", {}).get("message", "")
                if "error" in data["detail"]
                else data["detail"].get("message", "")
            )
        else:
            error_msg = str(data["detail"])
        assert (
            "permission" in error_msg.lower()
            or "forbidden" in error_msg.lower()
            or "authorized" in error_msg.lower()
        )

    @pytest.mark.asyncio
    async def test_create_user_missing_required_fields_returns_400(
        self, authenticated_client: AsyncClient
    ) -> None:
        """Test that missing required fields returns 400.

        Contract: POST /api/v1/users
        Expected: 422 Unprocessable Entity with validation errors
        """
        # Missing first_name
        payload = {
            "email": "incomplete@example.com",
            "last_name": "User",
            "role": "donor",
        }
        response = await authenticated_client.post("/api/v1/users", json=payload)

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_create_user_invalid_email_returns_400(
        self, super_admin_client: AsyncClient
    ) -> None:
        """Test that invalid email format returns 400.

        Contract: POST /api/v1/users
        Expected: 422 Unprocessable Entity with validation error
        """
        payload = {
            "email": "not-an-email",
            "first_name": "Test",
            "last_name": "User",
            "role": "donor",
        }
        response = await super_admin_client.post("/api/v1/users", json=payload)

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        # Check validation error details for email field
        assert any("email" in error["field"].lower() for error in data["detail"]["details"])

    @pytest.mark.asyncio
    async def test_create_user_invalid_role_returns_400(
        self, super_admin_client: AsyncClient
    ) -> None:
        """Test that invalid role returns 400.

        Contract: POST /api/v1/users
        Expected: 422 Unprocessable Entity with validation error
        """
        payload = {
            "email": "test@example.com",
            "first_name": "Test",
            "last_name": "User",
            "role": "invalid_role",
        }
        response = await super_admin_client.post("/api/v1/users", json=payload)

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        # Check validation error details for role field
        assert any("role" in error["field"].lower() for error in data["detail"]["details"])

    @pytest.mark.asyncio
    async def test_create_user_duplicate_email_returns_409(
        self, super_admin_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that duplicate email returns 409.

        Contract: POST /api/v1/users
        Expected: 409 Conflict
        """
        # Create a user first
        from app.core.security import hash_password

        role_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'donor'"))
        donor_role_id = role_result.scalar_one()

        user_id = uuid.uuid4()
        await db_session.execute(
            text(
                """
                INSERT INTO users (id, email, first_name, last_name, password_hash,
                                 email_verified, is_active, role_id)
                VALUES (:id, :email, :first_name, :last_name, :password_hash,
                       :email_verified, :is_active, :role_id)
            """
            ),
            {
                "id": user_id,
                "email": "existing@example.com",
                "first_name": "Existing",
                "last_name": "User",
                "password_hash": hash_password("Password123"),
                "email_verified": True,
                "is_active": True,
                "role_id": donor_role_id,
            },
        )
        await db_session.commit()

        # Try to create user with same email
        payload = {
            "email": "existing@example.com",
            "password": "DuplicatePass123",
            "first_name": "Duplicate",
            "last_name": "User",
            "phone": "+1-555-0123",
            "role": "donor",
        }
        response = await super_admin_client.post("/api/v1/users", json=payload)

        assert response.status_code == 409
        data = response.json()
        assert "detail" in data
        assert (
            "email" in data["detail"]["message"].lower()
            or "exists" in data["detail"]["message"].lower()
        )

    @pytest.mark.asyncio
    async def test_create_npo_admin_without_npo_id_returns_400(
        self, super_admin_client: AsyncClient
    ) -> None:
        """Test that creating npo_admin without npo_id returns 400.

        Contract: POST /api/v1/users
        Expected: 422 Unprocessable Entity - npo_admin role requires npo_id
        """
        payload = {
            "email": "npoadmin@example.com",
            "password": "Password123",
            "first_name": "NPO",
            "last_name": "Admin",
            "phone": "+1-555-0124",
            "role": "npo_admin",
            # Missing npo_id
        }
        response = await super_admin_client.post("/api/v1/users", json=payload)

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        # Check validation error message mentions npo_id requirement
        assert any("npo_id" in error["message"].lower() for error in data["detail"]["details"])

    @pytest.mark.asyncio
    async def test_create_event_coordinator_without_npo_id_returns_400(
        self, super_admin_client: AsyncClient
    ) -> None:
        """Test that creating event_coordinator without npo_id returns 400.

        Contract: POST /api/v1/users
        Expected: 422 Unprocessable Entity - event_coordinator role requires npo_id
        """
        payload = {
            "email": "coordinator@example.com",
            "password": "Password123",
            "first_name": "Event",
            "last_name": "Coordinator",
            "phone": "+1-555-0125",
            "role": "event_coordinator",
            # Missing npo_id
        }
        response = await super_admin_client.post("/api/v1/users", json=payload)

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        # Check validation error message mentions npo_id requirement
        assert any("npo_id" in error["message"].lower() for error in data["detail"]["details"])

    @pytest.mark.asyncio
    async def test_create_donor_with_npo_id_returns_400(
        self, super_admin_client: AsyncClient
    ) -> None:
        """Test that creating donor with npo_id returns 400.

        Contract: POST /api/v1/users
        Expected: 422 Unprocessable Entity - donor role must not have npo_id
        """
        payload = {
            "email": "donor@example.com",
            "password": "Password123",
            "first_name": "Invalid",
            "last_name": "Donor",
            "phone": "+1-555-0126",
            "role": "donor",
            "npo_id": "550e8400-e29b-41d4-a716-446655440000",  # Should not be allowed
        }
        response = await super_admin_client.post("/api/v1/users", json=payload)

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        # Check validation error message mentions npo_id should not be provided
        assert any("npo_id" in error["message"].lower() for error in data["detail"]["details"])

    @pytest.mark.asyncio
    async def test_create_staff_with_npo_id_succeeds(
        self, super_admin_client: AsyncClient, test_approved_npo: Any
    ) -> None:
        """Test that creating staff with npo_id succeeds.

        Contract: POST /api/v1/users
        Expected: 201 Created - staff role requires npo_id
        """
        payload = {
            "email": "staff@example.com",
            "password": "Password123",
            "first_name": "Invalid",
            "last_name": "Staff",
            "phone": "+1-555-0127",
            "role": "staff",
            "npo_id": str(test_approved_npo.id),
        }
        response = await super_admin_client.post("/api/v1/users", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["role"] == "staff"
        assert data["npo_id"] == str(test_approved_npo.id)
