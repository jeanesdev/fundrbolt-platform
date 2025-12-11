"""Public Event API endpoints for donor PWA."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.event import EventStatus
from app.schemas.event import EventDetailResponse, EventListResponse, EventSummaryResponse
from app.services.event_service import EventService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events/public", tags=["public-events"])


@router.get("", response_model=EventListResponse)
async def list_public_events(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 10,
    npo_id: uuid.UUID | None = None,
) -> EventListResponse:
    """
    List all active (published) events for public browsing.

    Only events with status=ACTIVE are returned.
    No authentication required.
    """
    events, total = await EventService.list_events(
        db=db,
        page=page,
        per_page=per_page,
        npo_id=npo_id,
        status_filter=EventStatus.ACTIVE,
    )

    total_pages = (total + per_page - 1) // per_page

    return EventListResponse(
        items=[
            EventSummaryResponse.model_validate(event, from_attributes=True) for event in events
        ],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/{slug}", response_model=EventDetailResponse)
async def get_public_event_by_slug(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventDetailResponse:
    """
    Get event details by slug for public viewing.

    Only active events can be viewed.
    No authentication required.
    """
    event = await EventService.get_event_by_slug(db, slug)

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with slug '{slug}' not found",
        )

    if event.status != EventStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with slug '{slug}' is not available for registration",
        )

    return EventDetailResponse.model_validate(event, from_attributes=True)
