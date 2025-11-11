"""Event Links API endpoints."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.event import EventLink
from app.models.user import User
from app.schemas.event import EventLinkCreateRequest, EventLinkResponse, EventLinkUpdateRequest
from app.services.event_service import EventService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events/{event_id}/links", tags=["events", "links"])


@router.post("", response_model=EventLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_event_link(
    event_id: uuid.UUID,
    request: EventLinkCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventLinkResponse:
    """
    Add a new link to an event.

    Supports video links (YouTube, Vimeo), website links, and social media links.
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Create new link
    link = EventLink(
        event_id=event_id,
        link_type=request.link_type,
        url=request.url,
        label=request.label,
        platform=request.platform,
        display_order=request.display_order or 0,
    )

    db.add(link)
    await db.commit()
    await db.refresh(link)

    logger.info(f"Created link {link.id} for event {event_id} by user {current_user.id}")

    return EventLinkResponse(
        id=link.id,
        event_id=link.event_id,
        link_type=link.link_type,
        url=link.url,
        label=link.label,
        platform=link.platform,
        display_order=link.display_order,
        created_at=link.created_at,
    )


@router.patch("/{link_id}", response_model=EventLinkResponse, status_code=status.HTTP_200_OK)
async def update_event_link(
    event_id: uuid.UUID,
    link_id: uuid.UUID,
    request: EventLinkUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventLinkResponse:
    """
    Update an existing event link.

    Can update label or display order.
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Find the link
    query = select(EventLink).where(EventLink.id == link_id, EventLink.event_id == event_id)
    result = await db.execute(query)
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Link with ID {link_id} not found for event {event_id}",
        )

    # Update fields
    if request.label is not None:
        link.label = request.label
    if request.display_order is not None:
        link.display_order = request.display_order

    await db.commit()
    await db.refresh(link)

    logger.info(f"Updated link {link_id} for event {event_id} by user {current_user.id}")

    return EventLinkResponse(
        id=link.id,
        event_id=link.event_id,
        link_type=link.link_type,
        url=link.url,
        label=link.label,
        platform=link.platform,
        display_order=link.display_order,
        created_at=link.created_at,
    )


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event_link(
    event_id: uuid.UUID,
    link_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> None:
    """
    Delete an event link.

    Removes the link from the event.
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Find the link
    query = select(EventLink).where(EventLink.id == link_id, EventLink.event_id == event_id)
    result = await db.execute(query)
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Link with ID {link_id} not found for event {event_id}",
        )

    # Delete the link
    await db.delete(link)
    await db.commit()

    logger.info(f"Deleted link {link_id} from event {event_id} by user {current_user.id}")
