"""Admin donate-now page configuration and moderation API endpoints."""

from __future__ import annotations

import math
import uuid
from pathlib import PurePath

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi import status as http_status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.donate_now_config import DonateNowPageConfig
from app.models.donate_now_media import DonateNowMedia
from app.models.npo import NPO
from app.models.npo_donation import NpoDonation, NpoDonationStatus
from app.models.support_wall_entry import SupportWallEntry
from app.models.user import User
from app.schemas.donate_now_config import (
    DonateNowConfigResponse,
    DonateNowConfigUpdate,
    DonateNowMediaResponse,
    DonationsDashboardResponse,
    DonationTierInput,
    DonationTierResponse,
    RecentDonationItem,
)
from app.schemas.support_wall_entry import AdminSupportWallEntryResponse, AdminSupportWallPage
from app.services.donate_now_service import DonateNowService
from app.services.media_service import MediaService

router = APIRouter(prefix="/admin/npos/{npo_id}/donate-now", tags=["Admin Donate Now"])


def _sanitize_upload_filename(filename: str, fallback: str) -> str:
    candidate = PurePath(filename).name.strip()
    sanitized = "".join(char if char.isalnum() or char in ".-_" else "_" for char in candidate)
    return sanitized or fallback


def _build_media_response(media: DonateNowMedia) -> DonateNowMediaResponse:
    file_url = media.file_url
    if media.blob_name:
        try:
            file_url = MediaService.generate_read_sas_url(media.blob_name)
        except Exception:
            file_url = media.file_url

    response = DonateNowMediaResponse.model_validate(media)
    return response.model_copy(update={"file_url": file_url})


def _build_config_response(config: DonateNowPageConfig) -> DonateNowConfigResponse:
    response = DonateNowConfigResponse.model_validate(config)
    npo_branding = config.npo.branding if config.npo else None
    media_items = [
        _build_media_response(media)
        for media in sorted(config.media_items or [], key=lambda item: item.display_order)
    ]
    return response.model_copy(
        update={
            "media_items": media_items,
            "npo_brand_color_primary": npo_branding.primary_color if npo_branding else None,
            "npo_brand_color_secondary": npo_branding.secondary_color if npo_branding else None,
            "npo_brand_logo_url": npo_branding.logo_url if npo_branding else None,
        }
    )


# ── Config endpoints ─────────────────────────────────────────────────────────


