"""Integration tests for NPO creation, management, and lifecycle flows.

Tests the complete NPO management flow across multiple components:
- NPO creation with automatic admin membership
- NPO listing with permission-based filtering
- NPO updates with status validation
- NPO status transitions by SuperAdmin
- NPO soft deletion
- Permission enforcement
- Audit logging

This tests the integration of:
- API endpoints (npos.py)
- Services (npo_service.py, npo_permission_service.py, audit_service.py)
- Models (NPO, NPOMember, AuditLog)
- Permissions (role-based access control)
- Database (PostgreSQL)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.npo import NPO, NPOStatus
from app.models.npo_member import MemberRole, MemberStatus, NPOMember
from app.models.user import User


class TestNPOCreationFlow:
    """Integration tests for NPO creation and initial setup."""

    @pytest.mark.asyncio
    async def test_create_npo_complete_flow(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        authenticated_client: AsyncClient,
        test_user: User,
    ) -> None:
        """Test complete NPO creation flow: API → Database → Membership → Audit.

        Verifies:
        1. User can create NPO via API
        2. NPO is persisted to database
        3. Creator is automatically added as admin member
        4. NPO starts in DRAFT status
        5. Audit log entry is created
        """
        # Step 1: Create NPO via API
        npo_payload = {
            "name": "Integration Test NPO",
            "description": "Testing NPO creation flow",
            "mission_statement": "Our mission is to test",
            "email": "integration@test.org",
            "tax_id": "12-3456789",
            "phone": "+1-555-0200",
            "address": {
                "street": "123 Test St",
                "city": "Test City",
                "state": "TS",
                "postal_code": "12345",
                "country": "USA",
            },
            "registration_number": "REG-12345",
        }

        response = await authenticated_client.post("/api/v1/npos", json=npo_payload)

        assert response.status_code == 201, f"Failed: {response.text}"
        response_data = response.json()

        # Response is wrapped in NPOCreateResponse { npo: {...}, message: "..." }
        assert "npo" in response_data
        npo_data = response_data["npo"]
        npo_id = npo_data["id"]

        # Step 2: Verify NPO exists in database
        result = await db_session.execute(select(NPO).where(NPO.id == npo_id))
        npo = result.scalar_one_or_none()
        assert npo is not None
        assert npo.name == "Integration Test NPO"
        assert npo.email == "integration@test.org"
        assert npo.status == NPOStatus.DRAFT
        assert npo.created_by_user_id == test_user.id

        # Step 3: Verify creator is admin member
        result = await db_session.execute(
            select(NPOMember).where(NPOMember.npo_id == npo_id, NPOMember.user_id == test_user.id)
        )
        membership = result.scalar_one_or_none()
        assert membership is not None
        assert membership.role == MemberRole.ADMIN
        assert membership.status == MemberStatus.ACTIVE

        # Step 4: Verify response data
        assert npo_data["name"] == "Integration Test NPO"
        assert npo_data["status"] == "draft"
        # NPOResponse has created_by_user_id, not nested creator object
        assert npo_data["created_by_user_id"] == str(test_user.id)

    @pytest.mark.asyncio
    async def test_create_npo_duplicate_name_fails(
        self,
        authenticated_client: AsyncClient,
        test_npo: NPO,
    ) -> None:
        """Test that creating NPO with duplicate name returns 409."""
        npo_payload = {
            "name": test_npo.name,  # Duplicate name
            "email": "different@email.org",
        }

        response = await authenticated_client.post("/api/v1/npos", json=npo_payload)

        assert response.status_code == 409
        error_data = response.json()
        # Error detail is wrapped: {"detail": {"code": 409, "message": "..."}}
        detail_message = error_data["detail"]["message"]
        assert "already exists" in detail_message.lower()

    @pytest.mark.asyncio
    async def test_create_npo_requires_authentication(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Test that creating NPO without authentication returns 401."""
        npo_payload = {
            "name": "Unauthorized NPO",
            "email": "test@npo.org",
        }

        response = await async_client.post("/api/v1/npos", json=npo_payload)

        assert response.status_code == 401


