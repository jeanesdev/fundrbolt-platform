"""Admin API endpoints for Revenue Generator items."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.revenue_generator import (
    ManualWinnerSelectRequest,
    RevenueGeneratorAdminListResponse,
    RevenueGeneratorEntryListResponse,
    RevenueGeneratorItemAdminResponse,
    RevenueGeneratorItemCreate,
    RevenueGeneratorItemUpdate,
    WinnerHistoryResponse,
    WinnerSelectionResponse,
)
from app.services.permission_service import PermissionService
from app.services.revenue_generator_service import RevenueGeneratorService

router = APIRouter(tags=["admin-revenue-generators"])


async def _require_event_access(
    db: AsyncSession,
    current_user: User,
    event_id: uuid.UUID,
) -> None:
    from sqlalchemy import select

    from app.models.event import Event

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    permission_service = PermissionService()
    if not await permission_service.can_view_event(current_user, event.npo_id, db=db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


async def _get_item_or_404(db: AsyncSession, item_id: uuid.UUID, event_id: uuid.UUID) -> object:
    from sqlalchemy import select

    from app.models.revenue_generator_item import RevenueGeneratorItem

    result = await db.execute(
        select(RevenueGeneratorItem).where(
            RevenueGeneratorItem.id == item_id,
            RevenueGeneratorItem.event_id == event_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Revenue generator item not found"
        )
    return item


# ─── Item Endpoints ───────────────────────────────────────────────────────────


@router.get(
    "/admin/events/{event_id}/revenue-generators",
    response_model=RevenueGeneratorAdminListResponse,
)
async def list_revenue_generator_items(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RevenueGeneratorAdminListResponse:
    """List all revenue generator items for an event."""
    await _require_event_access(db, current_user, event_id)
    return await RevenueGeneratorService.list_items_admin(db, event_id)


@router.post(
    "/admin/events/{event_id}/revenue-generators",
    response_model=RevenueGeneratorItemAdminResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_revenue_generator_item(
    event_id: uuid.UUID,
    data: RevenueGeneratorItemCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RevenueGeneratorItemAdminResponse:
    """Create a new revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    result = await RevenueGeneratorService.create_item(db, event_id, data, current_user.id)
    await db.commit()
    return result


@router.patch(
    "/admin/events/{event_id}/revenue-generators/{item_id}",
    response_model=RevenueGeneratorItemAdminResponse,
)
async def update_revenue_generator_item(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    data: RevenueGeneratorItemUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RevenueGeneratorItemAdminResponse:
    """Update a revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    item = await _get_item_or_404(db, item_id, event_id)
    result = await RevenueGeneratorService.update_item(db, item, data)  # type: ignore[arg-type]
    await db.commit()
    return result


@router.delete(
    "/admin/events/{event_id}/revenue-generators/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_revenue_generator_item(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    item = await _get_item_or_404(db, item_id, event_id)
    await RevenueGeneratorService.delete_item(db, item)  # type: ignore[arg-type]
    await db.commit()


# ─── Entry Endpoints ──────────────────────────────────────────────────────────


@router.get(
    "/admin/events/{event_id}/revenue-generators/{item_id}/entries",
    response_model=RevenueGeneratorEntryListResponse,
)
async def list_entries(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=200)] = 50,
    current_user: Annotated[User, Depends(get_current_user)] = None,  # type: ignore[assignment]
    db: Annotated[AsyncSession, Depends(get_db)] = None,  # type: ignore[assignment]
) -> RevenueGeneratorEntryListResponse:
    """List all entries (grouped by bidder) for a revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    await _get_item_or_404(db, item_id, event_id)
    return await RevenueGeneratorService.list_entries_admin(db, item_id, page, per_page)


# ─── Winner Endpoints ─────────────────────────────────────────────────────────


@router.post(
    "/admin/events/{event_id}/revenue-generators/{item_id}/draw-winner",
    response_model=WinnerSelectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def draw_random_winner(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WinnerSelectionResponse:
    """Draw a random winner for a revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    await _get_item_or_404(db, item_id, event_id)
    try:
        result = await RevenueGeneratorService.draw_random_winner(db, item_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    await db.commit()
    return result


@router.post(
    "/admin/events/{event_id}/revenue-generators/{item_id}/select-winner",
    response_model=WinnerSelectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def select_manual_winner(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ManualWinnerSelectRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WinnerSelectionResponse:
    """Manually select a winner for a revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    await _get_item_or_404(db, item_id, event_id)
    try:
        result = await RevenueGeneratorService.select_manual_winner(
            db, item_id, data, current_user.id
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    await db.commit()
    return result


@router.get(
    "/admin/events/{event_id}/revenue-generators/{item_id}/winner-history",
    response_model=WinnerHistoryResponse,
)
async def get_winner_history(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WinnerHistoryResponse:
    """Get winner selection history for a revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    await _get_item_or_404(db, item_id, event_id)
    return await RevenueGeneratorService.get_winner_history(db, item_id)
