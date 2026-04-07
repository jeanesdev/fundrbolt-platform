"""Admin donor dashboard API endpoints."""

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
from app.schemas.donor_dashboard import (
    BidWarsResponse,
    CategoryBreakdownResponse,
    DonorLeaderboardResponse,
    DonorProfileResponse,
    OutbidLeadersResponse,
)
from app.services.donor_dashboard_service import DonorDashboardService

router = APIRouter(prefix="/admin/donor-dashboard", tags=["admin-donor-dashboard"])


async def _resolve_accessible_npo_ids(
    current_user: User,
    db: AsyncSession,
    npo_id: UUID | None = None,
) -> list[UUID]:
    """Resolve which NPO IDs the current user may access.

    - super_admin: all NPOs (or filtered to npo_id)
    - auctioneer: NPOs from NPOMember records
    - npo_admin / event_coordinator / staff: their single NPO
    """
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

    # NPO-scoped roles: use their current NPO membership
    stmt = select(NPOMember.npo_id).where(
        NPOMember.user_id == current_user.id,
        NPOMember.status == MemberStatus.ACTIVE,
    )
    result = await db.execute(stmt)
    npo_ids = [row[0] for row in result.all()]
    if npo_id and npo_id in npo_ids:
        return [npo_id]
    return npo_ids


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------


@router.get(
    "/leaderboard",
    response_model=DonorLeaderboardResponse,
    summary="Get ranked donor leaderboard",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def get_donor_leaderboard(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    event_id: UUID | None = Query(default=None),
    npo_id: UUID | None = Query(default=None),
    sort_by: str = Query(default="total_given"),
    sort_order: str = Query(default="desc"),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
) -> DonorLeaderboardResponse:
    accessible = await _resolve_accessible_npo_ids(current_user, db, npo_id)
    if not accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No accessible NPOs")
    service = DonorDashboardService(db)
    return await service.get_leaderboard(
        accessible,
        event_id=event_id,
        sort_by=sort_by,
        sort_order=sort_order,
        search=search,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/leaderboard/export",
    summary="Export donor leaderboard as CSV",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def export_donor_leaderboard(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    event_id: UUID | None = Query(default=None),
    npo_id: UUID | None = Query(default=None),
    sort_by: str = Query(default="total_given"),
    sort_order: str = Query(default="desc"),
    search: str | None = Query(default=None),
) -> StreamingResponse:
    accessible = await _resolve_accessible_npo_ids(current_user, db, npo_id)
    if not accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No accessible NPOs")
    service = DonorDashboardService(db)
    csv_data = await service.export_leaderboard_csv(
        accessible,
        event_id=event_id,
        sort_by=sort_by,
        sort_order=sort_order,
        search=search,
    )
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=donor-leaderboard.csv"},
    )


@router.get(
    "/donors/{user_id}",
    response_model=DonorProfileResponse,
    summary="Get detailed donor profile",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def get_donor_profile(
    user_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    event_id: UUID | None = Query(default=None),
    npo_id: UUID | None = Query(default=None),
) -> DonorProfileResponse:
    accessible = await _resolve_accessible_npo_ids(current_user, db, npo_id)
    if not accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No accessible NPOs")

    # Check user exists before calling service (separate 404 from 403)
    donor_exists = await db.scalar(select(User.id).where(User.id == user_id))
    if donor_exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donor not found")

    service = DonorDashboardService(db)
    profile = await service.get_donor_profile(user_id, accessible, event_id=event_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Donor profile is not accessible in the current scope",
        )
    return profile


@router.get(
    "/outbid-leaders",
    response_model=OutbidLeadersResponse,
    summary="Get donors ranked by outbid amount",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def get_outbid_leaders(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    event_id: UUID | None = Query(default=None),
    npo_id: UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
) -> OutbidLeadersResponse:
    accessible = await _resolve_accessible_npo_ids(current_user, db, npo_id)
    if not accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No accessible NPOs")
    service = DonorDashboardService(db)
    return await service.get_outbid_leaders(
        accessible, event_id=event_id, page=page, per_page=per_page
    )


@router.get(
    "/bid-wars",
    response_model=BidWarsResponse,
    summary="Get donors with most bid war activity",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def get_bid_wars(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    event_id: UUID | None = Query(default=None),
    npo_id: UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
) -> BidWarsResponse:
    accessible = await _resolve_accessible_npo_ids(current_user, db, npo_id)
    if not accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No accessible NPOs")
    service = DonorDashboardService(db)
    return await service.get_bid_wars(accessible, event_id=event_id, page=page, per_page=per_page)


@router.get(
    "/category-breakdown",
    response_model=CategoryBreakdownResponse,
    summary="Get giving breakdown by category",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def get_category_breakdown(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    event_id: UUID | None = Query(default=None),
    npo_id: UUID | None = Query(default=None),
) -> CategoryBreakdownResponse:
    accessible = await _resolve_accessible_npo_ids(current_user, db, npo_id)
    if not accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No accessible NPOs")
    service = DonorDashboardService(db)
    return await service.get_category_breakdown(accessible, event_id=event_id)
