"""Public donate-now page API endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user_optional
from app.models.user import User
from app.schemas.donate_now_config import DonateNowPagePublic, DonationTierResponse
from app.schemas.npo_donation import DonationCreateRequest, DonationResponse
from app.schemas.support_wall_entry import SupportWallPage
from app.services.donate_now_service import DonateNowService
from app.services.npo_donation_service import NpoDonationService

router = APIRouter()


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
        tiers=[
            DonationTierResponse(
                id=t.id,
                amount_cents=t.amount_cents,
                impact_statement=t.impact_statement,
                display_order=t.display_order,
            )
            for t in (config.tiers or [])
        ],
        social_links=[],
        upcoming_event=None,
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
