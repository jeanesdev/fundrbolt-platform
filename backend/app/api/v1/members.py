"""
NPO Member Management API Endpoints

Provides REST API for managing NPO team members and invitations.
Access control enforced via role-based permissions.
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.request_id import get_request_id
from app.models.npo_member import MemberRole
from app.models.user import User
from app.schemas.member import (
    CreateInvitationRequest,
    InvitationWithTokenResponse,
    MemberResponse,
    PendingInvitationResponse,
    UpdateMemberRoleRequest,
)
from app.services.invitation_service import InvitationService
from app.services.member_service import MemberService
from app.services.npo_permission_service import NPOPermissionService

router = APIRouter(prefix="/npos/{npo_id}/members", tags=["NPO Members"])


@router.get("", response_model=dict)
async def list_members(
    npo_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
    role: Annotated[MemberRole | None, Query()] = None,
) -> dict[str, Any]:
    """
    List all members of an NPO.

    **Access Control:**
    - Requires authentication
    - Must be a member of the NPO to view members

    **Query Parameters:**
    - role: Optional filter by member role (admin, co_admin, staff)

    **Returns:**
        List of active NPO members with user details

    **Raises:**
        401: User not authenticated
        403: User not authorized to view members
        404: NPO not found
    """
    # Check permission - user must be a member
    perm_service = NPOPermissionService()
    if not await perm_service.is_npo_member(db, current_user, npo_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view members",
        )

    # Get members
    members = await MemberService.get_members(db, npo_id, role)

    # Convert to response models
    return {
        "members": [
            MemberResponse(
                id=member.id,
                npo_id=member.npo_id,
                user_id=member.user_id,
                role=member.role,
                status=member.status,
                joined_at=member.joined_at,
                created_at=member.created_at,
                user_email=member.user.email,
                user_first_name=member.user.first_name,
                user_last_name=member.user.last_name,
                user_full_name=f"{member.user.first_name} {member.user.last_name}".strip()
                if member.user.first_name or member.user.last_name
                else None,
            )
            for member in members
        ]
    }


@router.get("/invitations", response_model=dict)
async def list_pending_invitations(
    npo_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
) -> dict[str, Any]:
    """
    List all pending invitations for an NPO.

    **Access Control:**
    - Requires authentication
    - Must be a member of the NPO to view invitations

    **Returns:**
        List of pending invitations (not expired)

    **Raises:**
        401: User not authenticated
        403: User not authorized to view invitations
        404: NPO not found
    """
    # Check permission - user must be a member
    perm_service = NPOPermissionService()
    if not await perm_service.is_npo_member(db, current_user, npo_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view invitations",
        )

    # Get pending invitations
    invitations = await InvitationService.get_pending_invitations(db, npo_id)

    # Convert to response models
    return {
        "invitations": [
            PendingInvitationResponse(
                id=inv.id,
                email=inv.email,
                role=MemberRole(inv.role),
                expires_at=inv.expires_at,
                created_at=inv.created_at,
            )
            for inv in invitations
        ]
    }


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    npo_id: uuid.UUID,
    invitation_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
) -> None:
    """
    Revoke a pending invitation.

    **Access Control:**
    - Requires authentication
    - Must be admin or co-admin of the NPO

    **Business Rules:**
    - Only pending invitations can be revoked
    - Invitation token is invalidated
    - Action is logged in audit trail

    **Returns:**
        204 No Content on success

    **Raises:**
        401: User not authenticated
        403: User not authorized to revoke invitations
        404: Invitation not found
        409: Invitation already accepted or revoked
    """
    # Check permission (ADMIN or CO_ADMIN)
    perm_service = NPOPermissionService()
    if not await perm_service.can_manage_members(db, current_user, npo_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and co-admins can revoke invitations",
        )

    # Revoke invitation
    await InvitationService.revoke_invitation(
        db=db,
        invitation_id=invitation_id,
        revoked_by_user_id=current_user.id,
    )


@router.post("/invitations/{invitation_id}/resend", status_code=status.HTTP_200_OK)
async def resend_invitation(
    npo_id: uuid.UUID,
    invitation_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
) -> dict[str, Any]:
    """
    Resend a pending invitation with a new token and extended expiry.

    **Access Control:**
    - Requires authentication
    - Must be admin or co-admin of the NPO

    **Business Rules:**
    - Only pending invitations can be resent
    - New token generated and old one invalidated
    - Expiry extended by 7 days from now
    - New invitation email sent

    **Returns:**
        Success message with new expiry date

    **Raises:**
        401: User not authenticated
        403: User not authorized to resend invitations
        404: Invitation not found
        400: Invitation status not pending
    """
    # Check permission (ADMIN or CO_ADMIN)
    perm_service = NPOPermissionService()
    if not await perm_service.can_manage_members(db, current_user, npo_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and co-admins can resend invitations",
        )

    # Resend invitation
    invitation = await InvitationService.resend_invitation(
        db=db,
        invitation_id=invitation_id,
        npo_id=npo_id,
        resent_by_user_id=current_user.id,
    )

    return {
        "message": "Invitation resent successfully",
        "email": invitation.email,
        "expires_at": invitation.expires_at.isoformat(),
    }


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=dict,
)
async def create_invitation(
    npo_id: uuid.UUID,
    invitation_data: CreateInvitationRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
) -> dict[str, Any]:
    """
    Create an invitation for a new team member.

    **Access Control:**
    - ADMIN can invite any role (admin, co_admin, staff)
    - CO_ADMIN can only invite staff
    - STAFF cannot invite

    **Business Rules:**
    - Email must not already be a member
    - Only one pending invitation per email
    - Invitation expires in 7 days
    - Email notification sent to invitee

    **Returns:**
        Created invitation with JWT token (wrapped in "invitation" key)

    **Raises:**
        401: User not authenticated
        403: User not authorized to invite (must be admin or co_admin)
        409: Email already member or has pending invitation
        422: Invalid email or role
    """
    # Check permission (ADMIN or CO_ADMIN)
    perm_service = NPOPermissionService()
    if not await perm_service.can_manage_members(db, current_user, npo_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and co-admins can invite members",
        )

    # Get user's role to check additional constraints
    role, status_val = await perm_service.get_user_npo_role(db, current_user.id, npo_id)

    # CO_ADMIN can only invite STAFF
    if role == MemberRole.CO_ADMIN and invitation_data.role != MemberRole.STAFF:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Co-admins can only invite staff members",
        )

    # STAFF cannot invite anyone (already blocked by can_manage_members, but double-check)
    if role == MemberRole.STAFF:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff members cannot invite others",
        )

    # Create invitation
    invitation = await InvitationService.create_invitation(
        db=db,
        npo_id=npo_id,
        email=invitation_data.email,
        role=invitation_data.role.value,
        invited_by_user_id=current_user.id,
        first_name=invitation_data.first_name,
        last_name=invitation_data.last_name,
    )

    # TODO: Send invitation email with token
    token = getattr(invitation, "token", str(invitation.id))  # Get generated token or fallback

    return {
        "invitation": InvitationWithTokenResponse(
            id=invitation.id,
            npo_id=invitation.npo_id,
            email=invitation.email,
            role=MemberRole(invitation.role),
            invited_by_user_id=invitation.invited_by_user_id,
            status=invitation.status.value,
            expires_at=invitation.expires_at,
            accepted_at=invitation.accepted_at,
            created_at=invitation.created_at,
            token=token,
        )
    }


@router.patch("/{member_id}", response_model=dict)
async def update_member_role(
    npo_id: uuid.UUID,
    member_id: uuid.UUID,
    role_data: UpdateMemberRoleRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
) -> dict[str, Any]:
    """
    Update a member's role.

    **Access Control:**
    - Only ADMIN can update roles
    - Cannot demote the primary admin (NPO creator)

    **Business Rules:**
    - Primary admin role cannot be changed
    - Role changes are logged in audit trail

    **Returns:**
        Updated member with new role (wrapped in "member" key)

    **Raises:**
        401: User not authenticated
        403: User not authorized (must be admin) or trying to demote primary admin
        404: Member not found
        422: Invalid role
    """
    # Check permission (ADMIN only)
    perm_service = NPOPermissionService()
    role, status_val = await perm_service.get_user_npo_role(db, current_user.id, npo_id)

    if role != MemberRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update member roles",
        )

    # Update member
    updated_member = await MemberService.update_member(
        db=db,
        npo_id=npo_id,
        member_id=member_id,
        new_role=role_data.role,
        updated_by_user_id=current_user.id,
    )

    return {
        "member": MemberResponse(
            id=updated_member.id,
            npo_id=updated_member.npo_id,
            user_id=updated_member.user_id,
            role=updated_member.role,
            status=updated_member.status,
            joined_at=updated_member.joined_at,
            created_at=updated_member.created_at,
            user_email=updated_member.user.email,
            user_first_name=updated_member.user.first_name,
            user_last_name=updated_member.user.last_name,
            user_full_name=f"{updated_member.user.first_name} {updated_member.user.last_name}".strip()
            if updated_member.user.first_name or updated_member.user.last_name
            else None,
        )
    }


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    npo_id: uuid.UUID,
    member_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
) -> None:
    """
    Remove a member from the NPO.

    **Access Control:**
    - Only ADMIN can remove members
    - Cannot remove the primary admin (NPO creator)

    **Business Rules:**
    - Member status changed to REMOVED (soft delete)
    - Removal is logged in audit trail
    - Primary admin cannot be removed

    **Returns:**
        204 No Content on success

    **Raises:**
        401: User not authenticated
        403: User not authorized (must be admin) or trying to remove primary admin
        404: Member not found
    """
    # Check permission (ADMIN only)
    perm_service = NPOPermissionService()
    role, status_val = await perm_service.get_user_npo_role(db, current_user.id, npo_id)

    if role != MemberRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can remove members",
        )

    # Remove member
    await MemberService.remove_member(
        db=db,
        npo_id=npo_id,
        member_id=member_id,
        removed_by_user_id=current_user.id,
    )
