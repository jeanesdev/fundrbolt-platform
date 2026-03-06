"""Public Event API endpoints for donor PWA."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.event import EventStatus
from app.schemas.event import EventDetailResponse, EventListResponse, EventSummaryResponse
from app.schemas.sponsor import SponsorResponse
from app.services.event_service import EventService
from app.services.sponsor_logo_service import SponsorLogoService
from app.services.sponsor_service import SponsorService

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


@router.get(
    "/{slug}/sponsors",
    response_model=list[SponsorResponse],
    status_code=status.HTTP_200_OK,
)
async def list_public_event_sponsors(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[SponsorResponse]:
    """
    List all sponsors for a public event by slug.

    Only active events' sponsors are returned.
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
            detail=f"Event with slug '{slug}' is not available",
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
