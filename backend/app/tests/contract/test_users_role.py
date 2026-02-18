"""Contract tests for PATCH /api/v1/users/{user_id}/role endpoint.

Tests validate API contract compliance per contracts/users.yaml specification.
These tests verify:
- Request/response schemas match OpenAPI spec
- Only admins (super_admin, npo_admin) can assign roles
- Role update validation (npo_admin can only assign roles within their NPO)
- npo_id requirements enforced when assigning npo_admin/event_coordinator
- Status codes are correct for different scenarios
"""

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.npo import NPO, NPOStatus
from app.models.npo_member import MemberRole, MemberStatus, NPOMember


class TestUsersRoleUpdateContract:
    """Contract tests for PATCH /api/v1/users/{user_id}/role endpoint."""

    @pytest.mark.asyncio
    async def test_update_role_requires_authentication(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that updating roles requires authentication.

        Contract: PATCH /api/v1/users/{user_id}/role
        Expected: 401 Unauthorized when no token provided
        """
        # Create a user to update
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
                "email": "toroleupdate@example.com",
                "first_name": "To",
                "last_name": "Update",
                "password_hash": hash_password("Password123"),
                "email_verified": True,
                "is_active": True,
                "role_id": donor_role_id,
            },
        )
        await db_session.commit()

        payload = {"role": "staff"}
        response = await async_client.patch(f"/api/v1/users/{user_id}/role", json=payload)

        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_update_role_donor_role_forbidden(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        test_approved_npo: Any,
    ) -> None:
        """Test that donor role cannot update user roles.

        Contract: PATCH /api/v1/users/{user_id}/role
        Expected: 403 Forbidden for non-admin roles
        """
        # Create a user to update
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
                "email": "toroleupdate2@example.com",
                "first_name": "To",
                "last_name": "Update",
                "password_hash": hash_password("Password123"),
                "email_verified": True,
                "is_active": True,
                "role_id": donor_role_id,
            },
        )
        await db_session.commit()

        # authenticated_client uses test_user which has donor role
        payload = {"role": "staff", "npo_id": str(test_approved_npo.id)}
        response = await authenticated_client.patch(f"/api/v1/users/{user_id}/role", json=payload)

        assert response.status_code == 403
        data = response.json()
        assert "detail" in data
        # Middleware raises HTTPException with detail={"error": {...}}, which gets wrapped as {"detail": {"error": {...}}}
        if isinstance(data["detail"], dict) and "error" in data["detail"]:
            error_message = (
                data["detail"]["error"]["message"].lower()
                if isinstance(data["detail"]["error"], dict)
                else str(data["detail"]["error"]).lower()
            )
        elif isinstance(data["detail"], dict) and "message" in data["detail"]:
            error_message = data["detail"]["message"].lower()
        else:
            error_message = str(data["detail"]).lower()
        assert (
            "permission" in error_message
            or "forbidden" in error_message
            or "authorized" in error_message
        )

    @pytest.mark.asyncio
    async def test_update_role_invalid_role_returns_400(
        self, super_admin_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that invalid role returns 400.

        Contract: PATCH /api/v1/users/{user_id}/role
        Expected: 422 Unprocessable Entity (Pydantic validation error)
        """
        # Create a user to update
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
                "email": "invalidrole@example.com",
                "first_name": "Invalid",
                "last_name": "Role",
                "password_hash": hash_password("Password123"),
                "email_verified": True,
                "is_active": True,
                "role_id": donor_role_id,
            },
        )
        await db_session.commit()

        payload = {"role": "invalid_role"}
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}/role", json=payload)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_role_nonexistent_user_returns_404(
        self, super_admin_client: AsyncClient, test_approved_npo: Any
    ) -> None:
        """Test that updating nonexistent user returns 404.

        Contract: PATCH /api/v1/users/{user_id}/role
        Expected: 404 Not Found
        """
        nonexistent_id = uuid.uuid4()
        payload = {"role": "staff", "npo_id": str(test_approved_npo.id)}
        response = await super_admin_client.patch(
            f"/api/v1/users/{nonexistent_id}/role", json=payload
        )

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_update_to_npo_admin_without_npo_id_returns_400(
        self, super_admin_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that updating to npo_admin without providing npo_id returns 400.

        Contract: PATCH /api/v1/users/{user_id}/role
        Expected: 422 Unprocessable Entity - npo_admin role requires npo_id
        """
        # Create a donor user without npo_id
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
                "email": "tonpoadmin@example.com",
                "first_name": "To",
                "last_name": "NPOAdmin",
                "password_hash": hash_password("Password123"),
                "email_verified": True,
                "is_active": True,
                "role_id": donor_role_id,
            },
        )
        await db_session.commit()

        # Try to update to npo_admin without npo_id
        payload = {"role": "npo_admin"}
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}/role", json=payload)

        assert response.status_code == 422  # Schema validation returns 422
        data = response.json()
        assert "detail" in data
        # Check validation error message mentions npo_id requirement
        assert any("npo_id" in error["message"].lower() for error in data["detail"]["details"])

    @pytest.mark.asyncio
    async def test_update_to_event_coordinator_without_npo_id_returns_400(
        self, super_admin_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that updating to event_coordinator without providing npo_id returns 400.

        Contract: PATCH /api/v1/users/{user_id}/role
        Expected: 422 Unprocessable Entity - event_coordinator role requires npo_id
        """
        # Create a donor user without npo_id
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
                "email": "tocoordinator@example.com",
                "first_name": "To",
                "last_name": "Coordinator",
                "password_hash": hash_password("Password123"),
                "email_verified": True,
                "is_active": True,
                "role_id": donor_role_id,
            },
        )
        await db_session.commit()

        # Try to update to event_coordinator without npo_id
        payload = {"role": "event_coordinator"}
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}/role", json=payload)

        assert response.status_code == 422  # Schema validation returns 422
        data = response.json()
        assert "detail" in data
        # Check validation error message mentions npo_id requirement
        assert any("npo_id" in error["message"].lower() for error in data["detail"]["details"])

    @pytest.mark.asyncio
    async def test_update_to_npo_admin_with_npo_id_succeeds(
        self,
        super_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_approved_npo: Any,
    ) -> None:
        """Test that updating to npo_admin with npo_id succeeds.

        Contract: PATCH /api/v1/users/{user_id}/role
        Expected: 200 OK with updated user
        """
        # Create a donor user without npo_id
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
                "email": "npoadminupdate@example.com",
                "first_name": "NPO",
                "last_name": "AdminUpdate",
                "password_hash": hash_password("Password123"),
                "email_verified": True,
                "is_active": True,
                "role_id": donor_role_id,
            },
        )
        await db_session.commit()

        # Update to npo_admin with npo_id
        payload = {"role": "npo_admin", "npo_id": str(test_approved_npo.id)}
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}/role", json=payload)

        # This will fail until we implement the endpoint
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "npo_admin"
        assert data["npo_id"] == str(test_approved_npo.id)

    @pytest.mark.asyncio
    async def test_update_from_npo_admin_to_donor_clears_npo_id(
        self, super_admin_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that updating from npo_admin to donor clears npo_id.

        Contract: PATCH /api/v1/users/{user_id}/role
        Expected: 200 OK with npo_id cleared
        """
        # Create an npo_admin user with membership
        role_result = await db_session.execute(
            text("SELECT id FROM roles WHERE name = 'npo_admin'")
        )
        npo_admin_role_id = role_result.scalar_one()

        user_id = uuid.uuid4()
        npo_id = uuid.uuid4()

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
                "email": "downgrade@example.com",
                "first_name": "Downgrade",
                "last_name": "Test",
                "password_hash": hash_password("Password123"),
                "email_verified": True,
                "is_active": True,
                "role_id": npo_admin_role_id,
            },
        )
        db_session.add(
            NPO(
                id=npo_id,
                name=f"Role Downgrade NPO {npo_id}",
                email=f"role-downgrade-{npo_id}@example.com",
                status=NPOStatus.APPROVED,
                created_by_user_id=user_id,
            )
        )
        db_session.add(
            NPOMember(
                npo_id=npo_id,
                user_id=user_id,
                role=MemberRole.ADMIN,
                status=MemberStatus.ACTIVE,
            )
        )
        await db_session.commit()

        # Update to donor (should clear npo_id)
        payload = {"role": "donor"}
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}/role", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "donor"
        assert data["npo_id"] is None
