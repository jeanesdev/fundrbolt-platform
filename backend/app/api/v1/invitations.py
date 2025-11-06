"""
NPO Invitation Acceptance API Endpoints

Provides REST API for accepting team invitations.
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.request_id import get_request_id
from app.models.invitation import Invitation
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
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
) -> dict[str, Any]:
    """
    Accept an invitation and become an NPO member.

    **Access Control:**
    - No authentication required (token-based)
    - User is looked up by invitation email

    **Business Rules:**
    - Invitation must be valid and not expired
    - Invitation must not have been accepted or revoked
    - User with invitation email must exist
    - User becomes active member with invited role
    - Invitation is marked as accepted

    **Returns:**
        Created NPO member record with success message (wrapped in "member" and "message" keys)

    **Raises:**
        404: Invitation not found, invalid token, or no user with invitation email
        409: Invitation already accepted or user already member
        410: Invitation expired or revoked
    """
    # Parse token as UUID (invitation ID)
    try:
        invitation_id = uuid.UUID(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invitation token",
        )

    # Get the invitation to find the email
    stmt = select(Invitation).where(Invitation.id == invitation_id)
    result = await db.execute(stmt)
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    # Find user by invitation email
    user_stmt = select(User).where(User.email == invitation.email)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user found with the invitation email. Please create an account first.",
        )

    # Accept invitation
    member = await InvitationService.accept_invitation(
        db=db,
        invitation_id=invitation_id,
        user_id=user.id,
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
