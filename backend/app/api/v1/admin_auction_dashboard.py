"""Admin auction dashboard API endpoints (read-only analytics)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user, require_role
from app.models.npo import NPO
from app.models.npo_member import MemberStatus, NPOMember
from app.models.user import User
from app.schemas.auction_dashboard import (
    AuctionDashboardCharts,
    AuctionDashboardSummary,
    AuctionItemDetailResponse,
    AuctionItemsListResponse,
)
from app.services.auction_dashboard_service import AuctionDashboardService

router = APIRouter(
    prefix="/admin/auction-dashboard",
    tags=["admin-auction-dashboard"],
)


async def _resolve_accessible_npo_ids(
    current_user: User,
    db: AsyncSession,
    npo_id: UUID | None = None,
) -> list[UUID]:
    """Resolve which NPO IDs the current user may access."""
    role = getattr(current_user, "role_name", None)

    if role == "super_admin":
        if npo_id:
            return [npo_id]
        result = await db.execute(select(NPO.id))
        return [row[0] for row in result.all()]

    if role == "auctioneer":
        stmt = select(NPOMember.npo_id).where(
            NPOMember.user_id == current_user.id,
            NPOMember.status == MemberStatus.ACTIVE,
        )
        result = await db.execute(stmt)
        npo_ids = [row[0] for row in result.all()]
        if npo_id and npo_id in npo_ids:
            return [npo_id]
        return npo_ids

    stmt = select(NPOMember.npo_id).where(
        NPOMember.user_id == current_user.id,
        NPOMember.status == MemberStatus.ACTIVE,
    )
    result = await db.execute(stmt)
    npo_ids = [row[0] for row in result.all()]
    if npo_id and npo_id in npo_ids:
        return [npo_id]
    return npo_ids


@router.get(
    "/summary",
    response_model=AuctionDashboardSummary,
    summary="Get auction dashboard summary statistics",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def get_summary(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    event_id: UUID | None = Query(default=None),
    npo_id: UUID | None = Query(default=None),
    auction_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
) -> AuctionDashboardSummary:
    accessible = await _resolve_accessible_npo_ids(current_user, db, npo_id)
    if not accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No accessible NPOs")
    service = AuctionDashboardService(db)
    return await service.get_summary(
        accessible, event_id=event_id, auction_type=auction_type, category=category
    )


@router.get(
    "/items",
    response_model=AuctionItemsListResponse,
    summary="Get paginated auction items list with metrics",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def get_items(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    event_id: UUID | None = Query(default=None),
    npo_id: UUID | None = Query(default=None),
    auction_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    sort_by: str = Query(default="current_bid_amount"),
    sort_order: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
) -> AuctionItemsListResponse:
    accessible = await _resolve_accessible_npo_ids(current_user, db, npo_id)
    if not accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No accessible NPOs")
    service = AuctionDashboardService(db)
    return await service.get_items(
        accessible,
        event_id=event_id,
        auction_type=auction_type,
        category=category,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/items/export",
    summary="Export auction items as CSV",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def export_items(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    event_id: UUID | None = Query(default=None),
    npo_id: UUID | None = Query(default=None),
    auction_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    sort_by: str = Query(default="current_bid_amount"),
    sort_order: str = Query(default="desc"),
) -> StreamingResponse:
    accessible = await _resolve_accessible_npo_ids(current_user, db, npo_id)
    if not accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No accessible NPOs")
    service = AuctionDashboardService(db)
    csv_data = await service.export_items_csv(
        accessible,
        event_id=event_id,
        auction_type=auction_type,
        category=category,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=auction-items.csv"},
    )


@router.get(
    "/charts",
    response_model=AuctionDashboardCharts,
    summary="Get chart data for auction dashboard visualizations",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def get_charts(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    event_id: UUID | None = Query(default=None),
    npo_id: UUID | None = Query(default=None),
    auction_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
) -> AuctionDashboardCharts:
    accessible = await _resolve_accessible_npo_ids(current_user, db, npo_id)
    if not accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No accessible NPOs")
    service = AuctionDashboardService(db)
    return await service.get_charts(
        accessible, event_id=event_id, auction_type=auction_type, category=category
    )


@router.get(
    "/items/{item_id}",
    response_model=AuctionItemDetailResponse,
    summary="Get detailed auction item with bid history",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def get_item_detail(
    item_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    npo_id: UUID | None = Query(default=None),
) -> AuctionItemDetailResponse:
    accessible = await _resolve_accessible_npo_ids(current_user, db, npo_id)
    if not accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No accessible NPOs")
    service = AuctionDashboardService(db)
    result = await service.get_item_detail(item_id, accessible)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction item not found")
    return result
