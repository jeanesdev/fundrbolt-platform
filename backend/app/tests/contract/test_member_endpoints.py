"""
Contract tests for NPO member management endpoints.

Tests the API contract for team member management including:
- GET /api/v1/npos/{id}/members - List members
- POST /api/v1/npos/{id}/members - Create invitation
- PATCH /api/v1/npos/{id}/members/{memberId} - Update member role
- DELETE /api/v1/npos/{id}/members/{memberId} - Remove member

These tests ensure the API follows the contract defined in
contracts/npo-management-api.yaml
"""

import uuid

import pytest
from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.npo import NPO
from app.models.npo_member import NPOMember
from app.models.user import User


@pytest.mark.asyncio
class TestListMembersEndpoint:
    """Test GET /api/v1/npos/{id}/members"""

    async def test_list_members_success(
        self,
        authenticated_client,
        test_npo: NPO,
        test_user: User,
        db_session: AsyncSession,
    ):
        """Admin can list all members of their NPO"""
        response = await authenticated_client.get(f"/api/v1/npos/{test_npo.id}/members")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "members" in data
        assert isinstance(data["members"], list)
        assert len(data["members"]) >= 1  # At least the creator

        # Check member structure
        member = data["members"][0]
        assert "id" in member
        assert "user_id" in member
        assert "role" in member
        assert "email" in member
        assert "joined_at" in member

    async def test_list_members_with_filtering(
        self,
        authenticated_client,
        test_npo: NPO,
        db_session: AsyncSession,
    ):
        """Can filter members by role"""
        response = await authenticated_client.get(f"/api/v1/npos/{test_npo.id}/members?role=admin")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        for member in data["members"]:
            assert member["role"] == "admin"

    async def test_list_members_unauthorized(
        self,
        client,
        test_npo: NPO,
    ):
        """Unauthenticated user cannot list members"""
        response = await client.get(f"/api/v1/npos/{test_npo.id}/members")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_list_members_forbidden(
        self,
        authenticated_client_other_user,
        test_npo: NPO,
    ):
        """User from different NPO cannot list members"""
        response = await authenticated_client_other_user.get(f"/api/v1/npos/{test_npo.id}/members")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    async def test_list_members_not_found(
        self,
        authenticated_client,
    ):
        """Returns 403 for non-existent NPO (permission check fails first)"""
        fake_id = uuid.uuid4()
        response = await authenticated_client.get(f"/api/v1/npos/{fake_id}/members")
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
class TestCreateInvitationEndpoint:
    """Test POST /api/v1/npos/{id}/members (creates invitation)"""

    async def test_create_invitation_success(
        self,
        authenticated_client,
        test_npo: NPO,
    ):
        """Admin can invite new member with valid role"""
        invitation_data = {
            "email": "newmember@example.com",
            "role": "staff",
            "message": "Welcome to our team!",
        }

        response = await authenticated_client.post(
            f"/api/v1/npos/{test_npo.id}/members",
            json=invitation_data,
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "invitation" in data
        assert data["invitation"]["email"] == invitation_data["email"]
        assert data["invitation"]["role"] == invitation_data["role"]
        assert "token" in data["invitation"]
        assert "expires_at" in data["invitation"]

    async def test_create_invitation_invalid_email(
        self,
        authenticated_client,
        test_npo: NPO,
    ):
        """Rejects invitation with invalid email"""
        invitation_data = {
            "email": "invalid-email",
            "role": "staff",
        }

        response = await authenticated_client.post(
            f"/api/v1/npos/{test_npo.id}/members",
            json=invitation_data,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_create_invitation_invalid_role(
        self,
        authenticated_client,
        test_npo: NPO,
    ):
        """Rejects invitation with invalid role"""
        invitation_data = {
            "email": "member@example.com",
            "role": "superuser",  # Invalid role
        }

        response = await authenticated_client.post(
            f"/api/v1/npos/{test_npo.id}/members",
            json=invitation_data,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_create_invitation_duplicate_email(
        self,
        authenticated_client,
        test_npo: NPO,
        test_user: User,
    ):
        """Rejects invitation for user already a member"""
        invitation_data = {
            "email": test_user.email,
            "role": "staff",
        }

        response = await authenticated_client.post(
            f"/api/v1/npos/{test_npo.id}/members",
            json=invitation_data,
        )

        assert response.status_code == status.HTTP_409_CONFLICT
        detail = response.json()["detail"]
        detail_str = detail if isinstance(detail, str) else str(detail)
        assert "already a member" in detail_str.lower()

    async def test_create_invitation_unauthorized(
        self,
        client,
        test_npo: NPO,
    ):
        """Unauthenticated user cannot create invitation"""
        invitation_data = {
            "email": "member@example.com",
            "role": "staff",
        }

        response = await client.post(
            f"/api/v1/npos/{test_npo.id}/members",
            json=invitation_data,
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_create_invitation_staff_forbidden(
        self,
        authenticated_staff_client,
        test_npo: NPO,
    ):
        """Staff member cannot invite others"""
        invitation_data = {
            "email": "member@example.com",
            "role": "staff",
        }

        response = await authenticated_staff_client.post(
            f"/api/v1/npos/{test_npo.id}/members",
            json=invitation_data,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
class TestUpdateMemberEndpoint:
    """Test PATCH /api/v1/npos/{id}/members/{memberId}"""

    async def test_update_member_role_success(
        self,
        authenticated_client,
        test_npo: NPO,
        test_staff_member: NPOMember,
    ):
        """Admin can update member role"""
        update_data = {
            "role": "co_admin",
        }

        response = await authenticated_client.patch(
            f"/api/v1/npos/{test_npo.id}/members/{test_staff_member.id}",
            json=update_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["member"]["role"] == "co_admin"

    async def test_update_member_invalid_role(
        self,
        authenticated_client,
        test_npo: NPO,
        test_staff_member: NPOMember,
    ):
        """Rejects invalid role"""
        update_data = {
            "role": "invalid_role",
        }

        response = await authenticated_client.patch(
            f"/api/v1/npos/{test_npo.id}/members/{test_staff_member.id}",
            json=update_data,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_update_member_cannot_demote_admin(
        self,
        authenticated_client,
        test_npo: NPO,
        test_user: User,
        db_session: AsyncSession,
    ):
        """Cannot change role of primary admin"""
        # Get the admin member using select
        stmt = select(NPOMember).where(
            NPOMember.npo_id == test_npo.id, NPOMember.user_id == test_user.id
        )
        result = await db_session.execute(stmt)
        admin_member = result.scalar_one()

        update_data = {
            "role": "staff",
        }

        response = await authenticated_client.patch(
            f"/api/v1/npos/{test_npo.id}/members/{admin_member.id}",
            json=update_data,
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        detail = response.json()["detail"]
        detail_str = detail if isinstance(detail, str) else str(detail)
        assert "primary admin" in detail_str.lower() and (
            "cannot" in detail_str.lower() or "demote" in detail_str.lower()
        )

    async def test_update_member_unauthorized(
        self,
        client,
        test_npo: NPO,
        test_staff_member: NPOMember,
    ):
        """Unauthenticated user cannot update member"""
        update_data = {"role": "co_admin"}

        response = await client.patch(
            f"/api/v1/npos/{test_npo.id}/members/{test_staff_member.id}",
            json=update_data,
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_update_member_staff_forbidden(
        self,
        authenticated_staff_client,
        test_npo: NPO,
        test_staff_member: NPOMember,
    ):
        """Staff member cannot update roles"""
        update_data = {"role": "admin"}

        response = await authenticated_staff_client.patch(
            f"/api/v1/npos/{test_npo.id}/members/{test_staff_member.id}",
            json=update_data,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
class TestRemoveMemberEndpoint:
    """Test DELETE /api/v1/npos/{id}/members/{memberId}"""

    async def test_remove_member_success(
        self,
        authenticated_client,
        test_npo: NPO,
        test_staff_member: NPOMember,
    ):
        """Admin can remove member"""
        response = await authenticated_client.delete(
            f"/api/v1/npos/{test_npo.id}/members/{test_staff_member.id}"
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify member is removed
        get_response = await authenticated_client.get(f"/api/v1/npos/{test_npo.id}/members")
        members = get_response.json()["members"]
        member_ids = [m["id"] for m in members]
        assert str(test_staff_member.id) not in member_ids

    async def test_remove_member_cannot_remove_admin(
        self,
        authenticated_client,
        test_npo: NPO,
        test_user: User,
        db_session: AsyncSession,
    ):
        """Cannot remove primary admin"""
        # Get the admin member
        stmt = select(NPOMember).where(
            NPOMember.npo_id == test_npo.id, NPOMember.user_id == test_user.id
        )
        result = await db_session.execute(stmt)
        admin_member = result.scalar_one()

        response = await authenticated_client.delete(
            f"/api/v1/npos/{test_npo.id}/members/{admin_member.id}"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        detail = response.json()["detail"]
        detail_str = detail if isinstance(detail, str) else str(detail)
        assert "primary admin" in detail_str.lower() and (
            "cannot" in detail_str.lower() or "remove" in detail_str.lower()
        )

    async def test_remove_member_unauthorized(
        self,
        client,
        test_npo: NPO,
        test_staff_member: NPOMember,
    ):
        """Unauthenticated user cannot remove member"""
        response = await client.delete(f"/api/v1/npos/{test_npo.id}/members/{test_staff_member.id}")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_remove_member_staff_forbidden(
        self,
        authenticated_staff_client,
        test_npo: NPO,
        test_staff_member: NPOMember,
    ):
        """Staff member cannot remove others"""
        response = await authenticated_staff_client.delete(
            f"/api/v1/npos/{test_npo.id}/members/{test_staff_member.id}"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    async def test_remove_member_not_found(
        self,
        authenticated_client,
        test_npo: NPO,
    ):
        """Returns 404 for non-existent member"""
        fake_id = uuid.uuid4()
        response = await authenticated_client.delete(
            f"/api/v1/npos/{test_npo.id}/members/{fake_id}"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
