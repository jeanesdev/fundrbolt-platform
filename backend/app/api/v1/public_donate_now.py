"""Public donate-now page API endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.event_media_urls import resolve_event_logo_url
from app.core.database import get_db
from app.middleware.auth import get_current_user_optional
from app.models.donate_now_media import DonateNowMedia
from app.models.event import Event, EventStatus
from app.models.user import User
from app.schemas.donate_now_config import (
    DonateNowMediaResponse,
    DonateNowPagePublic,
    DonationTierResponse,
    UpcomingEventSummary,
)
from app.schemas.npo_donation import DonationCreateRequest, DonationResponse
from app.schemas.support_wall_entry import SupportWallPage
from app.services.donate_now_service import DonateNowService
from app.services.media_service import MediaService
from app.services.npo_donation_service import NpoDonationService

router = APIRouter()


def _build_media_response(media: DonateNowMedia) -> DonateNowMediaResponse:
    file_url = media.file_url
    if media.blob_name:
        try:
            file_url = MediaService.generate_read_sas_url(media.blob_name)
        except Exception:
            file_url = media.file_url

    response = DonateNowMediaResponse.model_validate(media)
    return response.model_copy(update={"file_url": file_url})


@router.get(
    "/npos/{npo_slug}/donate-now",
    response_model=DonateNowPagePublic,
    summary="Get public donate-now page data",
)
async def get_donate_now_page(
    npo_slug: str,
    db: AsyncSession = Depends(get_db),
) -> DonateNowPagePublic:
    """Return all data needed to render the donate-now page for an NPO.

    Returns 404 if the page is not enabled or the NPO slug doesn't exist.
    """
    npo, config = await DonateNowService.get_public_config(db, npo_slug)
    npo_branding = npo.branding if hasattr(npo, "branding") else None
    effective_primary = config.brand_color_primary or (
        npo_branding.primary_color if npo_branding else None
    )
    effective_secondary = config.brand_color_secondary or (
        npo_branding.secondary_color if npo_branding else None
    )
    effective_background = npo_branding.background_color if npo_branding else None
    effective_accent = npo_branding.accent_color if npo_branding else None

    upcoming_event_stmt = (
        select(Event)
        .options(selectinload(Event.media))
        .where(
            Event.npo_id == npo.id,
            Event.status == EventStatus.ACTIVE,
            Event.event_datetime >= datetime.now(UTC),
        )
        .order_by(Event.event_datetime.asc())
        .limit(1)
    )
    upcoming_event_result = await db.execute(upcoming_event_stmt)
    upcoming_event = upcoming_event_result.scalar_one_or_none()

    location_parts = [
        upcoming_event.venue_name if upcoming_event else None,
        upcoming_event.venue_city if upcoming_event else None,
        upcoming_event.venue_state if upcoming_event else None,
    ]
    upcoming_event_location = ", ".join([p for p in location_parts if p]) or None
    upcoming_event_summary = (
        UpcomingEventSummary(
            id=upcoming_event.id,
            name=upcoming_event.name,
            slug=upcoming_event.slug,
            start_date=upcoming_event.event_datetime.date(),
            location=upcoming_event_location,
            logo_url=resolve_event_logo_url(upcoming_event),
        )
        if upcoming_event
        else None
    )

    return DonateNowPagePublic(
        npo_id=npo.id,
        npo_name=npo.name,
        npo_slug=npo.slug,
        is_enabled=config.is_enabled,
        donate_plea_text=config.donate_plea_text,
        hero_media_url=config.hero_media_url,
        hero_transition_style=config.hero_transition_style,
        processing_fee_pct=config.processing_fee_pct,
        npo_info_text=config.npo_info_text,
        page_logo_url=config.page_logo_url,
        effective_color_primary=effective_primary,
        effective_color_secondary=effective_secondary,
        effective_color_background=effective_background,
        effective_color_accent=effective_accent,
        tiers=[
            DonationTierResponse(
                id=t.id,
                amount_cents=t.amount_cents,
                impact_statement=t.impact_statement,
                display_order=t.display_order,
            )
            for t in (config.tiers or [])
        ],
        media_items=[
            _build_media_response(m)
            for m in sorted(config.media_items or [], key=lambda x: x.display_order)
        ],
        social_links=[],
        upcoming_event=upcoming_event_summary,
    )


@router.post(
    "/npos/{npo_slug}/donate-now/donations",
    response_model=DonationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a donate-now donation",
)
async def create_donation(
    npo_slug: str,
    body: DonationCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> DonationResponse:
    """Submit a one-time or monthly donation to an NPO.

    - Requires the donor to be authenticated (JWT).
    - Donor must have an existing payment profile (vault).
    - Supply an `idempotency_key` to safely retry on network failure.
    """
    npo, config = await DonateNowService.get_public_config(db, npo_slug)

    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to donate.",
        )

    donation = await NpoDonationService.create_donation(
        db=db,
        npo=npo,
        config=config,
        donor=current_user,
        request=body,
    )
    await db.commit()
    await db.refresh(donation)
    return DonationResponse.model_validate(donation)


@router.get(
    "/npos/{npo_slug}/donate-now/support-wall",
    response_model=SupportWallPage,
    summary="Public support wall entries",
)
async def get_support_wall(
    npo_slug: str,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
    db: AsyncSession = Depends(get_db),
) -> SupportWallPage:
    """Return paginated visible support wall entries for a donate-now page."""
    npo, _config = await DonateNowService.get_public_config(db, npo_slug)
    return await NpoDonationService.get_public_support_wall(
        db=db, npo_id=npo.id, page=page, page_size=page_size
    )
