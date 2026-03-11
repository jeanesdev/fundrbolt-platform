"""Public Event API endpoints for donor PWA."""

import logging
import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.event import EventStatus
from app.models.ticket_management import TicketPackage
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


# ── Ticket Packages (public) ──────────────────────────────────────────────────


class PublicTicketPackageResponse(BaseModel):
    """Public-facing ticket package summary."""

    id: uuid.UUID
    name: str
    description: str | None
    price: Decimal
    seats_per_package: int
    quantity_remaining: int | None  # None = unlimited
    sold_out: bool
    image_url: str | None

    class Config:
        from_attributes = True


@router.get("/{slug}/ticket-packages", response_model=list[PublicTicketPackageResponse])
async def list_public_ticket_packages(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PublicTicketPackageResponse]:
    """Return enabled ticket packages for a public event.

    No authentication required — used by the anonymous ticket-browse page.
    Returns packages ordered by ``display_order``.

    ``quantity_remaining`` is ``null`` for unlimited packages (``quantity_limit IS NULL``).
    ``sold_out`` is ``true`` when a limited package has been fully sold.
    """
    event = await EventService.get_event_by_slug(db, slug)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{slug}' not found",
        )
    if event.status != EventStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{slug}' is not available",
        )

    result = await db.execute(
        select(TicketPackage)
        .where(
            TicketPackage.event_id == event.id,
            TicketPackage.is_enabled.is_(True),
        )
        .order_by(TicketPackage.display_order)
    )
    packages = result.scalars().all()

    out: list[PublicTicketPackageResponse] = []
    for pkg in packages:
        if pkg.quantity_limit is None:
            qty_remaining: int | None = None
            sold_out = False
        else:
            qty_remaining = max(0, pkg.quantity_limit - pkg.sold_count)
            sold_out = qty_remaining <= 0
        out.append(
            PublicTicketPackageResponse(
                id=pkg.id,
                name=pkg.name,
                description=pkg.description,
                price=pkg.price,
                seats_per_package=pkg.seats_per_package,
                quantity_remaining=qty_remaining,
                sold_out=sold_out,
                image_url=pkg.image_url,
            )
        )
    return out
