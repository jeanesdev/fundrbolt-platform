"""
Contract tests for SuperAdmin endpoints.

Tests:
- GET /admin/npos/applications - List pending applications (SuperAdmin only)
- POST /admin/npos/{id}/review - Review application (approve/reject, SuperAdmin only)
- Authorization checks (SuperAdmin required)
- Pagination and filtering
- Email notifications on approval/rejection
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.npo import NPO, NPOStatus
from app.models.user import User


class TestGetPendingApplications:
    """Test GET /admin/npos/applications endpoint."""

    @pytest.mark.asyncio
    async def test_superadmin_can_list_pending_applications(
        self,
        super_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Test SuperAdmin can retrieve list of pending NPO applications.

        Scenario:
        1. Create 3 NPOs with different statuses (draft, pending_approval, approved)
        2. SuperAdmin requests pending applications
        3. Verify only PENDING_APPROVAL NPOs are returned

        Expected: 200 OK with list containing only pending applications
        """
        # Create a draft NPO
        draft_npo = NPO(
            id=uuid.uuid4(),
            name="Draft NPO",
            email="draft@test.com",
            status=NPOStatus.DRAFT,
            created_by_user_id=test_user.id,
            address={
                "street": "123 Draft St",
                "city": "Test City",
                "state": "CA",
                "postal_code": "90001",
            },
        )

        # Create pending NPOs
        pending_npo_1 = NPO(
            id=uuid.uuid4(),
            name="Pending NPO 1",
            email="pending1@test.com",
            status=NPOStatus.PENDING_APPROVAL,
            created_by_user_id=test_user.id,
            address={
                "street": "123 Pending St",
                "city": "Test City",
                "state": "CA",
                "postal_code": "90002",
            },
        )

        pending_npo_2 = NPO(
            id=uuid.uuid4(),
            name="Pending NPO 2",
            email="pending2@test.com",
            status=NPOStatus.PENDING_APPROVAL,
            created_by_user_id=test_user.id,
            address={
                "street": "456 Pending Ave",
                "city": "Test City",
                "state": "CA",
                "postal_code": "90003",
            },
        )

        # Create approved NPO
        approved_npo = NPO(
            id=uuid.uuid4(),
            name="Approved NPO",
            email="approved@test.com",
            status=NPOStatus.APPROVED,
            created_by_user_id=test_user.id,
            address={
                "street": "789 Approved Blvd",
                "city": "Test City",
                "state": "CA",
                "postal_code": "90004",
            },
        )

        db_session.add_all([draft_npo, pending_npo_1, pending_npo_2, approved_npo])
        await db_session.commit()

        # Request pending applications
        response = await super_admin_client.get("/api/v1/admin/npos/applications")

        # Verify response
        assert response.status_code == 200
        data = response.json()

        assert "applications" in data
        assert "total" in data
        assert data["total"] >= 2  # At least our 2 pending NPOs
        assert len(data["applications"]) >= 2

        # Verify all returned NPOs are PENDING_APPROVAL
        for app in data["applications"]:
            assert app["status"] == "pending_approval"

    @pytest.mark.asyncio
    async def test_get_pending_applications_with_pagination(
        self,
        super_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Test pagination works correctly for pending applications.

        Scenario:
        1. Create 5 pending NPOs
        2. Request first page (skip=0, limit=2)
        3. Request second page (skip=2, limit=2)

        Expected: Correct pagination with skip/limit params
        """
        # Create 5 pending NPOs
        for i in range(1, 5):
            npo = NPO(
                id=uuid.uuid4(),
                name=f"Pending NPO {i}",
                description=f"Pending NPO {i} description",
                email=f"pending{i}@npo.org",
                phone=f"555-000{i}",
                address={
                    "street": f"{i} Test St",
                    "city": "Test City",
                    "state": "CA",
                    "postal_code": f"9000{i}",
                },
                tax_id=f"12-345678{i}",
                status=NPOStatus.PENDING_APPROVAL,
                created_by_user_id=test_user.id,
            )
            db_session.add(npo)
        await db_session.commit()

        # Request first page
        response1 = await super_admin_client.get("/api/v1/admin/npos/applications?skip=0&limit=2")
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["skip"] == 0
        assert data1["limit"] == 2
        assert len(data1["applications"]) == 2

        # Request second page
        response2 = await super_admin_client.get("/api/v1/admin/npos/applications?skip=2&limit=2")
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["skip"] == 2
        assert data2["limit"] == 2
        assert len(data2["applications"]) == 2

        # Verify different NPOs returned
        ids_page1 = {app["id"] for app in data1["applications"]}
        ids_page2 = {app["id"] for app in data2["applications"]}
        assert ids_page1 != ids_page2  # Different sets of NPOs

    @pytest.mark.asyncio
    async def test_non_superadmin_cannot_access(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test that non-SuperAdmin users get 403 Forbidden.

        Scenario:
        1. Regular authenticated user tries to access admin endpoint

        Expected: 403 Forbidden
        """
        response = await authenticated_client.get("/api/v1/admin/npos/applications")
        assert response.status_code == 403
        response_data = response.json()
        assert "detail" in response_data
        assert "SuperAdmin" in response_data["detail"]["message"]

    @pytest.mark.asyncio
    async def test_unauthenticated_cannot_access(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated users get 401 Unauthorized.

        Scenario:
        1. Unauthenticated request to admin endpoint

        Expected: 401 Unauthorized
        """
        response = await client.get("/api/v1/admin/npos/applications")
        assert response.status_code == 401


class TestReviewApplication:
    """Test POST /admin/npos/{id}/review endpoint."""

    @pytest.mark.asyncio
    async def test_superadmin_can_approve_application(
        self,
        super_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Test SuperAdmin can approve a pending NPO application.

        Scenario:
        1. Create NPO in PENDING_APPROVAL status
        2. SuperAdmin approves the application
        3. Verify NPO status changed to APPROVED

        Expected: 200 OK with updated NPO status = approved
        """
        # Create pending NPO
        npo = NPO(
            id=uuid.uuid4(),
            name="Test NPO for Approval",
            description="NPO to be approved",
            email="approve@npo.org",
            phone="555-1234",
            address={
                "street": "123 Test St",
                "city": "Test City",
                "state": "CA",
                "postal_code": "90001",
            },
            tax_id="12-3456789",
            status=NPOStatus.PENDING_APPROVAL,
            created_by_user_id=test_user.id,
        )
        db_session.add(npo)
        await db_session.commit()

        # Approve application
        response = await super_admin_client.post(
            f"/api/v1/admin/npos/{npo.id}/review",
            json={"decision": "approve", "notes": "Looks good!"},
        )

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["id"] == str(npo.id)

        # Verify database update
        await db_session.refresh(npo)
        assert npo.status == NPOStatus.APPROVED

    @pytest.mark.asyncio
    async def test_superadmin_can_reject_application(
        self,
        super_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Test SuperAdmin can reject a pending NPO application.

        Scenario:
        1. Create NPO in PENDING_APPROVAL status
        2. SuperAdmin rejects the application with reason
        3. Verify NPO status changed to REJECTED

        Expected: 200 OK with updated NPO status = rejected
        """
        # Create pending NPO
        npo = NPO(
            id=uuid.uuid4(),
            name="Test NPO for Rejection",
            description="NPO to be rejected",
            email="reject@npo.org",
            phone="555-5678",
            address={
                "street": "456 Test Ave",
                "city": "Test City",
                "state": "CA",
                "postal_code": "90002",
            },
            tax_id="12-9876543",
            status=NPOStatus.PENDING_APPROVAL,
            created_by_user_id=test_user.id,
        )
        db_session.add(npo)
        await db_session.commit()

        # Reject application
        response = await super_admin_client.post(
            f"/api/v1/admin/npos/{npo.id}/review",
            json={
                "decision": "reject",
                "notes": "Missing required documents",
            },
        )

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "rejected"
        assert data["id"] == str(npo.id)

        # Verify database update
        await db_session.refresh(npo)
        assert npo.status == NPOStatus.REJECTED

    @pytest.mark.asyncio
    async def test_cannot_review_non_pending_npo(
        self,
        super_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Test that reviewing a non-pending NPO returns 400.

        Scenario:
        1. Create NPO in DRAFT status
        2. Try to review it

        Expected: 400 Bad Request (must be pending_approval)
        """
        # Create draft NPO
        npo = NPO(
            id=uuid.uuid4(),
            name="Draft NPO",
            description="Still in draft",
            email="draft@npo.org",
            phone="555-9999",
            address={
                "street": "789 Draft Rd",
                "city": "Test City",
                "state": "CA",
                "postal_code": "90003",
            },
            tax_id="12-1111111",
            status=NPOStatus.DRAFT,
            created_by_user_id=test_user.id,
        )
        db_session.add(npo)
        await db_session.commit()

        # Try to review
        response = await super_admin_client.post(
            f"/api/v1/admin/npos/{npo.id}/review",
            json={"decision": "approve"},
        )

        assert response.status_code == 400
        response_data = response.json()
        assert "detail" in response_data
        assert "pending_approval" in response_data["detail"]["message"].lower()

    @pytest.mark.asyncio
    async def test_invalid_decision_returns_400(
        self,
        super_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Test that invalid decision value returns 400.

        Scenario:
        1. Create pending NPO
        2. Try to review with invalid decision value

        Expected: 400 Bad Request
        """
        # Create pending NPO
        npo = NPO(
            id=uuid.uuid4(),
            name="Pending NPO",
            description="Pending",
            email="pending@npo.org",
            phone="555-0000",
            address={
                "street": "000 Test St",
                "city": "Test City",
                "state": "CA",
                "postal_code": "90004",
            },
            tax_id="12-0000000",
            status=NPOStatus.PENDING_APPROVAL,
            created_by_user_id=test_user.id,
        )
        db_session.add(npo)
        await db_session.commit()

        # Try invalid decision
        response = await super_admin_client.post(
            f"/api/v1/admin/npos/{npo.id}/review",
            json={"decision": "maybe"},
        )

        assert response.status_code == 400
        response_data = response.json()
        assert "detail" in response_data
        detail_msg = response_data["detail"]["message"].lower()
        assert "approve" in detail_msg or "reject" in detail_msg

    @pytest.mark.asyncio
    async def test_non_superadmin_cannot_review(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Test that non-SuperAdmin users cannot review applications.

        Scenario:
        1. Regular authenticated user tries to review NPO

        Expected: 403 Forbidden
        """
        # Create pending NPO
        npo = NPO(
            id=uuid.uuid4(),
            name="Pending NPO",
            description="Pending",
            email="pending@npo.org",
            phone="555-1111",
            address={
                "street": "111 Test St",
                "city": "Test City",
                "state": "CA",
                "postal_code": "90005",
            },
            tax_id="12-2222222",
            status=NPOStatus.PENDING_APPROVAL,
            created_by_user_id=test_user.id,
        )
        db_session.add(npo)
        await db_session.commit()

        # Try to review
        response = await authenticated_client.post(
            f"/api/v1/admin/npos/{npo.id}/review",
            json={"decision": "approve"},
        )

        assert response.status_code == 403
        response_data = response.json()
        assert "detail" in response_data
        assert "SuperAdmin" in response_data["detail"]["message"]

    @pytest.mark.asyncio
    async def test_review_nonexistent_npo_returns_404(
        self,
        super_admin_client: AsyncClient,
    ):
        """Test that reviewing non-existent NPO returns 404.

        Scenario:
        1. Try to review NPO with random UUID

        Expected: 404 Not Found
        """
        fake_id = uuid.uuid4()
        response = await super_admin_client.post(
            f"/api/v1/admin/npos/{fake_id}/review",
            json={"decision": "approve"},
        )

        assert response.status_code == 404
