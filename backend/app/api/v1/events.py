"""Event API endpoints."""

import logging
import uuid
from typing import Annotated, Any
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.user import User
from app.schemas.event import (
    DuplicateEventRequest,
    EventCreateRequest,
    EventDetailResponse,
    EventListResponse,
    EventStatsResponse,
    EventSummaryResponse,
    EventUpdateRequest,
)
from app.services.event_service import EventService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])


def _add_sas_urls_to_media(response_dict: dict[str, Any]) -> None:
    """Replace media file URLs with read SAS URLs in-place."""
    from app.services.media_service import MediaService

    # Refresh SAS URLs for event media
    if response_dict.get("media"):
        for media_item in response_dict["media"]:
            file_url = media_item.get("file_url", "")
            if not file_url:
                continue

            parsed_url = urlparse(file_url)
            path = parsed_url.path.lstrip("/")
            if not path:
                continue

            path_parts = path.split("/", 1)
            if len(path_parts) < 2:
                continue

            blob_name = unquote(path_parts[1])
            media_item["file_url"] = MediaService.generate_read_sas_url(blob_name)

    # Refresh SAS URL for seating layout image
    layout_url = response_dict.get("seating_layout_image_url")
    if layout_url and "blob.core.windows.net" in layout_url:
        parsed_url = urlparse(layout_url)
        path = parsed_url.path.lstrip("/")
        if path:
            path_parts = path.split("/", 1)
            if len(path_parts) >= 2:
                blob_name = unquote(path_parts[1])
                response_dict["seating_layout_image_url"] = MediaService.generate_read_sas_url(
                    blob_name
                )


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

    # Reload event with NPO relationship
    event_with_npo = await EventService.get_event_by_id(db, event.id)
    if not event_with_npo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event.id} not found",
        )

    response_dict = EventDetailResponse.model_validate(
        event_with_npo, from_attributes=True
    ).model_dump()
    response_dict["npo_name"] = event_with_npo.npo.name if event_with_npo.npo else None
    _add_sas_urls_to_media(response_dict)
    return EventDetailResponse(**response_dict)


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

    # Convert to dict using Pydantic, then add npo_name and SAS URLs for media
    response_dict = EventDetailResponse.model_validate(event, from_attributes=True).model_dump()
    response_dict["npo_name"] = event.npo.name if event.npo else None

    _add_sas_urls_to_media(response_dict)

    return EventDetailResponse(**response_dict)


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

    # Reload event with NPO relationship
    reloaded_event = await EventService.get_event_by_id(db, event_id)
    if not reloaded_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )
    event = reloaded_event

    response_dict = EventDetailResponse.model_validate(event, from_attributes=True).model_dump()
    response_dict["npo_name"] = event.npo.name if event.npo else None
    _add_sas_urls_to_media(response_dict)
    return EventDetailResponse(**response_dict)


@router.post("/{event_id}/publish", response_model=EventDetailResponse)
async def publish_event(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventDetailResponse:
    """Change event status from DRAFT to ACTIVE."""
    event = await EventService.publish_event(db, event_id, current_user)

    # Reload event with NPO relationship
    reloaded_event = await EventService.get_event_by_id(db, event_id)
    if not reloaded_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )
    event = reloaded_event

    response_dict = EventDetailResponse.model_validate(event, from_attributes=True).model_dump()
    response_dict["npo_name"] = event.npo.name if event.npo else None
    _add_sas_urls_to_media(response_dict)
    return EventDetailResponse(**response_dict)


@router.post("/{event_id}/close", response_model=EventDetailResponse)
async def close_event(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventDetailResponse:
    """Manually close an active event."""
    event = await EventService.close_event(db, event_id, current_user)

    # Reload event with NPO relationship
    reloaded_event = await EventService.get_event_by_id(db, event_id)
    if not reloaded_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )
    event = reloaded_event

    response_dict = EventDetailResponse.model_validate(event, from_attributes=True).model_dump()
    response_dict["npo_name"] = event.npo.name if event.npo else None
    _add_sas_urls_to_media(response_dict)
    return EventDetailResponse(**response_dict)


