"""Admin API endpoints for Revenue Nudge panel."""

import uuid
from typing import Annotated
from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.event_nudge_dismissal import EventNudgeDismissal
from app.models.user import User
from app.schemas.nudge import DismissNudgeRequest, DismissNudgeResponse, NudgesResponse
from app.services.nudge_service import NudgeService

router = APIRouter(tags=["admin-event-nudges"])


async def _require_nudge_access(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Allow NPO Admin, Event Coordinator, Staff, or Auctioneer for this event."""
    from sqlalchemy import select

    from app.models.auctioneer import AuctioneerEventSettings
    from app.models.event import Event
    from app.services.permission_service import PermissionService

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    role = getattr(current_user, "role_name", None)
    if role == "super_admin":
        return current_user
    if role in {"npo_admin", "event_coordinator", "staff"}:
        perm = PermissionService()
        if await perm.can_view_event(current_user, event.npo_id, db=db):
            return current_user
    if role == "auctioneer":
        auc_result = await db.execute(
            select(AuctioneerEventSettings).where(
                AuctioneerEventSettings.auctioneer_user_id == current_user.id,
                AuctioneerEventSettings.event_id == event_id,
            )
        )
        if auc_result.scalar_one_or_none():
            return current_user
    raise HTTPException(status_code=403, detail="Access denied")


@router.get(
    "/admin/events/{event_id}/nudges",
    response_model=NudgesResponse,
    summary="List revenue nudges for an event",
)
async def list_nudges(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    include_dismissed: bool = Query(default=False),
) -> NudgesResponse:
    await _require_nudge_access(event_id, current_user, db)
    service = NudgeService(db)
    return await service.get_nudges(event_id, current_user.id, include_dismissed=include_dismissed)


@router.post(
    "/admin/events/{event_id}/nudges/{nudge_key:path}/dismiss",
    response_model=DismissNudgeResponse,
    summary="Dismiss or action a nudge",
)
async def dismiss_nudge(
    event_id: uuid.UUID,
    nudge_key: str,
    request: DismissNudgeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DismissNudgeResponse:
    nudge_key = unquote(nudge_key)[:200]
    if nudge_key == "goal_progress":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Goal progress nudge is not dismissible",
        )
    await _require_nudge_access(event_id, current_user, db)
    service = NudgeService(db)
    return await service.dismiss_nudge(event_id, current_user.id, nudge_key, request.action)


@router.delete(
    "/admin/events/{event_id}/nudges/dismissals",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear all nudge dismissals for the current user",
)
async def clear_dismissals(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await _require_nudge_access(event_id, current_user, db)
    await db.execute(
        delete(EventNudgeDismissal).where(
            EventNudgeDismissal.event_id == event_id,
            EventNudgeDismissal.user_id == current_user.id,
        )
    )
    await db.commit()
