"""
NPO Invitation Acceptance API Endpoints

Provides REST API for accepting team invitations.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.request_id import get_request_id
from app.models.user import User
from app.schemas.member import MemberResponse
from app.services.invitation_service import InvitationService

router = APIRouter(prefix="/invitations", tags=["Invitations"])


@router.post(
    "/{token}/accept",
    status_code=status.HTTP_200_OK,
    response_model=dict,
)
async def accept_invitation(
    token: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
) -> dict[str, Any]:
    """
    Accept an invitation and become an NPO member.

    **Access Control:**
    - Requires authentication
    - User must not already be a member

    **Business Rules:**
    - Invitation must be valid and not expired
    - Invitation must not have been accepted or revoked
    - User becomes active member with invited role
    - Invitation token is invalidated after acceptance

    **Returns:**
        Created NPO member record with success message (wrapped in "member" and "message" keys)

    **Raises:**
        401: User not authenticated
        404: Invitation not found
        409: Invitation already accepted or user already member
        410: Invitation expired or revoked
    """
    # Accept invitation using JWT token validation
    member = await InvitationService.accept_invitation_by_token(
        db=db,
        token=token,
        user_id=current_user.id,
    )

    return {
        "member": MemberResponse(
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
        ),
        "message": "Successfully joined the NPO team",
    }
