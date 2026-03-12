"""Public ticket browsing and authenticated purchasing endpoints.

T007 — Donor ticket purchasing feature.
"""

from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.event import Event
from app.models.ticket_management import TicketPackage
from app.models.user import User
from app.schemas.ticket_purchasing import (
    CartValidationRequest,
    CartValidationResponse,
    CheckoutRequest,
    CheckoutResponse,
    SponsorLogoUploadResponse,
)
from app.services.ticket_purchasing_service import TicketPurchasingService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ticket-purchasing"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_LOGO_SIZE = 5 * 1024 * 1024  # 5 MB


@router.get("/events/{event_slug}/tickets")
async def get_available_tickets(
    event_slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, object]]:
    """Get available ticket packages for an event (public, no auth required).

    Looks up the event by slug, then returns all enabled ticket packages
    ordered by display_order.
    """
    result = await db.execute(select(Event).where(Event.slug == event_slug))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with slug '{event_slug}' not found",
        )

    packages_result = await db.execute(
        select(TicketPackage)
        .where(
            TicketPackage.event_id == event.id,
            TicketPackage.is_enabled.is_(True),
        )
        .options(selectinload(TicketPackage.custom_options))
        .order_by(TicketPackage.display_order)
    )
    packages = packages_result.scalars().all()

    return [
        {
            "id": str(pkg.id),
            "name": pkg.name,
            "description": pkg.description,
            "price": str(pkg.price),
            "seats_per_package": pkg.seats_per_package,
            "quantity_limit": pkg.quantity_limit,
            "sold_count": pkg.sold_count,
            "is_sponsorship": pkg.is_sponsorship,
            "custom_options": [
                {
                    "id": str(opt.id),
                    "label": opt.option_label,
                    "type": opt.option_type.value
                    if hasattr(opt.option_type, "value")
                    else str(opt.option_type),
                    "choices": opt.choices,
                    "is_required": opt.is_required,
                    "display_order": opt.display_order,
                }
                for opt in pkg.custom_options
            ],
        }
        for pkg in packages
    ]


@router.post(
    "/events/{event_id}/tickets/validate-cart",
    response_model=CartValidationResponse,
)
async def validate_cart(
    event_id: uuid.UUID,
    body: CartValidationRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> CartValidationResponse:
    """Validate cart contents and return a price breakdown.

    Pre-checkout step so the donor can see totals, promo discounts,
    and any warnings before committing.
    """
    service = TicketPurchasingService(db)
    return await service.validate_cart(
        event_id=event_id,
        items=body.items,
        promo_code=body.promo_code,
        user_id=current_user.id,
    )


@router.post(
    "/events/{event_id}/tickets/checkout",
    response_model=CheckoutResponse,
    status_code=status.HTTP_201_CREATED,
)
async def checkout(
    event_id: uuid.UUID,
    body: CheckoutRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> CheckoutResponse:
    """Process ticket checkout for the authenticated donor."""
    service = TicketPurchasingService(db)
    response = await service.checkout(
        event_id=event_id,
        checkout_request=body,
        user_id=current_user.id,
    )
    await db.commit()
    return response


@router.post(
    "/events/{event_id}/tickets/sponsorship-logo",
    response_model=SponsorLogoUploadResponse,
)
async def upload_sponsorship_logo(
    event_id: uuid.UUID,  # noqa: ARG001
    file: UploadFile,
    db: Annotated[AsyncSession, Depends(get_db)],  # noqa: ARG001
    current_user: Annotated[User, Depends(get_current_active_user)],  # noqa: ARG001
) -> SponsorLogoUploadResponse:
    """Upload a sponsor logo for a sponsorship-tier ticket purchase.

    Validates file type and size. Returns a blob name for use in
    the checkout request. Real blob storage will be wired up later.
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Allowed: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}",
        )

    contents = await file.read()
    if len(contents) > MAX_LOGO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large ({len(contents)} bytes). Maximum size is {MAX_LOGO_SIZE} bytes.",
        )

    blob_name = f"sponsor-logos/{uuid.uuid4()}/{file.filename}"
    logger.info("Sponsor logo uploaded: %s (%d bytes)", blob_name, len(contents))

    return SponsorLogoUploadResponse(
        blob_name=blob_name,
        preview_url=f"/placeholder/blobs/{blob_name}",
    )
