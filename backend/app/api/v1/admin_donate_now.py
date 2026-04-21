"""Admin donate-now page configuration and moderation API endpoints."""

from __future__ import annotations

import math
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.middleware.auth import require_role
from app.models.support_wall_entry import SupportWallEntry
from app.models.user import User
from app.schemas.donate_now_config import (
    DonateNowConfigResponse,
    DonateNowConfigUpdate,
    DonationTierInput,
    DonationTierResponse,
)
from app.schemas.support_wall_entry import AdminSupportWallEntryResponse, AdminSupportWallPage
from app.services.donate_now_service import DonateNowService

router = APIRouter(prefix="/admin/npos/{npo_id}/donate-now", tags=["Admin Donate Now"])


# ── Config endpoints ─────────────────────────────────────────────────────────


@router.get(
    "/config",
    response_model=DonateNowConfigResponse,
    summary="Get donate-now page config (admin)",
)
async def get_config(
    npo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("super_admin", "npo_admin")),
) -> DonateNowConfigResponse:
    """Return the donate-now page config for an NPO, creating one if not yet configured."""
    config = await DonateNowService.get_config(db, npo_id)
    await db.commit()
    return DonateNowConfigResponse.model_validate(config)


@router.put(
    "/config",
    response_model=DonateNowConfigResponse,
    summary="Update donate-now page config (admin)",
)
async def update_config(
    npo_id: uuid.UUID,
    data: DonateNowConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("super_admin", "npo_admin")),
) -> DonateNowConfigResponse:
    """Update the donate-now page config for an NPO."""
    config = await DonateNowService.update_config(db, npo_id, data)
    await db.commit()
    await db.refresh(config)
    return DonateNowConfigResponse.model_validate(config)


# ── Tier endpoints ───────────────────────────────────────────────────────────


@router.get(
    "/tiers",
    response_model=list[DonationTierResponse],
    summary="List donation tiers (admin)",
)
async def get_tiers(
    npo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("super_admin", "npo_admin")),
) -> list[DonationTierResponse]:
    """Return all donation tiers for the NPO's donate-now page."""
    config = await DonateNowService.get_config(db, npo_id)
    await db.commit()
    return [DonationTierResponse.model_validate(t) for t in config.tiers]


@router.put(
    "/tiers",
    response_model=list[DonationTierResponse],
    summary="Replace donation tiers (admin)",
)
async def update_tiers(
    npo_id: uuid.UUID,
    tiers: list[DonationTierInput],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("super_admin", "npo_admin")),
) -> list[DonationTierResponse]:
    """Replace all donation tiers for the NPO's donate-now page (max 10)."""
    new_tiers = await DonateNowService.upsert_tiers(db, npo_id, tiers)
    await db.commit()
    return [DonationTierResponse.model_validate(t) for t in new_tiers]


# ── Support wall moderation ──────────────────────────────────────────────────


@router.get(
    "/support-wall",
    response_model=AdminSupportWallPage,
    summary="List support wall entries (admin)",
)
async def admin_list_support_wall(
    npo_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    include_hidden: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("super_admin", "npo_admin")),
) -> AdminSupportWallPage:
    """List all support wall entries for an NPO, optionally including hidden ones."""
    stmt = select(SupportWallEntry).where(SupportWallEntry.npo_id == npo_id)
    if not include_hidden:
        stmt = stmt.where(SupportWallEntry.is_hidden.is_(False))
    stmt = stmt.order_by(SupportWallEntry.created_at.desc())

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt.options(selectinload(SupportWallEntry.donation)))
    entries = result.scalars().all()

    entry_responses = [
        AdminSupportWallEntryResponse(
            id=e.id,
            donation_id=e.donation_id,
            npo_id=e.npo_id,
            donor_user_id=e.donation.donor_user_id if e.donation else None,
            display_name=e.display_name,
            is_anonymous=e.is_anonymous,
            show_amount=e.show_amount,
            amount_cents=e.donation.amount_cents if e.donation else None,
            message=e.message,
            is_hidden=e.is_hidden,
            created_at=e.created_at,
        )
        for e in entries
    ]

    return AdminSupportWallPage(
        entries=entry_responses,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.post(
    "/support-wall/{entry_id}/hide",
    status_code=204,
    summary="Hide a support wall entry (admin)",
)
async def hide_wall_entry(
    npo_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("super_admin", "npo_admin")),
) -> None:
    """Hide a support wall entry from the public wall."""
    from fastapi import HTTPException
    from fastapi import status as http_status

    stmt = select(SupportWallEntry).where(
        SupportWallEntry.id == entry_id,
        SupportWallEntry.npo_id == npo_id,
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Entry not found")
    entry.is_hidden = True
    await db.commit()


@router.post(
    "/support-wall/{entry_id}/restore",
    status_code=204,
    summary="Restore a hidden support wall entry (admin)",
)
async def restore_wall_entry(
    npo_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("super_admin", "npo_admin")),
) -> None:
    """Restore a hidden support wall entry to the public wall."""
    from fastapi import HTTPException
    from fastapi import status as http_status

    stmt = select(SupportWallEntry).where(
        SupportWallEntry.id == entry_id,
        SupportWallEntry.npo_id == npo_id,
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Entry not found")
    entry.is_hidden = False
    await db.commit()


# ── Hero upload URL ──────────────────────────────────────────────────────────


@router.post(
    "/hero-upload-url",
    summary="Generate SAS URL for hero media upload (admin)",
)
async def get_hero_upload_url(
    npo_id: uuid.UUID,
    filename: str,
    content_type: str,
    current_user: User = Depends(require_role("super_admin", "npo_admin")),
) -> dict[str, str]:
    """Generate an Azure Blob SAS upload URL for the donate-now hero image.

    The caller uploads directly to the returned URL, then calls PUT /config
    with the resulting blob URL as hero_media_url.
    """
    from app.core.config import get_settings
    from app.services.file_upload_service import FileUploadService

    settings = get_settings()
    service = FileUploadService(settings)
    upload_url, blob_url = service.generate_upload_sas_url(npo_id, filename, content_type)
    return {"upload_url": upload_url, "blob_url": blob_url}