@router.get(
    "/config",
    response_model=DonateNowConfigResponse,
    summary="Get donate-now page config (admin)",
)
@require_role("super_admin", "npo_admin")
async def get_config(
    npo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DonateNowConfigResponse:
    """Return the donate-now page config for an NPO, creating one if not yet configured."""
    config = await DonateNowService.get_config(db, npo_id)
    await db.commit()
    return _build_config_response(config)


@router.put(
    "/config",
    response_model=DonateNowConfigResponse,
    summary="Update donate-now page config (admin)",
)
@require_role("super_admin", "npo_admin")
async def update_config(
    npo_id: uuid.UUID,
    data: DonateNowConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DonateNowConfigResponse:
    """Update the donate-now page config for an NPO."""
    from app.models.donate_now_config import DonateNowPageConfig

    config = await DonateNowService.update_config(db, npo_id, data)
    await db.commit()
    stmt = (
        select(DonateNowPageConfig)
        .where(DonateNowPageConfig.id == config.id)
        .options(
            selectinload(DonateNowPageConfig.tiers),
            selectinload(DonateNowPageConfig.media_items),
            selectinload(DonateNowPageConfig.npo).selectinload(NPO.branding),
        )
    )
    result = await db.execute(stmt)
    config = result.scalar_one()
    return _build_config_response(config)


# ── Donation stats dashboard ──────────────────────────────────────────────────


@router.get(
    "/stats",
    response_model=DonationsDashboardResponse,
    summary="Get donation stats for NPO donate-now page (admin)",
)
@require_role("super_admin", "npo_admin")
async def get_donation_stats(
    npo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DonationsDashboardResponse:
    """Return aggregate donation metrics and recent donations for the NPO."""
    base = select(NpoDonation).where(
        NpoDonation.npo_id == npo_id,
        NpoDonation.status == NpoDonationStatus.CAPTURED,
    )

    # Totals
    totals_stmt = select(
        func.count(NpoDonation.id).label("total_count"),
        func.coalesce(func.sum(NpoDonation.amount_cents), 0).label("total_amount_cents"),
        func.count(NpoDonation.id).filter(NpoDonation.is_monthly.is_(True)).label("monthly_count"),
        func.coalesce(
            func.sum(NpoDonation.amount_cents).filter(NpoDonation.is_monthly.is_(True)), 0
        ).label("monthly_amount_cents"),
    ).where(
        NpoDonation.npo_id == npo_id,
        NpoDonation.status == NpoDonationStatus.CAPTURED,
    )
    totals_result = await db.execute(totals_stmt)
    row = totals_result.one()
    total_count = row.total_count or 0
    total_amount_cents = row.total_amount_cents or 0
    monthly_count = row.monthly_count or 0
    monthly_amount_cents = row.monthly_amount_cents or 0
    one_time_count = total_count - monthly_count
    one_time_amount_cents = total_amount_cents - monthly_amount_cents

    # Recent donations (last 20, with donor)
    recent_stmt = (
        base.options(selectinload(NpoDonation.donor))
        .order_by(NpoDonation.created_at.desc())
        .limit(20)
    )
    recent_result = await db.execute(recent_stmt)
    recent = recent_result.scalars().all()

    recent_items = [
        RecentDonationItem(
            id=d.id,
            amount_cents=d.amount_cents,
            is_monthly=d.is_monthly,
            status=d.status.value,
            donor_name=(
                f"{d.donor.first_name} {d.donor.last_name}".strip() if d.donor else "Anonymous"
            ),
            event_id=getattr(d, "event_id", None),
            created_at=d.created_at,
        )
        for d in recent
    ]

    return DonationsDashboardResponse(
        total_count=total_count,
        total_amount_cents=total_amount_cents,
        one_time_count=one_time_count,
        one_time_amount_cents=one_time_amount_cents,
        monthly_count=monthly_count,
        monthly_amount_cents=monthly_amount_cents,
        recent=recent_items,
    )


# ── Tier endpoints ───────────────────────────────────────────────────────────


@router.get(
    "/tiers",
    response_model=list[DonationTierResponse],
    summary="List donation tiers (admin)",
)
@require_role("super_admin", "npo_admin")
async def get_tiers(
    npo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
@require_role("super_admin", "npo_admin")
async def update_tiers(
    npo_id: uuid.UUID,
    tiers: list[DonationTierInput],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
@require_role("super_admin", "npo_admin")
async def admin_list_support_wall(
    npo_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    include_hidden: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
@require_role("super_admin", "npo_admin")
async def hide_wall_entry(
    npo_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
@require_role("super_admin", "npo_admin")
async def restore_wall_entry(
    npo_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
@require_role("super_admin", "npo_admin")
async def get_hero_upload_url(
    npo_id: uuid.UUID,
    filename: str,
    content_type: str,
    current_user: User = Depends(get_current_user),
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


# ── Hero media management ─────────────────────────────────────────────────────

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime"}
_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post(
    "/media/upload",
    response_model=DonateNowMediaResponse,
    status_code=http_status.HTTP_201_CREATED,
    summary="Upload hero media for donate-now page (admin)",
)
@require_role("super_admin", "npo_admin")
async def upload_hero_media(
    npo_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DonateNowMediaResponse:
    """Upload a hero image or video for the donate-now page slideshow."""
    import logging

    from azure.storage.blob import BlobServiceClient, ContentSettings

    logger = logging.getLogger(__name__)
    settings = get_settings()

    content_type = file.content_type or "application/octet-stream"
    filename = _sanitize_upload_filename(file.filename or "upload.bin", "upload.bin")

    if content_type in _ALLOWED_IMAGE_TYPES:
        media_type = "image"
    elif content_type in _ALLOWED_VIDEO_TYPES:
        media_type = "video"
    else:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"File type {content_type} is not allowed. Accepted: images (jpeg/png/webp/gif) and videos (mp4/mov).",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if len(file_bytes) > _MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=http_status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 10 MB limit.",
        )

    config = await DonateNowService.get_config(db, npo_id)
    await db.commit()

    media_id = uuid.uuid4()
    blob_name = f"donate-now/{config.id}/{media_id}/{filename}"
    container_name = settings.azure_storage_container_name or "event-media"

    if not settings.azure_storage_connection_string:
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure Storage not configured.",
        )

    blob_service = BlobServiceClient.from_connection_string(
        settings.azure_storage_connection_string
    )

    try:
        blob = blob_service.get_blob_client(container=container_name, blob=blob_name)
        await run_in_threadpool(
            blob.upload_blob,
            file_bytes,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
    except Exception as exc:
        logger.exception("Direct blob upload failed for donate-now config %s", config.id)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to upload media to storage.",
        ) from exc

    if blob_service.url:
        base_url = blob_service.url.rstrip("/")
        file_url = f"{base_url}/{container_name}/{blob_name}"
    else:
        account_name = settings.azure_storage_account_name or "storage"
        file_url = f"https://{account_name}.blob.core.windows.net/{container_name}/{blob_name}"

    # Count existing items to set display_order
    count_result = await db.execute(
        select(func.count(DonateNowMedia.id)).where(DonateNowMedia.config_id == config.id)
    )
    display_order = count_result.scalar_one() or 0

    media = DonateNowMedia(
        id=media_id,
        config_id=config.id,
        media_type=media_type,
        file_url=file_url,
        file_name=filename,
        file_type=content_type,
        mime_type=content_type,
        blob_name=blob_name,
        file_size=len(file_bytes),
        display_order=display_order,
        uploaded_by=current_user.id,
    )
    db.add(media)
    await db.commit()
    await db.refresh(media)

    return _build_media_response(media)


@router.delete(
    "/media/{media_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Delete a hero media item (admin)",
)
@require_role("super_admin", "npo_admin")
async def delete_hero_media(
    npo_id: uuid.UUID,
    media_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a hero media item from the donate-now page slideshow."""
    import logging

    from azure.storage.blob import BlobServiceClient

    logger = logging.getLogger(__name__)
    settings = get_settings()

    config = await DonateNowService.get_config(db, npo_id)
    await db.commit()

    stmt = select(DonateNowMedia).where(
        DonateNowMedia.id == media_id,
        DonateNowMedia.config_id == config.id,
    )
    result = await db.execute(stmt)
    media = result.scalar_one_or_none()
    if media is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Media item not found.",
        )

    if settings.azure_storage_connection_string:
        try:
            blob_service = BlobServiceClient.from_connection_string(
                settings.azure_storage_connection_string
            )
            container_name = settings.azure_storage_container_name or "event-media"
            blob = blob_service.get_blob_client(container=container_name, blob=media.blob_name)
            await run_in_threadpool(blob.delete_blob)
        except Exception as exc:
            logger.error("Failed to delete blob %s: %s", media.blob_name, exc)

    await db.delete(media)
    await db.commit()


# ── Page logo upload ──────────────────────────────────────────────────────────

_ALLOWED_LOGO_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB


@router.post(
    "/page-logo",
    response_model=DonateNowConfigResponse,
    summary="Upload page logo for donate-now header (admin)",
)
@require_role("super_admin", "npo_admin")
async def upload_page_logo(
    npo_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DonateNowConfigResponse:
    """Upload a small square logo shown in the donate-now page header."""
    import logging

    from azure.storage.blob import BlobServiceClient, ContentSettings

    logger = logging.getLogger(__name__)
    settings = get_settings()

    content_type = file.content_type or "application/octet-stream"
    filename = _sanitize_upload_filename(file.filename or "logo.png", "logo.png")

    if content_type not in _ALLOWED_LOGO_TYPES:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Logo must be a JPEG, PNG, or WebP image.",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if len(file_bytes) > _MAX_LOGO_SIZE_BYTES:
        raise HTTPException(
            status_code=http_status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Logo file exceeds 2 MB limit.",
        )

    config = await DonateNowService.get_config(db, npo_id)
    await db.commit()

    blob_name = f"donate-now/{config.id}/logo/{filename}"
    container_name = settings.azure_storage_container_name or "event-media"

    if not settings.azure_storage_connection_string:
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure Storage not configured.",
        )

    blob_service = BlobServiceClient.from_connection_string(
        settings.azure_storage_connection_string
    )

    try:
        blob = blob_service.get_blob_client(container=container_name, blob=blob_name)
        await run_in_threadpool(
            blob.upload_blob,
            file_bytes,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
    except Exception as exc:
        logger.exception("Logo blob upload failed for donate-now config %s", config.id)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to upload logo to storage.",
        ) from exc

    if blob_service.url:
        base_url = blob_service.url.rstrip("/")
        logo_url = f"{base_url}/{container_name}/{blob_name}"
    else:
        account_name = settings.azure_storage_account_name or "storage"
        logo_url = f"https://{account_name}.blob.core.windows.net/{container_name}/{blob_name}"

    config.page_logo_url = logo_url
    await db.commit()

    # Reload with all relationships
    stmt = (
        select(DonateNowPageConfig)
        .where(DonateNowPageConfig.id == config.id)
        .options(
            selectinload(DonateNowPageConfig.tiers),
            selectinload(DonateNowPageConfig.media_items),
            selectinload(DonateNowPageConfig.npo).selectinload(NPO.branding),
        )
    )
    result = await db.execute(stmt)
    config = result.scalar_one()
    return _build_config_response(config)