@router.post(
    "/{event_id}/duplicate",
    response_model=EventDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def duplicate_event(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    options: DuplicateEventRequest | None = None,
) -> EventDetailResponse:
    """
    Duplicate an existing event into a new DRAFT event.

    Clones event details, food options, ticket packages (with custom options),
    table configuration, and sponsors. Optional toggles control whether media
    (deep-copied), links, and donation labels are included.

    Returns **201 Created** with the full detail of the new event.
    """
    from app.services.permission_service import PermissionService

    # Verify source event exists
    source_event = await EventService.get_event_by_id(db, event_id)
    if not source_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    # Permission check — same pattern as get_event_stats
    permission_service = PermissionService()
    can_view = await permission_service.can_view_event(current_user, source_event.npo_id, db=db)
    if not can_view:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage events for this NPO",
        )

    new_event = await EventService.duplicate_event(db, event_id, current_user, options)

    # Build response with SAS URLs
    reloaded = await EventService.get_event_by_id(db, new_event.id)
    if not reloaded:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {new_event.id} not found",
        )

    response_dict = EventDetailResponse.model_validate(reloaded, from_attributes=True).model_dump()
    response_dict["npo_name"] = reloaded.npo.name if reloaded.npo else None
    _add_sas_urls_to_media(response_dict)
    return EventDetailResponse(**response_dict)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> None:
    """
    Delete an event.

    Requirements:
    - Event must be in DRAFT or CLOSED status (cannot delete active events)
    - User must be NPO Admin/Event Coordinator for the NPO or Super Admin
    """
    await EventService.delete_event(db, event_id, current_user)


@router.get("", response_model=EventListResponse)
async def list_events(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    npo_id: Annotated[uuid.UUID | None, Query()] = None,
    status_param: Annotated[str | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(max_length=255)] = None,
) -> EventListResponse:
    """
    List events with filtering and pagination.

    Access Control:
    - Super Admin: Can view all events (or filter by npo_id if specified)
    - NPO Admin: Can view events in their NPO only
    - Event Coordinator: Can view events in their NPO only
    - Staff: Can view events in their NPO only
    - Donor: Not allowed (blocked at route level)

    Filters:
    - npo_id: Show events for specific NPO (SuperAdmin only)
    - status: draft, active, or closed
    - search: case-insensitive match on event name or slug
    """
    from app.models.event import EventStatus
    from app.services.permission_service import PermissionService

    status_filter = None
    if status_param:
        try:
            status_filter = EventStatus(status_param)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_param}. Must be draft, active, or closed.",
            )

    # Apply role-based filtering
    permission_service = PermissionService()
    filtered_npo_id = await permission_service.get_npo_filter_for_user(db, current_user, npo_id)

    search_query = search.strip() if search and search.strip() else None

    events, total = await EventService.list_events(
        db,
        npo_id=filtered_npo_id,
        status_filter=status_filter,
        page=page,
        per_page=per_page,
        search_query=search_query,
    )

    # Manually construct response items to include NPO name
    items = []
    for event in events:
        items.append(
            EventSummaryResponse(
                id=event.id,
                npo_id=event.npo_id,
                npo_name=event.npo.name if event.npo else None,
                name=event.name,
                slug=event.slug,
                tagline=event.tagline,
                status=event.status,
                event_datetime=event.event_datetime,
                timezone=event.timezone,
                venue_name=event.venue_name,
                venue_city=event.venue_city,
                venue_state=event.venue_state,
                venue_zip=event.venue_zip,
                logo_url=event.logo_url,
                hero_transition_style=event.hero_transition_style,
                created_at=event.created_at,
                updated_at=event.updated_at,
            )
        )

    return EventListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=(total + per_page - 1) // per_page,
    )


@router.get("/{event_id}/stats", response_model=EventStatsResponse)
async def get_event_stats(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventStatsResponse:
    """Return aggregate badge counts for an event."""

    stats = await EventService.get_event_stats(db, event_id)
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    from app.services.permission_service import PermissionService

    permission_service = PermissionService()
    can_view = await permission_service.can_view_event(current_user, stats["npo_id"], db=db)
    if not can_view:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this event",
        )

    stats.pop("npo_id", None)
    return EventStatsResponse(**stats)


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
    response_dict = EventDetailResponse.model_validate(event, from_attributes=True).model_dump()
    _add_sas_urls_to_media(response_dict)
    return EventDetailResponse(**response_dict)
