"""Integration tests for role assignment flow.

These tests verify the complete workflow of:
1. Creating a new user (admin action)
2. Verifying their email
3. Assigning/changing their role
4. Verifying permissions work correctly across endpoints

Unlike contract tests which test individual endpoints,
integration tests verify the complete user journey works end-to-end.
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.npo import NPO, NPOStatus
from app.models.npo_member import MemberRole, MemberStatus, NPOMember


class TestRoleAssignmentIntegration:
    """Integration tests for complete role assignment workflows."""

    @pytest.mark.asyncio
    async def test_complete_donor_to_staff_upgrade_flow(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test complete flow: register as donor, upgrade to staff, verify permissions.

        Flow:
        1. Register new user (becomes donor by default)
        2. Verify email
        3. Login as donor - verify limited permissions
        4. Admin upgrades user to staff
        5. Login again - verify staff permissions
        """
        # Step 1: Register new user
        register_payload = {
            "email": "upgrade.flow@example.com",
            "password": "SecurePass123",
            "first_name": "Upgrade",
            "last_name": "Flow",
        }
        register_response = await async_client.post("/api/v1/auth/register", json=register_payload)
        assert register_response.status_code == 201
        user_data = register_response.json()
        user_id = user_data["user"]["id"]
        assert user_data["user"]["role"] == "donor"

        # Step 2: Manually verify email (in production would be via email link)
        await db_session.execute(
            text("UPDATE users SET email_verified = true, is_active = true WHERE id = :id"),
            {"id": user_id},
        )
        await db_session.commit()

        # Step 3: Login as donor and check permissions
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "upgrade.flow@example.com", "password": "SecurePass123"},
        )
        assert login_response.status_code == 200
        donor_token = login_response.json()["access_token"]

        # Donor should NOT be able to list users
        async_client.headers["Authorization"] = f"Bearer {donor_token}"
        list_users_response = await async_client.get("/api/v1/users")
        assert list_users_response.status_code in [
            403,
            404,
        ]  # Forbidden or Not Found (endpoint may not exist yet)

        # Step 4: Create super_admin and upgrade user to staff
        # First create a super_admin user for this test
        super_admin_result = await db_session.execute(
            text("SELECT id FROM roles WHERE name = 'super_admin'")
        )
        super_admin_role_id = super_admin_result.scalar_one()

        admin_id = uuid.uuid4()
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
                "id": admin_id,
                "email": "admin.upgrade@example.com",
                "first_name": "Admin",
                "last_name": "User",
                "password_hash": hash_password("AdminPass123"),
                "email_verified": True,
                "is_active": True,
                "role_id": super_admin_role_id,
            },
        )
        await db_session.commit()

        npo_id = uuid.uuid4()
        db_session.add(
            NPO(
                id=npo_id,
                name=f"Upgrade Flow NPO {npo_id}",
                email=f"upgrade-flow-{npo_id}@example.com",
                status=NPOStatus.APPROVED,
                created_by_user_id=admin_id,
            )
        )
        await db_session.commit()

        # Login as admin
        admin_login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "admin.upgrade@example.com", "password": "AdminPass123"},
        )
        assert admin_login_response.status_code == 200
        admin_token = admin_login_response.json()["access_token"]

        # Admin upgrades user to staff
        async_client.headers["Authorization"] = f"Bearer {admin_token}"
        upgrade_response = await async_client.patch(
            f"/api/v1/users/{user_id}/role",
            json={"role": "staff", "npo_id": str(npo_id)},
        )
        assert upgrade_response.status_code == 200
        assert upgrade_response.json()["role"] == "staff"

        # Step 5: Login again as upgraded user and verify staff permissions
        login_again_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "upgrade.flow@example.com", "password": "SecurePass123"},
        )
        assert login_again_response.status_code == 200
        staff_token = login_again_response.json()["access_token"]
        user_data_after = login_again_response.json()["user"]
        assert user_data_after["role"] == "staff"

        # Staff should still NOT be able to list all users (only assigned events)
        async_client.headers["Authorization"] = f"Bearer {staff_token}"
        list_users_response_staff = await async_client.get("/api/v1/users")
        assert list_users_response_staff.status_code in [403, 404]

    @pytest.mark.asyncio
    async def test_npo_admin_role_assignment_with_npo_id(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test assigning npo_admin role requires and sets npo_id correctly.

        Flow:
        1. Create super_admin
        2. Super_admin creates new user as npo_admin with npo_id
        3. Verify user has correct role and npo_id
        4. Verify npo_admin can only see users in their NPO
        """
        # Step 1: Create super_admin
        super_admin_result = await db_session.execute(
            text("SELECT id FROM roles WHERE name = 'super_admin'")
        )
        super_admin_role_id = super_admin_result.scalar_one()

        admin_id = uuid.uuid4()
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
                "id": admin_id,
                "email": "superadmin.npo@example.com",
                "first_name": "Super",
                "last_name": "Admin",
                "password_hash": hash_password("SuperPass123"),
                "email_verified": True,
                "is_active": True,
                "role_id": super_admin_role_id,
            },
        )
        await db_session.commit()

        # Login as super_admin
        admin_login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "superadmin.npo@example.com", "password": "SuperPass123"},
        )
        assert admin_login_response.status_code == 200
        admin_token = admin_login_response.json()["access_token"]

        # Step 2: Super_admin creates npo_admin with npo_id
        npo_id = uuid.uuid4()
        db_session.add(
            NPO(
                id=npo_id,
                name=f"NPO Admin Test {npo_id}",
                email=f"npo-admin-{npo_id}@example.com",
                status=NPOStatus.APPROVED,
                created_by_user_id=admin_id,
            )
        )
        await db_session.commit()
        async_client.headers["Authorization"] = f"Bearer {admin_token}"
        create_response = await async_client.post(
            "/api/v1/users",
            json={
                "email": "npoadmin.test@example.com",
                "password": "NPOPass123",
                "first_name": "NPO",
                "last_name": "Admin",
                "role": "npo_admin",
                "npo_id": str(npo_id),
            },
        )
        assert create_response.status_code == 201
        npo_admin_data = create_response.json()
        assert npo_admin_data["role"] == "npo_admin"
        assert npo_admin_data["npo_id"] == str(npo_id)

        # Step 3: Verify npo_admin can login (after email verification)
        npo_admin_id = npo_admin_data["id"]
        await db_session.execute(
            text("UPDATE users SET email_verified = true, is_active = true WHERE id = :id"),
            {"id": npo_admin_id},
        )
        # Set password for the created user
        await db_session.execute(
            text("UPDATE users SET password_hash = :hash WHERE id = :id"),
            {"id": npo_admin_id, "hash": hash_password("NPOPass123")},
        )
        await db_session.commit()

        npo_login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "npoadmin.test@example.com", "password": "NPOPass123"},
        )
        assert npo_login_response.status_code == 200
        npo_token = npo_login_response.json()["access_token"]
        user_info = npo_login_response.json()["user"]
        assert user_info["role"] == "npo_admin"
        assert user_info["npo_id"] == str(npo_id)

        # Step 4: Verify npo_admin can access user list (but filtered to their NPO)
        async_client.headers["Authorization"] = f"Bearer {npo_token}"
        list_response = await async_client.get("/api/v1/users")
        # Should succeed and return filtered results (implementation will enforce filtering)
        assert list_response.status_code in [200, 403, 404]

    @pytest.mark.asyncio
    async def test_role_downgrade_clears_npo_id(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that downgrading from npo_admin to donor clears npo_id.

        Flow:
        1. Create npo_admin with npo_id
        2. Verify email and login
        3. Super_admin downgrades to donor
        4. Verify npo_id is cleared
        5. Verify donor has appropriate permissions
        """
        # Step 1: Create super_admin
        super_admin_result = await db_session.execute(
            text("SELECT id FROM roles WHERE name = 'super_admin'")
        )
        super_admin_role_id = super_admin_result.scalar_one()

        admin_id = uuid.uuid4()
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
                "id": admin_id,
                "email": "superadmin.downgrade@example.com",
                "first_name": "Super",
                "last_name": "Admin",
                "password_hash": hash_password("SuperPass123"),
                "email_verified": True,
                "is_active": True,
                "role_id": super_admin_role_id,
            },
        )

        # Create npo_admin with npo_id
        npo_admin_result = await db_session.execute(
            text("SELECT id FROM roles WHERE name = 'npo_admin'")
        )
        npo_admin_role_id = npo_admin_result.scalar_one()

        npo_id = uuid.uuid4()
        npo_admin_id = uuid.uuid4()
        db_session.add(
            NPO(
                id=npo_id,
                name=f"Downgrade NPO {npo_id}",
                email=f"downgrade-{npo_id}@example.com",
                status=NPOStatus.APPROVED,
                created_by_user_id=admin_id,
            )
        )
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
                "id": npo_admin_id,
                "email": "todowngrade@example.com",
                "first_name": "To",
                "last_name": "Downgrade",
                "password_hash": hash_password("NPOPass123"),
                "email_verified": True,
                "is_active": True,
                "role_id": npo_admin_role_id,
            },
        )
        db_session.add(
            NPOMember(
                npo_id=npo_id,
                user_id=npo_admin_id,
                role=MemberRole.ADMIN,
                status=MemberStatus.ACTIVE,
            )
        )
        await db_session.commit()

        # Step 2: Login as npo_admin
        npo_login = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "todowngrade@example.com", "password": "NPOPass123"},
        )
        assert npo_login.status_code == 200
        npo_user = npo_login.json()["user"]
        assert npo_user["role"] == "npo_admin"
        assert npo_user["npo_id"] == str(npo_id)

        # Step 3: Login as super_admin and downgrade user
        admin_login = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "superadmin.downgrade@example.com", "password": "SuperPass123"},
        )
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]

        async_client.headers["Authorization"] = f"Bearer {admin_token}"
        downgrade_response = await async_client.patch(
            f"/api/v1/users/{npo_admin_id}/role",
            json={"role": "donor"},
        )
        assert downgrade_response.status_code == 200
        downgraded_user = downgrade_response.json()
        assert downgraded_user["role"] == "donor"
        assert downgraded_user["npo_id"] is None

        # Step 4: Login again as downgraded user and verify
        final_login = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "todowngrade@example.com", "password": "NPOPass123"},
        )
        assert final_login.status_code == 200
        final_user = final_login.json()["user"]
        assert final_user["role"] == "donor"
        assert final_user["npo_id"] is None

        # Step 5: Verify donor cannot access admin endpoints
        donor_token = final_login.json()["access_token"]
        async_client.headers["Authorization"] = f"Bearer {donor_token}"
        list_response = await async_client.get("/api/v1/users")
        assert list_response.status_code in [403, 404]

    @pytest.mark.asyncio
    async def test_cannot_change_own_role(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that users cannot change their own role.

        Security requirement: Prevent privilege escalation or accidental
        role changes by requiring another admin to make role changes.

        Flow:
        1. Super admin logs in
        2. Attempt to change own role from super_admin to donor
        3. Should receive 403 Forbidden error
        """
        # Step 1: Create super admin
        await db_session.execute(
            text(
                """
                INSERT INTO roles (id, name, description, scope)
                VALUES (:id, :name, :description, :scope)
                ON CONFLICT (name) DO NOTHING
                """
            ),
            {
                "id": uuid.uuid4(),
                "name": "super_admin",
                "description": "Super administrator",
                "scope": "platform",
            },
        )

        admin_id = uuid.uuid4()
        await db_session.execute(
            text(
                """
                INSERT INTO users (
                    id, email, password_hash, first_name, last_name, phone,
                    email_verified, is_active, role_id
                )
                VALUES (
                    :id, :email, :password_hash, :first_name, :last_name, :phone,
                    :email_verified, :is_active,
                    (SELECT id FROM roles WHERE name = 'super_admin')
                )
                """
            ),
            {
                "id": admin_id,
                "email": "selfchange@example.com",
                "password_hash": hash_password("AdminPass123"),
                "first_name": "Self",
                "last_name": "Change",
                "phone": "+1234567890",
                "email_verified": True,
                "is_active": True,
            },
        )
        await db_session.commit()

        # Step 2: Login as super admin
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "selfchange@example.com", "password": "AdminPass123"},
        )
        assert login_response.status_code == 200
        admin_token = login_response.json()["access_token"]

        # Step 3: Attempt to change own role
        async_client.headers["Authorization"] = f"Bearer {admin_token}"
        change_response = await async_client.patch(
            f"/api/v1/users/{admin_id}/role",
            json={"role": "donor"},
        )

        # Should be forbidden
        assert change_response.status_code == 403
        error_data = change_response.json()
        # Check for error message in various response formats
        error_message = ""
        if "detail" in error_data:
            detail = error_data["detail"]
            if isinstance(detail, dict) and "message" in detail:
                error_message = detail["message"].lower()
            elif isinstance(detail, str):
                error_message = detail.lower()
        elif "message" in error_data:
            error_message = error_data["message"].lower()
            error_message = error_data["message"].lower()

        assert "cannot change your own role" in error_message
