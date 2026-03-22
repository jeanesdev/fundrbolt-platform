"""Event API endpoints."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.event_media_urls import add_sas_urls_to_event_media
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
from app.schemas.sponsor import SponsorResponse
from app.services.event_service import EventService
from app.services.sponsor_logo_service import SponsorLogoService
from app.services.sponsor_service import SponsorService

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
    add_sas_urls_to_event_media(response_dict, list(event_with_npo.media or []))
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

    add_sas_urls_to_event_media(response_dict, list(event.media or []))

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
    add_sas_urls_to_event_media(response_dict, list(event.media or []))
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
    add_sas_urls_to_event_media(response_dict, list(event.media or []))
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
    add_sas_urls_to_event_media(response_dict)
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
    add_sas_urls_to_event_media(response_dict, list(reloaded.media or []))
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
    try:
        filtered_npo_id = await permission_service.get_npo_filter_for_user(db, current_user, npo_id)
    except PermissionError as exc:
        if str(exc) == "npo_id is required for non-super_admin users":
            return EventListResponse(
                items=[],
                total=0,
                page=page,
                per_page=per_page,
                total_pages=0,
            )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

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
    add_sas_urls_to_event_media(response_dict, list(event.media or []))
    return EventDetailResponse(**response_dict)


@router.get(
    "/public/{slug}/sponsors",
    response_model=list[SponsorResponse],
    status_code=status.HTTP_200_OK,
)
async def list_public_event_sponsors(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[SponsorResponse]:
    """
    Public endpoint: List all sponsors for an active event by slug.

    No authentication required.
    Only returns sponsors for events with status=ACTIVE.
    """
    event = await EventService.get_event_by_slug(db, slug)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with slug '{slug}' not found or not active",
        )

    sponsors = await SponsorService.get_sponsors_for_event(db, event.id)

    sponsor_responses: list[SponsorResponse] = []
    for sponsor in sponsors:
        logo_url = sponsor.logo_url
        thumbnail_url = sponsor.thumbnail_url

        if sponsor.logo_blob_name and sponsor.logo_url:
            try:
                logo_url = SponsorLogoService.generate_blob_sas_url(
                    sponsor.logo_blob_name, expiry_hours=24
                )
            except Exception as e:
                logger.warning(f"Failed to generate logo SAS URL for sponsor {sponsor.id}: {e}")

        if sponsor.thumbnail_blob_name and sponsor.thumbnail_url:
            try:
                thumbnail_url = SponsorLogoService.generate_blob_sas_url(
                    sponsor.thumbnail_blob_name, expiry_hours=24
                )
            except Exception as e:
                logger.warning(
                    f"Failed to generate thumbnail SAS URL for sponsor {sponsor.id}: {e}"
                )

        sponsor_responses.append(
            SponsorResponse(
                id=sponsor.id,
                event_id=sponsor.event_id,
                name=sponsor.name,
                logo_url=logo_url,
                logo_blob_name=sponsor.logo_blob_name,
                thumbnail_url=thumbnail_url,
                thumbnail_blob_name=sponsor.thumbnail_blob_name,
                website_url=sponsor.website_url,
                logo_size=sponsor.logo_size,
                sponsor_level=sponsor.sponsor_level,
                contact_name=sponsor.contact_name,
                contact_email=sponsor.contact_email,
                contact_phone=sponsor.contact_phone,
                address_line1=sponsor.address_line1,
                address_line2=sponsor.address_line2,
                city=sponsor.city,
                state=sponsor.state,
                postal_code=sponsor.postal_code,
                country=sponsor.country,
                donation_amount=sponsor.donation_amount,
                notes=sponsor.notes,
                display_order=sponsor.display_order,
                created_at=sponsor.created_at.isoformat(),
                updated_at=sponsor.updated_at.isoformat(),
                created_by=sponsor.created_by,
            )
        )

    return sponsor_responses
