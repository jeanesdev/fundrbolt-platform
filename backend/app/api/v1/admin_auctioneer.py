"""Auctioneer API endpoints for commission tracking, dashboard, and live auction."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.middleware.auth import get_current_active_user, require_role
from app.models.auction_item import AuctionItem
from app.models.user import User
from app.schemas.auctioneer import (
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
