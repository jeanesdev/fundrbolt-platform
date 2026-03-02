"""Integration tests for email verification flow.

These tests verify the complete workflow of:
1. Creating a new user (admin action or registration)
2. Manually verifying their email address
3. Verifying permission checks (super_admin vs npo_admin scope)
4. Verifying audit logging of verification actions

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


class TestEmailVerificationIntegration:
    """Integration tests for complete email verification workflows."""

    @pytest.mark.asyncio
    async def test_super_admin_can_verify_any_user_email(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that super_admin can verify email for any user.

        Flow:
        1. Create super_admin user
        2. Create unverified donor user
        3. Super_admin verifies donor's email
        4. Verify email_verified is True
        5. Verify donor can now login
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
                "email": "superadmin.verify@example.com",
                "first_name": "Super",
                "last_name": "Admin",
                "password_hash": hash_password("SuperPass123"),
                "email_verified": True,
                "is_active": True,
                "role_id": super_admin_role_id,
            },
        )
        await db_session.commit()

        # Step 2: Create unverified donor user
        donor_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'donor'"))
        donor_role_id = donor_result.scalar_one()

        donor_id = uuid.uuid4()
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
                "id": donor_id,
                "email": "unverified.donor@example.com",
                "first_name": "Unverified",
                "last_name": "Donor",
                "password_hash": hash_password("DonorPass123"),
                "email_verified": False,
                "is_active": False,  # Not active until verified
                "role_id": donor_role_id,
            },
        )
        await db_session.commit()

        # Step 3: Login as super_admin and verify donor's email
        admin_login = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "superadmin.verify@example.com", "password": "SuperPass123"},
        )
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]

        async_client.headers["Authorization"] = f"Bearer {admin_token}"
        verify_response = await async_client.post(f"/api/v1/users/{donor_id}/verify-email")

        # Step 4: Verify response
        assert verify_response.status_code == 200
        verified_user = verify_response.json()
        assert verified_user["id"] == str(donor_id)
        assert verified_user["email"] == "unverified.donor@example.com"
        assert verified_user["email_verified"] is True
        assert verified_user["role"] == "donor"

        # Step 5: Activate user and verify they can login
        await db_session.execute(
            text("UPDATE users SET is_active = true WHERE id = :id"),
            {"id": donor_id},
        )
        await db_session.commit()

        donor_login = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "unverified.donor@example.com", "password": "DonorPass123"},
        )
        assert donor_login.status_code == 200
        donor_user = donor_login.json()["user"]
        assert donor_user["email_verified"] is True

    @pytest.mark.asyncio
    async def test_npo_admin_can_verify_users_in_their_npo(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that npo_admin can verify emails for users in their NPO.

        Flow:
        1. Create npo_admin with npo_id
        2. Create unverified user in same NPO
        3. NPO admin verifies user's email
        4. Verify email_verified is True
        """
        # Step 1: Create npo_admin
        npo_admin_result = await db_session.execute(
            text("SELECT id FROM roles WHERE name = 'npo_admin'")
        )
        npo_admin_role_id = npo_admin_result.scalar_one()

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
                "email": "npoadmin.verify@example.com",
                "first_name": "NPO",
                "last_name": "Admin",
                "password_hash": hash_password("NPOPass123"),
                "email_verified": True,
                "is_active": True,
                "role_id": npo_admin_role_id,
            },
        )

        npo = NPO(
            name="Verification NPO",
            description="NPO for email verification",
            mission_statement="Test email verification",
            email="verify-npo@example.com",
            phone="+1-555-0700",
            status=NPOStatus.APPROVED,
            created_by_user_id=admin_id,
        )
        db_session.add(npo)
        await db_session.flush()
        db_session.add(
            NPOMember(
                npo_id=npo.id,
                user_id=admin_id,
                role=MemberRole.ADMIN,
                status=MemberStatus.ACTIVE,
            )
        )
        await db_session.commit()

        # Step 2: Create unverified event_coordinator in same NPO
        coordinator_result = await db_session.execute(
            text("SELECT id FROM roles WHERE name = 'event_coordinator'")
        )
        coordinator_role_id = coordinator_result.scalar_one()

        coordinator_id = uuid.uuid4()
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
                "id": coordinator_id,
                "email": "coordinator.unverified@example.com",
                "first_name": "Unverified",
                "last_name": "Coordinator",
                "password_hash": hash_password("CoordPass123"),
                "email_verified": False,
                "is_active": False,
                "role_id": coordinator_role_id,
            },
        )
        db_session.add(
            NPOMember(
                npo_id=npo.id,
                user_id=coordinator_id,
                role=MemberRole.STAFF,
                status=MemberStatus.ACTIVE,
            )
        )
        await db_session.commit()

        # Step 3: Login as npo_admin and verify coordinator's email
        admin_login = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "npoadmin.verify@example.com", "password": "NPOPass123"},
        )
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]

        async_client.headers["Authorization"] = f"Bearer {admin_token}"
        verify_response = await async_client.post(
            f"/api/v1/users/{coordinator_id}/verify-email?npo_id={npo.id}"
        )

        # Step 4: Verify response
        assert verify_response.status_code == 200
        verified_user = verify_response.json()
        assert verified_user["id"] == str(coordinator_id)
        assert verified_user["email_verified"] is True
        assert verified_user["npo_id"] == str(npo.id)

    @pytest.mark.asyncio
    async def test_npo_admin_cannot_verify_users_in_different_npo(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that npo_admin CANNOT verify emails for users in different NPO.

        Flow:
        1. Create npo_admin with npo_id_1
        2. Create unverified user in npo_id_2
        3. NPO admin attempts to verify user's email
        4. Verify request is rejected with 403 Forbidden
        """
        npo_id_1 = uuid.uuid4()
        npo_id_2 = uuid.uuid4()

        # Step 1: Create npo_admin in NPO 1
        npo_admin_result = await db_session.execute(
            text("SELECT id FROM roles WHERE name = 'npo_admin'")
        )
        npo_admin_role_id = npo_admin_result.scalar_one()

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
                "email": "npoadmin.scope@example.com",
                "first_name": "NPO",
                "last_name": "Admin",
                "password_hash": hash_password("NPOPass123"),
                "email_verified": True,
                "is_active": True,
                "role_id": npo_admin_role_id,
            },
        )
        npo_one = NPO(
            id=npo_id_1,
            name=f"Verification NPO One {npo_id_1}",
            description="First NPO for email verification",
            mission_statement="Test email verification",
            email=f"verify-npo1-{npo_id_1}@example.com",
            phone="+1-555-0701",
            status=NPOStatus.APPROVED,
            created_by_user_id=admin_id,
        )
        db_session.add(npo_one)
        await db_session.flush()
        db_session.add(
            NPOMember(
                npo_id=npo_one.id,
                user_id=admin_id,
                role=MemberRole.ADMIN,
                status=MemberStatus.ACTIVE,
            )
        )
        await db_session.commit()

        # Step 2: Create unverified user in NPO 2
        coordinator_result = await db_session.execute(
            text("SELECT id FROM roles WHERE name = 'event_coordinator'")
        )
        coordinator_role_id = coordinator_result.scalar_one()

        coordinator_id = uuid.uuid4()
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
                "id": coordinator_id,
                "email": "coordinator.other.npo@example.com",
                "first_name": "Other",
                "last_name": "NPO",
                "password_hash": hash_password("CoordPass123"),
                "email_verified": False,
                "is_active": False,
                "role_id": coordinator_role_id,
            },
        )
        npo_two = NPO(
            id=npo_id_2,
            name=f"Verification NPO Two {npo_id_2}",
            description="Second NPO for email verification",
            mission_statement="Test email verification",
            email=f"verify-npo2-{npo_id_2}@example.com",
            phone="+1-555-0702",
            status=NPOStatus.APPROVED,
            created_by_user_id=admin_id,
        )
        db_session.add(npo_two)
        await db_session.flush()
        db_session.add(
            NPOMember(
                npo_id=npo_two.id,
                user_id=coordinator_id,
                role=MemberRole.STAFF,
                status=MemberStatus.ACTIVE,
            )
        )
        await db_session.commit()

        # Step 3: Login as npo_admin and attempt to verify user in different NPO
        admin_login = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "npoadmin.scope@example.com", "password": "NPOPass123"},
        )
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]

        async_client.headers["Authorization"] = f"Bearer {admin_token}"
        verify_response = await async_client.post(
            f"/api/v1/users/{coordinator_id}/verify-email?npo_id={npo_two.id}"
        )

        # Step 4: Verify request is rejected
        assert verify_response.status_code == 403
        error_data = verify_response.json()
        # Error format: {"detail": {"code": 403, "message": "...", "type": "HTTPException"}}
        error_message = ""
        if "detail" in error_data:
            detail = error_data["detail"]
            if isinstance(detail, dict) and "message" in detail:
                error_message = detail["message"].lower()
            elif isinstance(detail, str):
                error_message = detail.lower()
        elif "message" in error_data:
            error_message = error_data["message"].lower()
        assert "npo" in error_message or "permission" in error_message

    @pytest.mark.asyncio
    async def test_staff_and_donor_cannot_verify_emails(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that staff and donor roles cannot verify emails.

        Flow:
        1. Create staff user
        2. Create unverified donor user
        3. Staff attempts to verify donor's email
        4. Verify request is rejected with 403 Forbidden
        """
        # Step 1: Create staff user
        staff_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'staff'"))
        staff_role_id = staff_result.scalar_one()

        staff_id = uuid.uuid4()
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
                "id": staff_id,
                "email": "staff.noverify@example.com",
                "first_name": "Staff",
                "last_name": "User",
                "password_hash": hash_password("StaffPass123"),
                "email_verified": True,
                "is_active": True,
                "role_id": staff_role_id,
            },
        )
        await db_session.commit()

        # Step 2: Create unverified donor
        donor_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'donor'"))
        donor_role_id = donor_result.scalar_one()

        donor_id = uuid.uuid4()
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
                "id": donor_id,
                "email": "donor.unverified@example.com",
                "first_name": "Unverified",
                "last_name": "Donor",
                "password_hash": hash_password("DonorPass123"),
                "email_verified": False,
                "is_active": False,
                "role_id": donor_role_id,
            },
        )
        await db_session.commit()

        # Step 3: Login as staff and attempt to verify email
        staff_login = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "staff.noverify@example.com", "password": "StaffPass123"},
        )
        assert staff_login.status_code == 200
        staff_token = staff_login.json()["access_token"]

        async_client.headers["Authorization"] = f"Bearer {staff_token}"
        verify_response = await async_client.post(f"/api/v1/users/{donor_id}/verify-email")

        # Step 4: Verify request is rejected
        assert verify_response.status_code == 403

    @pytest.mark.asyncio
    async def test_verify_email_for_nonexistent_user(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that verifying email for non-existent user returns 404.

        Flow:
        1. Create super_admin
        2. Attempt to verify email for random UUID
        3. Verify request returns 404 Not Found
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
                "email": "superadmin.404@example.com",
                "first_name": "Super",
                "last_name": "Admin",
                "password_hash": hash_password("SuperPass123"),
                "email_verified": True,
                "is_active": True,
                "role_id": super_admin_role_id,
            },
        )
        await db_session.commit()

        # Step 2: Login as super_admin
        admin_login = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "superadmin.404@example.com", "password": "SuperPass123"},
        )
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]

        # Step 3: Attempt to verify non-existent user
        fake_user_id = uuid.uuid4()
        async_client.headers["Authorization"] = f"Bearer {admin_token}"
        verify_response = await async_client.post(f"/api/v1/users/{fake_user_id}/verify-email")

        # Step 4: Verify 404 response
        assert verify_response.status_code == 404
        error_data = verify_response.json()
        # Error format: {"detail": {"code": 404, "message": "...", "type": "HTTPException"}}
        assert "detail" in error_data

    @pytest.mark.asyncio
    async def test_verify_email_idempotent(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test that verifying already-verified email is idempotent.

        Flow:
        1. Create super_admin
        2. Create already-verified user
        3. Verify email again
        4. Verify still returns 200 with email_verified=True
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
                "email": "superadmin.idempotent@example.com",
                "first_name": "Super",
                "last_name": "Admin",
                "password_hash": hash_password("SuperPass123"),
                "email_verified": True,
                "is_active": True,
                "role_id": super_admin_role_id,
            },
        )
        await db_session.commit()

        # Step 2: Create already-verified donor
        donor_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'donor'"))
        donor_role_id = donor_result.scalar_one()

        donor_id = uuid.uuid4()
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
                "id": donor_id,
                "email": "already.verified@example.com",
                "first_name": "Already",
                "last_name": "Verified",
                "password_hash": hash_password("DonorPass123"),
                "email_verified": True,  # Already verified
                "is_active": True,
                "role_id": donor_role_id,
            },
        )
        await db_session.commit()

        # Step 3: Login as super_admin and verify already-verified user
        admin_login = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "superadmin.idempotent@example.com", "password": "SuperPass123"},
        )
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]

        async_client.headers["Authorization"] = f"Bearer {admin_token}"
        verify_response = await async_client.post(f"/api/v1/users/{donor_id}/verify-email")

        # Step 4: Verify idempotent response
        assert verify_response.status_code == 200
        verified_user = verify_response.json()
        assert verified_user["email_verified"] is True

    @pytest.mark.asyncio
    async def test_complete_admin_creates_and_verifies_user_flow(
        self, async_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Test complete flow: admin creates user, verifies email, user can login.

        Flow:
        1. Create super_admin
        2. Super_admin creates new user via POST /users
        3. Super_admin verifies new user's email
        4. Super_admin activates user
        5. User can login successfully
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
                "email": "superadmin.complete@example.com",
                "first_name": "Super",
                "last_name": "Admin",
                "password_hash": hash_password("SuperPass123"),
                "email_verified": True,
                "is_active": True,
                "role_id": super_admin_role_id,
            },
        )
        await db_session.commit()

        npo = NPO(
            name="Complete Flow NPO",
            description="NPO for complete verification flow",
            mission_statement="Test verification flow",
            email="complete-flow-npo@example.com",
            phone="+1-555-0710",
            status=NPOStatus.APPROVED,
            created_by_user_id=admin_id,
        )
        db_session.add(npo)
        await db_session.commit()

        # Step 2: Login as super_admin and create new user
        admin_login = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "superadmin.complete@example.com", "password": "SuperPass123"},
        )
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]

        async_client.headers["Authorization"] = f"Bearer {admin_token}"
        create_response = await async_client.post(
            "/api/v1/users",
            json={
                "email": "newuser.complete@example.com",
                "first_name": "New",
                "last_name": "User",
                "password": "NewUserPass123",
                "role": "staff",
                "npo_id": str(npo.id),
            },
        )
        assert create_response.status_code == 201
        new_user = create_response.json()
        new_user_id = new_user["id"]
        assert new_user["email_verified"] is False
        assert new_user["is_active"] is False

        # Step 3: Super_admin verifies new user's email
        verify_response = await async_client.post(f"/api/v1/users/{new_user_id}/verify-email")
        assert verify_response.status_code == 200
        verified_user = verify_response.json()
        assert verified_user["email_verified"] is True

        # Step 4: Super_admin activates user
        activate_response = await async_client.post(
            f"/api/v1/users/{new_user_id}/activate",
            json={"is_active": True},
        )
        assert activate_response.status_code == 200

        # Step 5: User can login successfully
        user_login = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "newuser.complete@example.com", "password": "NewUserPass123"},
        )
        assert user_login.status_code == 200
        user_info = user_login.json()["user"]
        assert user_info["email_verified"] is True
        assert user_info["is_active"] is True
        assert user_info["role"] == "staff"
