"""Admin API for event-level silent auction anti-sniping policy."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user, require_role
from app.models.event import Event
from app.models.user import User
from app.schemas.silent_auction_extension_policy import (
    SilentAuctionExtensionPolicyResponse,
    SilentAuctionExtensionPolicyUpdate,
)
from app.services.permission_service import PermissionService
from app.services.silent_auction_extension_service import SilentAuctionExtensionService

router = APIRouter(prefix="/admin/events", tags=["admin-silent-auction-extension"])


async def _verify_event_access(event_id: UUID, current_user: User, db: AsyncSession) -> None:
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    permission_service = PermissionService()
    if not await permission_service.can_view_event(current_user, event.npo_id, db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this event",
        )


@router.get(
    "/{event_id}/silent-auction/extension-policy",
    response_model=SilentAuctionExtensionPolicyResponse,
    summary="Get event-level silent auction extension policy",
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def get_extension_policy(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> SilentAuctionExtensionPolicyResponse:
    await _verify_event_access(event_id, current_user, db)
    service = SilentAuctionExtensionService(db)
    policy = await service.get_policy(event_id)
    await db.commit()
    await db.refresh(policy)
    return SilentAuctionExtensionPolicyResponse.model_validate(policy)


@router.put(
    "/{event_id}/silent-auction/extension-policy",
    response_model=SilentAuctionExtensionPolicyResponse,
    summary="Update event-level silent auction extension policy",
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def update_extension_policy(
    event_id: UUID,
    payload: SilentAuctionExtensionPolicyUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> SilentAuctionExtensionPolicyResponse:
    await _verify_event_access(event_id, current_user, db)
    service = SilentAuctionExtensionService(db)

    try:
        policy = await service.update_policy(
            event_id=event_id,
            auto_extension_enabled=payload.auto_extension_enabled,
            extension_duration_minutes=payload.extension_duration_minutes,
            max_total_extension_minutes=payload.max_total_extension_minutes,
            updated_by_user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    await db.commit()
    await db.refresh(policy)
    return SilentAuctionExtensionPolicyResponse.model_validate(policy)