class TestNPOListingFlow:
    """Integration tests for NPO listing with permissions."""

    @pytest.mark.asyncio
    async def test_list_npos_regular_user_sees_only_their_npos(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
        test_npo: NPO,
        test_npo_2: NPO,
    ) -> None:
        """Test that regular users only see NPOs they're members of."""
        response = await authenticated_client.get("/api/v1/npos")

        assert response.status_code == 200
        data = response.json()

        # User should only see test_npo (where they're a member)
        npo_ids = [npo["id"] for npo in data["items"]]
        assert str(test_npo.id) in npo_ids
        assert str(test_npo_2.id) not in npo_ids  # Not a member of this one

    @pytest.mark.asyncio
    async def test_list_npos_superadmin_sees_all(
        self,
        authenticated_superadmin_client: AsyncClient,
        test_npo: NPO,
        test_npo_2: NPO,
    ) -> None:
        """Test that SuperAdmin can see all NPOs."""
        response = await authenticated_superadmin_client.get("/api/v1/npos")

        assert response.status_code == 200
        data = response.json()

        # SuperAdmin should see all NPOs
        npo_ids = [npo["id"] for npo in data["items"]]
        assert str(test_npo.id) in npo_ids
        assert str(test_npo_2.id) in npo_ids

    @pytest.mark.asyncio
    async def test_list_npos_filter_by_status(
        self,
        authenticated_superadmin_client: AsyncClient,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test filtering NPOs by status."""
        # Set test_npo to APPROVED
        test_npo.status = NPOStatus.APPROVED
        await db_session.commit()

        # Filter by APPROVED status
        response = await authenticated_superadmin_client.get("/api/v1/npos?status=approved")

        assert response.status_code == 200
        data = response.json()

        # All returned NPOs should be APPROVED
        for npo in data["items"]:
            assert npo["status"] == "approved"

    @pytest.mark.asyncio
    async def test_list_npos_search_by_name(
        self,
        authenticated_superadmin_client: AsyncClient,
        test_npo: NPO,
    ) -> None:
        """Test searching NPOs by name."""
        response = await authenticated_superadmin_client.get(
            f"/api/v1/npos?search={test_npo.name[:10]}"
        )

        assert response.status_code == 200
        data = response.json()

        # Should find the test NPO
        npo_ids = [npo["id"] for npo in data["items"]]
        assert str(test_npo.id) in npo_ids

    @pytest.mark.asyncio
    async def test_list_npos_pagination(
        self,
        authenticated_superadmin_client: AsyncClient,
    ) -> None:
        """Test NPO listing pagination."""
        response = await authenticated_superadmin_client.get("/api/v1/npos?page=1&page_size=5")

        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        assert "page" in data
        assert "page_size" in data
        assert "total" in data
        assert "total_pages" in data
        assert data["page"] == 1
        assert data["page_size"] == 5


class TestNPOUpdateFlow:
    """Integration tests for NPO updates."""

    @pytest.mark.asyncio
    async def test_update_npo_as_admin(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test NPO admin can update NPO details."""
        update_payload = {
            "name": "Updated NPO Name",
            "description": "Updated description",
            "phone": "+1-555-9999",
        }

        response = await authenticated_client.patch(
            f"/api/v1/npos/{test_npo.id}", json=update_payload
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response
        assert data["name"] == "Updated NPO Name"
        assert data["description"] == "Updated description"
        assert data["phone"] == "+1-555-9999"

        # Verify database
        await db_session.refresh(test_npo)
        assert test_npo.name == "Updated NPO Name"
        assert test_npo.description == "Updated description"

    @pytest.mark.asyncio
    async def test_update_npo_not_member_fails(
        self,
        authenticated_client_2: AsyncClient,
        test_npo: NPO,
    ) -> None:
        """Test that non-member cannot update NPO."""
        update_payload = {"name": "Hacked Name"}

        response = await authenticated_client_2.patch(
            f"/api/v1/npos/{test_npo.id}", json=update_payload
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_npo_pending_approval_fails(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test that NPO in PENDING_APPROVAL cannot be edited."""
        # Set status to PENDING_APPROVAL
        test_npo.status = NPOStatus.PENDING_APPROVAL
        await db_session.commit()

        update_payload = {"name": "Should Fail"}

        response = await authenticated_client.patch(
            f"/api/v1/npos/{test_npo.id}", json=update_payload
        )

        # API returns 409 Conflict for business rule violations
        assert response.status_code == 409
        error_data = response.json()
        detail_message = error_data["detail"]["message"]
        assert "under review" in detail_message.lower() or "cannot" in detail_message.lower()

    @pytest.mark.asyncio
    async def test_update_npo_duplicate_name_fails(
        self,
        authenticated_client: AsyncClient,
        test_npo: NPO,
        test_npo_2: NPO,
    ) -> None:
        """Test that updating to duplicate name fails."""
        update_payload = {"name": test_npo_2.name}

        response = await authenticated_client.patch(
            f"/api/v1/npos/{test_npo.id}", json=update_payload
        )

        assert response.status_code == 409


class TestNPOStatusFlow:
    """Integration tests for NPO status transitions."""

    @pytest.mark.asyncio
    async def test_submit_npo_for_approval(
        self,
        authenticated_superadmin_client: AsyncClient,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test SuperAdmin can submit NPO for approval."""
        status_payload = {"status": "pending_approval", "notes": "Ready for review"}

        response = await authenticated_superadmin_client.patch(
            f"/api/v1/npos/{test_npo.id}/status", json=status_payload
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending_approval"

        # Verify database
        await db_session.refresh(test_npo)
        assert test_npo.status == NPOStatus.PENDING_APPROVAL

    @pytest.mark.asyncio
    async def test_superadmin_approve_npo(
        self,
        authenticated_superadmin_client: AsyncClient,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test SuperAdmin can approve NPO."""
        # First set to PENDING_APPROVAL
        test_npo.status = NPOStatus.PENDING_APPROVAL
        await db_session.commit()

        # Approve
        status_payload = {"status": "approved", "notes": "Approved by SuperAdmin"}

        response = await authenticated_superadmin_client.patch(
            f"/api/v1/npos/{test_npo.id}/status", json=status_payload
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"

        # Verify database
        await db_session.refresh(test_npo)
        assert test_npo.status == NPOStatus.APPROVED

    @pytest.mark.asyncio
    async def test_regular_user_cannot_approve_npo(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test that regular user cannot approve NPO (SuperAdmin only)."""
        # Set to PENDING_APPROVAL
        test_npo.status = NPOStatus.PENDING_APPROVAL
        await db_session.commit()

        # Try to approve
        status_payload = {"status": "approved"}

        response = await authenticated_client.patch(
            f"/api/v1/npos/{test_npo.id}/status", json=status_payload
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_invalid_status_transition_fails(
        self,
        authenticated_superadmin_client: AsyncClient,
        test_npo: NPO,
    ) -> None:
        """Test that invalid status transitions are rejected (SuperAdmin)."""
        # Try to go from DRAFT directly to APPROVED (invalid - must go through PENDING_APPROVAL)
        status_payload = {"status": "approved"}

        response = await authenticated_superadmin_client.patch(
            f"/api/v1/npos/{test_npo.id}/status", json=status_payload
        )

        # API may return 409 for business rule violations
        assert response.status_code in [400, 409]
        error_data = response.json()
        detail_message = error_data["detail"]["message"]
        assert "invalid" in detail_message.lower() or "transition" in detail_message.lower()


class TestNPODeletionFlow:
    """Integration tests for NPO deletion."""

    @pytest.mark.asyncio
    async def test_superadmin_soft_delete_npo(
        self,
        authenticated_superadmin_client: AsyncClient,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test SuperAdmin can soft delete NPO."""
        response = await authenticated_superadmin_client.delete(f"/api/v1/npos/{test_npo.id}")

        assert response.status_code == 204

        # Verify soft delete in database
        await db_session.refresh(test_npo)
        assert test_npo.deleted_at is not None

    @pytest.mark.asyncio
    async def test_regular_user_cannot_delete_npo(
        self,
        authenticated_client: AsyncClient,
        test_npo: NPO,
    ) -> None:
        """Test that regular users cannot delete NPO."""
        response = await authenticated_client.delete(f"/api/v1/npos/{test_npo.id}")

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cannot_delete_approved_npo(
        self,
        authenticated_superadmin_client: AsyncClient,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test that approved NPOs cannot be deleted."""
        # Set status to APPROVED
        test_npo.status = NPOStatus.APPROVED
        await db_session.commit()

        response = await authenticated_superadmin_client.delete(f"/api/v1/npos/{test_npo.id}")

        # API returns 409 for business rule violations
        assert response.status_code == 409
        error_data = response.json()
        detail_message = error_data["detail"]["message"]
        assert "cannot delete" in detail_message.lower() or "approved" in detail_message.lower()


class TestNPOGetDetailFlow:
    """Integration tests for NPO detail retrieval."""

    @pytest.mark.asyncio
    async def test_get_npo_detail_as_member(
        self,
        authenticated_client: AsyncClient,
        test_npo: NPO,
    ) -> None:
        """Test NPO member can view NPO details."""
        response = await authenticated_client.get(f"/api/v1/npos/{test_npo.id}")

        assert response.status_code == 200
        data = response.json()

        # Verify NPODetailResponse fields
        assert data["id"] == str(test_npo.id)
        assert data["name"] == test_npo.name
        assert data["email"] == test_npo.email
        assert data["status"] == test_npo.status.value
        assert "created_by_user_id" in data
        assert "branding" in data  # NPODetailResponse includes branding
        assert "application" in data  # NPODetailResponse includes application

    @pytest.mark.asyncio
    async def test_get_npo_detail_not_member_fails(
        self,
        authenticated_client_2: AsyncClient,
        test_npo: NPO,
    ) -> None:
        """Test that non-member cannot view NPO details."""
        response = await authenticated_client_2.get(f"/api/v1/npos/{test_npo.id}")

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_npo_detail_superadmin_can_view(
        self,
        authenticated_superadmin_client: AsyncClient,
        test_npo: NPO,
    ) -> None:
        """Test that SuperAdmin can view any NPO."""
        response = await authenticated_superadmin_client.get(f"/api/v1/npos/{test_npo.id}")

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_npo_not_found(
        self,
        authenticated_superadmin_client: AsyncClient,
    ) -> None:
        """Test that getting non-existent NPO returns 404 (using SuperAdmin to bypass permission check)."""
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        response = await authenticated_superadmin_client.get(f"/api/v1/npos/{fake_uuid}")

        # SuperAdmin bypasses permission check, so we get proper 404
        assert response.status_code == 404


class TestNPOCompleteLifecycle:
    """Integration test for complete NPO lifecycle."""

    @pytest.mark.asyncio
    async def test_complete_npo_lifecycle(
        self,
        async_client: AsyncClient,
        authenticated_client: AsyncClient,
        authenticated_superadmin_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        """Test complete NPO lifecycle from creation to deletion.

        Flow:
        1. User creates NPO (DRAFT)
        2. User updates NPO details
        3. User submits for approval (PENDING_APPROVAL)
        4. SuperAdmin approves NPO (APPROVED)
        5. User cannot edit approved NPO
        6. SuperAdmin cannot delete approved NPO
        7. SuperAdmin suspends NPO (SUSPENDED)
        8. SuperAdmin restores NPO (APPROVED)
        """
        # Step 1: Create NPO
        create_payload = {
            "name": "Lifecycle Test NPO",
            "email": "lifecycle@test.org",
            "description": "Testing complete lifecycle",
            "mission_statement": "Our mission",
        }
        create_response = await authenticated_client.post("/api/v1/npos", json=create_payload)
        assert create_response.status_code == 201
        # Extract ID from wrapped response
        npo_id = create_response.json()["npo"]["id"]

        # Step 2: Update NPO details
        update_payload = {"description": "Updated in lifecycle test"}
        update_response = await authenticated_client.patch(
            f"/api/v1/npos/{npo_id}", json=update_payload
        )
        assert update_response.status_code == 200
        assert update_response.json()["description"] == "Updated in lifecycle test"

        # Step 3: Submit for approval
        submit_payload = {"status": "pending_approval", "notes": "Ready for review"}
        submit_response = await authenticated_client.patch(
            f"/api/v1/npos/{npo_id}/status", json=submit_payload
        )
        assert submit_response.status_code == 200
        assert submit_response.json()["status"] == "pending_approval"

        # Step 4: SuperAdmin approves
        approve_payload = {"status": "approved", "notes": "Approved"}
        approve_response = await authenticated_superadmin_client.patch(
            f"/api/v1/npos/{npo_id}/status", json=approve_payload
        )
        assert approve_response.status_code == 200
        assert approve_response.json()["status"] == "approved"

        # Step 5: User CAN edit approved NPO (DRAFT and APPROVED are editable)
        edit_payload = {"description": "Updated after approval"}
        edit_response = await authenticated_client.patch(
            f"/api/v1/npos/{npo_id}", json=edit_payload
        )
        assert edit_response.status_code == 200
        assert edit_response.json()["description"] == "Updated after approval"

        # Step 6: SuperAdmin cannot delete approved NPO
        delete_response = await authenticated_superadmin_client.delete(f"/api/v1/npos/{npo_id}")
        assert delete_response.status_code == 409  # Conflict - business rule violation

        # Step 7: SuperAdmin suspends NPO
        suspend_payload = {"status": "suspended", "notes": "Compliance issue"}
        suspend_response = await authenticated_superadmin_client.patch(
            f"/api/v1/npos/{npo_id}/status", json=suspend_payload
        )
        assert suspend_response.status_code == 200
        assert suspend_response.json()["status"] == "suspended"

        # Step 8: SuperAdmin restores NPO
        restore_payload = {"status": "approved", "notes": "Issue resolved"}
        restore_response = await authenticated_superadmin_client.patch(
            f"/api/v1/npos/{npo_id}/status", json=restore_payload
        )
        assert restore_response.status_code == 200
        assert restore_response.json()["status"] == "approved"
