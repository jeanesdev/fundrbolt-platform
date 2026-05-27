"""Auctioneer API endpoints for commission tracking, dashboard, and live auction."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.middleware.auth import get_current_active_user, require_role
from app.models.auction_item import AuctionItem
from app.models.event import Event
from app.models.user import User
from app.schemas.auctioneer import (
    AuctioneerItemDetailResponse,
    AuctioneerItemGalleryResponse,
    AuctioneerPaddleRaiseResponse,
    CommissionListResponse,
    CommissionResponse,
    CommissionUpsertRequest,
    DashboardResponse,
    EventSettingsResponse,
    EventSettingsUpsertRequest,
    LiveAuctionResponse,
)
from app.services.auction_item_media_service import AuctionItemMediaService
from app.services.auctioneer_service import AuctioneerService
from app.services.permission_service import PermissionService

router = APIRouter(prefix="/admin/events", tags=["admin-auctioneer"])


async def _verify_event_access(event_id: UUID, current_user: User, db: AsyncSession) -> None:
    """Verify the user can access the given event."""
    from app.models.event import Event

    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    permission_service = PermissionService()
    if not await permission_service.can_view_event(current_user, event.npo_id, db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this event",
        )


def _resolve_auctioneer_id(current_user: User, auctioneer_user_id: UUID | None) -> UUID:
    """Resolve the auctioneer user ID — own data or super_admin viewing another."""
    role = getattr(current_user, "role_name", "")
    if auctioneer_user_id and role == "super_admin":
        return auctioneer_user_id
    return current_user.id


def _sign_blob_url(url: str | None, media_service: AuctionItemMediaService) -> str | None:
    if not url or not url.startswith("https://"):
        return url

    settings = get_settings()

    # Check if URL is from the current configured storage account
    current_storage_account = settings.azure_storage_account_name
    if current_storage_account and current_storage_account not in url:
        # URL is from a different storage account (e.g., production images in dev environment)
        # Return as-is - these URLs are likely already public or from a different environment
        return url

    container_path = f"{settings.azure_storage_container_name}/"
    if container_path not in url:
        return url

    try:
        blob_path = url.split(container_path, 1)[1].split("?", 1)[0]
        return media_service._generate_blob_sas_url(blob_path, expiry_hours=24)
    except (IndexError, ValueError):
        return url


# ── Commission endpoints ─────────────────────────────────────


@router.get(
    "/{event_id}/auctioneer/commissions",
    response_model=CommissionListResponse,
    summary="List commissions for auctioneer on this event",
)
@require_role("super_admin", "auctioneer")
async def get_commissions(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    auctioneer_user_id: UUID | None = Query(default=None),
) -> CommissionListResponse:
    await _verify_event_access(event_id, current_user, db)
    target_id = _resolve_auctioneer_id(current_user, auctioneer_user_id)
    service = AuctioneerService(db)
    result = await service.get_commissions(event_id, target_id)

    # Sign image URLs with SAS tokens for Azure Blob Storage
    settings = get_settings()
    container_path = f"{settings.azure_storage_container_name}/"
    media_service = AuctionItemMediaService(settings, db)
    for commission in result.commissions:
        url = commission.primary_image_url
        if url and url.startswith("https://") and container_path in url:
            try:
                blob_path = url.split(container_path, 1)[1].split("?", 1)[0]
                commission.primary_image_url = media_service._generate_blob_sas_url(
                    blob_path, expiry_hours=24
                )
            except (ValueError, IndexError):
                pass

    return result


@router.put(
    "/{event_id}/auctioneer/commissions/{auction_item_id}",
    response_model=CommissionResponse,
    summary="Create or update commission for an auction item",
)
@require_role("super_admin", "auctioneer")
async def upsert_commission(
    event_id: UUID,
    auction_item_id: UUID,
    body: CommissionUpsertRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> CommissionResponse:
    await _verify_event_access(event_id, current_user, db)
    # Verify item belongs to event
    item = (
        await db.execute(
            select(AuctionItem).where(
                AuctionItem.id == auction_item_id,
                AuctionItem.event_id == event_id,
                AuctionItem.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction item not found")

    service = AuctioneerService(db)
    commission, created = await service.upsert_commission(
        auctioneer_user_id=current_user.id,
        auction_item_id=auction_item_id,
        commission_percent=body.commission_percent,
        flat_fee=body.flat_fee,
        notes=body.notes,
    )
    await db.commit()
    return commission


@router.delete(
    "/{event_id}/auctioneer/commissions/{auction_item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove commission for an auction item",
)
@require_role("super_admin", "auctioneer")
async def delete_commission(
    event_id: UUID,
    auction_item_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _verify_event_access(event_id, current_user, db)
    service = AuctioneerService(db)
    deleted = await service.delete_commission(current_user.id, auction_item_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Commission record not found"
        )
    await db.commit()


# ── Event settings endpoints ─────────────────────────────────


@router.get(
    "/{event_id}/auctioneer/settings",
    response_model=EventSettingsResponse,
    summary="Get auctioneer category percentages for this event",
)
@require_role("super_admin", "auctioneer")
async def get_event_settings(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    auctioneer_user_id: UUID | None = Query(default=None),
) -> EventSettingsResponse:
    await _verify_event_access(event_id, current_user, db)
    target_id = _resolve_auctioneer_id(current_user, auctioneer_user_id)
    service = AuctioneerService(db)
    return await service.get_event_settings(event_id, target_id)


@router.put(
    "/{event_id}/auctioneer/settings",
    response_model=EventSettingsResponse,
    summary="Update auctioneer category percentages",
)
@require_role("super_admin", "auctioneer")
async def upsert_event_settings(
    event_id: UUID,
    body: EventSettingsUpsertRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> EventSettingsResponse:
    await _verify_event_access(event_id, current_user, db)
    service = AuctioneerService(db)
    result = await service.upsert_event_settings(
        event_id=event_id,
        auctioneer_user_id=current_user.id,
        live_auction_percent=body.live_auction_percent,
        paddle_raise_percent=body.paddle_raise_percent,
        silent_auction_percent=body.silent_auction_percent,
        paddle_raise_levels=body.paddle_raise_levels,
        paddle_raise_total_goal=body.paddle_raise_total_goal,
        paddle_raise_level_goals=body.paddle_raise_level_goals,
    )
    await db.commit()
    return result


# ── Dashboard endpoint ───────────────────────────────────────


@router.get(
    "/{event_id}/auctioneer/dashboard",
    response_model=DashboardResponse,
    summary="Get auctioneer earnings dashboard",
)
@require_role("super_admin", "auctioneer")
async def get_dashboard(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    auctioneer_user_id: UUID | None = Query(default=None),
) -> DashboardResponse:
    await _verify_event_access(event_id, current_user, db)
    target_id = _resolve_auctioneer_id(current_user, auctioneer_user_id)
    service = AuctioneerService(db)
    return await service.get_dashboard(event_id, target_id)


# ── Live auction endpoint ────────────────────────────────────


@router.get(
    "/{event_id}/auctioneer/live-auction",
    response_model=LiveAuctionResponse,
    summary="Get current live auction item and bid history",
)
@require_role("super_admin", "auctioneer")
async def get_live_auction(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> LiveAuctionResponse:
    await _verify_event_access(event_id, current_user, db)
    service = AuctioneerService(db)
    return await service.get_live_auction(event_id)


@router.get(
    "/{event_id}/auctioneer/live-auction/gallery",
    response_model=AuctioneerItemGalleryResponse,
    summary="List live auction items with auctioneer metrics",
)
@require_role("super_admin", "auctioneer")
async def get_live_auction_gallery(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    auctioneer_user_id: UUID | None = Query(default=None),
) -> AuctioneerItemGalleryResponse:
    await _verify_event_access(event_id, current_user, db)
    target_id = _resolve_auctioneer_id(current_user, auctioneer_user_id)
    service = AuctioneerService(db)
    result = await service.get_live_auction_gallery(event_id, target_id)

    media_service = AuctionItemMediaService(get_settings(), db)
    for item in result.items:
        item.primary_image_url = _sign_blob_url(item.primary_image_url, media_service)

    return result


@router.get(
    "/{event_id}/auctioneer/silent-auction/gallery",
    response_model=AuctioneerItemGalleryResponse,
    summary="List silent auction items with auctioneer metrics",
)
@require_role("super_admin", "auctioneer")
async def get_silent_auction_gallery(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    auctioneer_user_id: UUID | None = Query(default=None),
) -> AuctioneerItemGalleryResponse:
    await _verify_event_access(event_id, current_user, db)
    target_id = _resolve_auctioneer_id(current_user, auctioneer_user_id)
    service = AuctioneerService(db)
    result = await service.get_silent_auction_gallery(event_id, target_id)

    media_service = AuctionItemMediaService(get_settings(), db)
    for item in result.items:
        item.primary_image_url = _sign_blob_url(item.primary_image_url, media_service)

    return result


@router.get(
    "/{event_id}/auctioneer/items/{item_id}",
    response_model=AuctioneerItemDetailResponse,
    summary="Get auctioneer detail for a live or silent auction item",
)
@require_role("super_admin", "auctioneer")
async def get_auctioneer_item_detail(
    event_id: UUID,
    item_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    auctioneer_user_id: UUID | None = Query(default=None),
) -> AuctioneerItemDetailResponse:
    await _verify_event_access(event_id, current_user, db)
    target_id = _resolve_auctioneer_id(current_user, auctioneer_user_id)
    service = AuctioneerService(db)
    try:
        result = await service.get_item_detail(event_id, item_id, target_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    media_service = AuctionItemMediaService(get_settings(), db)
    result.item.primary_image_url = _sign_blob_url(result.item.primary_image_url, media_service)
    return result


@router.get(
    "/{event_id}/auctioneer/paddle-raise",
    response_model=AuctioneerPaddleRaiseResponse,
    summary="Get paddle raise auctioneer dashboard data",
)
@require_role("super_admin", "auctioneer")
async def get_paddle_raise_dashboard(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    auctioneer_user_id: UUID | None = Query(default=None),
) -> AuctioneerPaddleRaiseResponse:
    await _verify_event_access(event_id, current_user, db)
    target_id = _resolve_auctioneer_id(current_user, auctioneer_user_id)
    service = AuctioneerService(db)
    return await service.get_paddle_raise(event_id, target_id)


@router.get(
    "/{event_id}/auctioneer/live-auction/slides/export",
    summary="Export live auction slide deck as PowerPoint",
)
@require_role("super_admin", "auctioneer")
async def export_live_auction_slides(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    auctioneer_user_id: UUID | None = Query(default=None),
) -> StreamingResponse:
    await _verify_event_access(event_id, current_user, db)
    target_id = _resolve_auctioneer_id(current_user, auctioneer_user_id)
    service = AuctioneerService(db)
    gallery = await service.get_live_auction_gallery(event_id, target_id)

    media_service = AuctionItemMediaService(get_settings(), db)
    for item in gallery.items:
        item.primary_image_url = _sign_blob_url(item.primary_image_url, media_service)

    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    deck_bytes = await service.build_slide_deck(gallery.items, event.name, "Live Auction")
    safe_name = "".join(
        char if char.isalnum() or char in "-_" else "-" for char in event.name
    ).strip("-")
    filename = f"{safe_name or 'event'}-live-auction-slides.pptx"

    return StreamingResponse(
        iter([deck_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/{event_id}/auctioneer/silent-auction/slides/export",
    summary="Export silent auction slide deck as PowerPoint",
)
@require_role("super_admin", "auctioneer")
async def export_silent_auction_slides(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    auctioneer_user_id: UUID | None = Query(default=None),
) -> StreamingResponse:
    await _verify_event_access(event_id, current_user, db)
    target_id = _resolve_auctioneer_id(current_user, auctioneer_user_id)
    service = AuctioneerService(db)
    gallery = await service.get_silent_auction_gallery(event_id, target_id)

    media_service = AuctionItemMediaService(get_settings(), db)
    for item in gallery.items:
        item.primary_image_url = _sign_blob_url(item.primary_image_url, media_service)

    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    deck_bytes = await service.build_slide_deck(gallery.items, event.name, "Silent Auction")
    safe_name = "".join(
        char if char.isalnum() or char in "-_" else "-" for char in event.name
    ).strip("-")
    filename = f"{safe_name or 'event'}-silent-auction-slides.pptx"

    return StreamingResponse(
        iter([deck_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
