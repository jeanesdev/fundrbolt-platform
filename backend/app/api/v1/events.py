"""Event API endpoints."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.user import User
from app.schemas.event import (
    EventCreateRequest,
    EventDetailResponse,
    EventListResponse,
    EventSummaryResponse,
    EventUpdateRequest,
)
from app.services.event_service import EventService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=EventDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_data: EventCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventDetailResponse:
    """
    Create a new event in DRAFT status.

    Requirements:
    - NPO must be APPROVED
    - Event datetime must be in the future
    - Authenticated user with NPO Admin or Staff role
    """
    event = await EventService.create_event(db, event_data, current_user)
    return EventDetailResponse.model_validate(event)


@router.get("/{event_id}", response_model=EventDetailResponse)
async def get_event(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventDetailResponse:
    """Get event details by ID."""
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )
    return EventDetailResponse.model_validate(event)


@router.patch("/{event_id}", response_model=EventDetailResponse)
async def update_event(
    event_id: uuid.UUID,
    event_data: EventUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventDetailResponse:
    """
    Update event details.

    Includes optimistic locking: send version in request body.
    Returns 409 Conflict if event was modified by another user.
    """
    event = await EventService.update_event(db, event_id, event_data, current_user)
    return EventDetailResponse.model_validate(event)


@router.post("/{event_id}/publish", response_model=EventDetailResponse)
async def publish_event(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventDetailResponse:
    """Change event status from DRAFT to ACTIVE."""
    event = await EventService.publish_event(db, event_id, current_user)
    return EventDetailResponse.model_validate(event)


@router.post("/{event_id}/close", response_model=EventDetailResponse)
async def close_event(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventDetailResponse:
    """Manually close an active event."""
    event = await EventService.close_event(db, event_id, current_user)
    return EventDetailResponse.model_validate(event)


@router.get("", response_model=EventListResponse)
async def list_events(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    npo_id: Annotated[uuid.UUID | None, Query()] = None,
    status_param: Annotated[str | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 20,
) -> EventListResponse:
    """
    List events with filtering and pagination.

    Filters:
    - npo_id: Show events for specific NPO
    - status: draft, active, or closed
    """
    from app.models.event import EventStatus

    status_filter = None
    if status_param:
        try:
            status_filter = EventStatus(status_param)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_param}. Must be draft, active, or closed.",
            )

    events, total = await EventService.list_events(
        db,
        npo_id=npo_id,
        status_filter=status_filter,
        page=page,
        per_page=per_page,
    )

    return EventListResponse(
        items=[EventSummaryResponse.model_validate(e) for e in events],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=(total + per_page - 1) // per_page,
    )


@router.get("/public/{slug}", response_model=EventDetailResponse)
async def get_public_event(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventDetailResponse:
    """
    Public endpoint: Get active event by URL slug.

    No authentication required.
    Only returns events with status=ACTIVE.
    """
    event = await EventService.get_event_by_slug(db, slug)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with slug '{slug}' not found or not active",
        )
    return EventDetailResponse.model_validate(event)
