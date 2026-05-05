"""Donor PWA run-of-show endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.user import User
from app.schemas.run_of_show import RunOfShowResponse
from app.services.run_of_show_service import RunOfShowService

router = APIRouter(prefix="/donor/events", tags=["donor-run-of-show"])


@router.get(
    "/{event_id}/run-of-show",
    response_model=RunOfShowResponse,
    summary="Get donor-visible run-of-show for an event",
)
async def get_donor_run_of_show(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> RunOfShowResponse:
    """Get run-of-show items visible to donors for an event."""
    return await RunOfShowService.get_event_ros(db, event_id, visibility_filter="donor")
