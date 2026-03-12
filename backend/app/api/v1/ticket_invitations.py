"""Invitation token validation and guest registration endpoints.

T007 — Public token validation (no auth) and authenticated registration.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.user import User
from app.schemas.ticket_purchasing import (
    InvitationRegisterRequest,
    InvitationRegisterResponse,
    InvitationValidateResponse,
)
from app.services.ticket_invitation_service import TicketInvitationService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ticket-invitations"])


@router.get(
    "/invitations/{token}/validate",
    response_model=InvitationValidateResponse,
)
async def validate_invitation_token(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InvitationValidateResponse:
    """Validate an invitation token (public, no auth required).

    Returns event details and guest information if the token is valid,
    or indicates that it is expired / already used.
    """
    return await TicketInvitationService.validate_token(db=db, token=token)


@router.post(
    "/invitations/{token}/register",
    response_model=InvitationRegisterResponse,
)
async def register_via_invitation(
    token: str,
    body: InvitationRegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> InvitationRegisterResponse:
    """Complete event registration using an invitation token.

    The authenticated user's email must match the invitation's guest email.
    """
    response = await TicketInvitationService.register_via_invitation(
        db=db,
        token=token,
        user_id=current_user.id,
        request=body,
    )
    await db.commit()
    return response
