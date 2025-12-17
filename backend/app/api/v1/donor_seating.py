"""Donor PWA seating information endpoints."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.user import User
from app.schemas.seating import SeatingInfoResponse
from app.services.seating_service import SeatingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/donor/events", tags=["donor-seating"])


@router.get("/{event_id}/my-seating", response_model=SeatingInfoResponse)
async def get_my_seating_info(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> SeatingInfoResponse:
    """
    Get current user's seating information for an event.

    Returns:
    - User's table assignment and bidder number (if checked in)
    - List of tablemates (with bidder numbers only if they're checked in)
    - Table capacity information
    - Message if table not assigned or not checked in

    Gating Rules:
    - Bidder numbers are only visible after check-in (check_in_time is set)
    - This applies to both user's own bidder number and tablemates'

    Raises:
    - 404: User has no registration for this event
    """
    try:
        seating_info = await SeatingService.get_donor_seating_info(db, current_user.id, event_id)
        return SeatingInfoResponse(**seating_info)
    except ValueError as e:
        logger.warning(
            f"Failed to get seating info for user {current_user.id} at event {event_id}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
