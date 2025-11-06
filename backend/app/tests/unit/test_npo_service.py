"""Unit tests for NPO Service."""

import uuid
from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.npo import NPO, NPOStatus
from app.models.npo_member import MemberRole, MemberStatus, NPOMember
from app.models.user import User
from app.schemas.npo import NPOCreateRequest, NPOListRequest, NPOUpdateRequest
from app.services.npo_service import NPOService


@pytest.mark.asyncio
class TestNPOServiceCreate:
    """Test NPO creation logic."""

    async def test_create_npo_success(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        """Test successful NPO creation."""
        # Arrange
        npo_data = NPOCreateRequest(
            name="Test NPO",
            description="A test non-profit organization",
            mission_statement="Help people test software",
            email="test@testnpo.org",
            phone="+1-555-0100",
            tax_id="12-3456789",
            address={
                "street": "123 Test St",
                "city": "Test City",
                "state": "TS",
                "zipCode": "12345",
                "country": "US",
            },
            registration_number="REG123456",
        )

        # Act
        npo = await NPOService.create_npo(db_session, npo_data, test_user.id)

        # Assert
        assert npo.id is not None
        assert npo.name == "Test NPO"
        assert npo.description == "A test non-profit organization"
        assert npo.status == NPOStatus.DRAFT
        assert npo.created_by_user_id == test_user.id
        assert npo.email == "test@testnpo.org"
        assert npo.tax_id == "12-3456789"

        # Verify creator is auto-added as admin member
        from sqlalchemy import select

        stmt = select(NPOMember).where(
            NPOMember.npo_id == npo.id, NPOMember.user_id == test_user.id
        )
        result = await db_session.execute(stmt)
        member = result.scalar_one_or_none()

        assert member is not None
        assert member.role == MemberRole.ADMIN
        assert member.status == MemberStatus.ACTIVE

    async def test_create_npo_duplicate_name(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_npo: NPO,
    ) -> None:
        """Test NPO creation with duplicate name fails."""
        # Arrange - try to create NPO with same name as test_npo
        npo_data = NPOCreateRequest(
            name=test_npo.name,  # Duplicate name
            email="different@email.org",
        )

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await NPOService.create_npo(db_session, npo_data, test_user.id)

        assert exc_info.value.status_code == 409
        assert "already exists" in str(exc_info.value.detail).lower()

    async def test_create_npo_case_insensitive_name(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_npo: NPO,
    ) -> None:
        """Test NPO name uniqueness is case-insensitive."""
        # Arrange - try different case of existing name
        npo_data = NPOCreateRequest(
            name=test_npo.name.upper(),  # Same name, different case
            email="different@email.org",
        )

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await NPOService.create_npo(db_session, npo_data, test_user.id)

        assert exc_info.value.status_code == 409


@pytest.mark.asyncio
class TestNPOServiceGet:
    """Test NPO retrieval logic."""

    async def test_get_npo_by_id_success(
        self,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test successful NPO retrieval by ID."""
        # Act
        npo = await NPOService.get_npo_by_id(db_session, test_npo.id)

        # Assert
        assert npo is not None
        assert npo.id == test_npo.id
        assert npo.name == test_npo.name

    async def test_get_npo_by_id_not_found(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Test getting non-existent NPO returns None."""
        # Arrange
        fake_id = uuid.uuid4()

        # Act
        npo = await NPOService.get_npo_by_id(db_session, fake_id)

        # Assert
        assert npo is None

    async def test_get_npo_excludes_soft_deleted(
        self,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test that soft-deleted NPOs are not returned."""
        # Arrange - soft delete the NPO
        test_npo.deleted_at = datetime.utcnow()
        await db_session.commit()

        # Act
        npo = await NPOService.get_npo_by_id(db_session, test_npo.id)

        # Assert
        assert npo is None


@pytest.mark.asyncio
class TestNPOServiceList:
    """Test NPO listing logic."""

    async def test_list_npos_superadmin_sees_all(
        self,
        db_session: AsyncSession,
        superadmin_user: User,
        test_npo: NPO,
        test_npo_2: NPO,
    ) -> None:
        """Test SuperAdmin can see all NPOs."""
        # Arrange
        list_params = NPOListRequest(page=1, page_size=20)

        # Act
        npos, total = await NPOService.list_npos(db_session, superadmin_user, list_params)

        # Assert
        assert total >= 2  # At least our test NPOs
        npo_ids = [npo.id for npo in npos]
        assert test_npo.id in npo_ids
        assert test_npo_2.id in npo_ids

    async def test_list_npos_regular_user_sees_only_their_npos(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_npo: NPO,
        test_npo_2: NPO,
    ) -> None:
        """Test regular users only see NPOs they're members of."""
        # Arrange - test_user is only member of test_npo
        list_params = NPOListRequest(page=1, page_size=20)

        # Act
        npos, total = await NPOService.list_npos(db_session, test_user, list_params)

        # Assert
        npo_ids = [npo.id for npo in npos]
        assert test_npo.id in npo_ids
        assert test_npo_2.id not in npo_ids  # Should not see this one

    async def test_list_npos_filter_by_status(
        self,
        db_session: AsyncSession,
        superadmin_user: User,
        test_npo: NPO,
    ) -> None:
        """Test filtering NPOs by status."""
        # Arrange
        test_npo.status = NPOStatus.APPROVED
        await db_session.commit()

        list_params = NPOListRequest(page=1, page_size=20, status=NPOStatus.APPROVED, search=None)

        # Act
        npos, total = await NPOService.list_npos(db_session, superadmin_user, list_params)

        # Assert
        assert all(npo.status == NPOStatus.APPROVED for npo in npos)
        assert test_npo.id in [npo.id for npo in npos]

    async def test_list_npos_search(
        self,
        db_session: AsyncSession,
        superadmin_user: User,
        test_npo: NPO,
    ) -> None:
        """Test searching NPOs by name/description."""
        # Arrange
        unique_name = f"Unique Search Test {uuid.uuid4()}"
        test_npo.name = unique_name
        await db_session.commit()

        list_params = NPOListRequest(page=1, page_size=20, search="Unique Search")

        # Act
        npos, total = await NPOService.list_npos(db_session, superadmin_user, list_params)

        # Assert
        assert total >= 1
        assert any(unique_name in npo.name for npo in npos)

    async def test_list_npos_pagination(
        self,
        db_session: AsyncSession,
        superadmin_user: User,
    ) -> None:
        """Test NPO listing pagination."""
        # Arrange
        list_params = NPOListRequest(page=1, page_size=1, search=None)

        # Act
        npos, total = await NPOService.list_npos(db_session, superadmin_user, list_params)

        # Assert
        assert len(npos) <= 1
        assert total >= 0

    async def test_list_npos_excludes_deleted(
        self,
        db_session: AsyncSession,
        superadmin_user: User,
        test_npo: NPO,
    ) -> None:
        """Test that soft-deleted NPOs are excluded from list."""
        # Arrange - soft delete the NPO
        npo_id = test_npo.id
        test_npo.deleted_at = datetime.utcnow()
        await db_session.commit()

        list_params = NPOListRequest(page=1, page_size=100, search=None)

        # Act
        npos, total = await NPOService.list_npos(db_session, superadmin_user, list_params)

        # Assert
        npo_ids = [npo.id for npo in npos]
        assert npo_id not in npo_ids


@pytest.mark.asyncio
class TestNPOServiceUpdate:
    """Test NPO update logic."""

    async def test_update_npo_success(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_npo: NPO,
    ) -> None:
        """Test successful NPO update."""
        # Arrange
        update_data = NPOUpdateRequest(
            name="Updated NPO Name",
            description="Updated description",
            phone="+1-555-9999",
        )

        # Act
        npo = await NPOService.update_npo(db_session, test_npo.id, update_data, test_user.id)

        # Assert
        assert npo.name == "Updated NPO Name"
        assert npo.description == "Updated description"
        assert npo.phone == "+1-555-9999"
        assert npo.email == test_npo.email  # Unchanged

    async def test_update_npo_not_found(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        """Test updating non-existent NPO fails."""
        # Arrange
        fake_id = uuid.uuid4()
        update_data = NPOUpdateRequest(name="New Name")

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await NPOService.update_npo(db_session, fake_id, update_data, test_user.id)

        assert exc_info.value.status_code == 404

    async def test_update_npo_pending_approval_fails(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_npo: NPO,
    ) -> None:
        """Test cannot update NPO in PENDING_APPROVAL status."""
        # Arrange
        test_npo.status = NPOStatus.PENDING_APPROVAL
        await db_session.commit()

        update_data = NPOUpdateRequest(name="New Name")

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await NPOService.update_npo(db_session, test_npo.id, update_data, test_user.id)

        assert exc_info.value.status_code == 409
        assert "PENDING_APPROVAL" in str(exc_info.value.detail)

    async def test_update_npo_duplicate_name_fails(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_npo: NPO,
        test_npo_2: NPO,
    ) -> None:
        """Test updating to duplicate name fails."""
        # Arrange - try to rename test_npo to test_npo_2's name
        update_data = NPOUpdateRequest(name=test_npo_2.name)

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await NPOService.update_npo(db_session, test_npo.id, update_data, test_user.id)

        assert exc_info.value.status_code == 409
        assert "already exists" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
class TestNPOServiceStatus:
    """Test NPO status management."""

    async def test_update_status_draft_to_pending(
        self,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test valid transition from DRAFT to PENDING_APPROVAL."""
        # Arrange
        test_npo.status = NPOStatus.DRAFT
        await db_session.commit()

        # Act
        npo = await NPOService.update_npo_status(
            db_session, test_npo.id, NPOStatus.PENDING_APPROVAL.value, "Submitting for approval"
        )

        # Assert
        assert npo.status == NPOStatus.PENDING_APPROVAL

    async def test_update_status_pending_to_approved(
        self,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test valid transition from PENDING_APPROVAL to APPROVED."""
        # Arrange
        test_npo.status = NPOStatus.PENDING_APPROVAL
        await db_session.commit()

        # Act
        npo = await NPOService.update_npo_status(
            db_session, test_npo.id, NPOStatus.APPROVED.value, "Approved by admin"
        )

        # Assert
        assert npo.status == NPOStatus.APPROVED

    async def test_update_status_invalid_transition_fails(
        self,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test invalid status transition fails."""
        # Arrange - try to go from DRAFT directly to APPROVED (invalid)
        test_npo.status = NPOStatus.DRAFT
        await db_session.commit()

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await NPOService.update_npo_status(db_session, test_npo.id, NPOStatus.APPROVED.value)

        assert exc_info.value.status_code == 409
        assert "Invalid status transition" in str(exc_info.value.detail)

    async def test_update_status_invalid_value_fails(
        self,
        db_session: AsyncSession,
        test_npo: NPO,
    ) -> None:
        """Test invalid status value fails."""
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await NPOService.update_npo_status(db_session, test_npo.id, "invalid_status")

        assert exc_info.value.status_code == 400


@pytest.mark.asyncio
class TestNPOServiceDelete:
    """Test NPO deletion logic."""

    async def test_delete_npo_draft_success(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_npo: NPO,
    ) -> None:
        """Test successful deletion of DRAFT NPO."""
        # Arrange
        test_npo.status = NPOStatus.DRAFT
        await db_session.commit()
        npo_id = test_npo.id

        # Act
        await NPOService.delete_npo(db_session, npo_id, test_user.id)

        # Assert - verify soft delete
        deleted_npo = await NPOService.get_npo_by_id(db_session, npo_id, include_deleted=True)
        assert deleted_npo is not None
        assert deleted_npo.deleted_at is not None

    async def test_delete_npo_rejected_success(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_npo: NPO,
    ) -> None:
        """Test successful deletion of REJECTED NPO."""
        # Arrange
        test_npo.status = NPOStatus.REJECTED
        await db_session.commit()

        # Act
        await NPOService.delete_npo(db_session, test_npo.id, test_user.id)

        # Assert
        deleted_npo = await NPOService.get_npo_by_id(db_session, test_npo.id, include_deleted=True)
        assert deleted_npo is not None
        assert deleted_npo.deleted_at is not None

    async def test_delete_npo_approved_fails(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_npo: NPO,
    ) -> None:
        """Test cannot delete APPROVED NPO."""
        # Arrange
        test_npo.status = NPOStatus.APPROVED
        await db_session.commit()

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await NPOService.delete_npo(db_session, test_npo.id, test_user.id)

        assert exc_info.value.status_code == 409
        assert "Cannot delete NPO" in str(exc_info.value.detail)

    async def test_delete_npo_not_found(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        """Test deleting non-existent NPO fails."""
        # Arrange
        fake_id = uuid.uuid4()

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await NPOService.delete_npo(db_session, fake_id, test_user.id)

        assert exc_info.value.status_code == 404
