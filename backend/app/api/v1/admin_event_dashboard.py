"""Admin event dashboard API endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user, require_role
from app.models.user import User
from app.schemas.event_dashboard import (
    DashboardSummary,
    ProjectionAdjustmentSet,
    ProjectionAdjustmentUpdate,
    ScenarioType,
    SegmentBreakdownResponse,
    SegmentType,
    SortType,
)
from app.services.event_dashboard_service import EventDashboardService

router = APIRouter(prefix="/admin/events", tags=["admin-event-dashboard"])


def _is_super_admin_session(user: User) -> bool:
    role_name = getattr(user, "role_name", None)
    if role_name == "super_admin":
        return True
    return getattr(user, "spoofed_by_role", None) == "super_admin"


def _parse_reference_now(debug_now: str | None, user: User) -> datetime | None:
    if debug_now is None or not _is_super_admin_session(user):
        return None

    try:
        parsed = datetime.fromisoformat(debug_now.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Debug-Now header format. Use ISO-8601 timestamp.",
        ) from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)

    return parsed.astimezone(UTC)


@router.get(
    "/{event_id}/dashboard",
    response_model=DashboardSummary,
    summary="Get event dashboard summary",
    description="Returns aggregated fundraising metrics for an event dashboard.",
)
@require_role("super_admin", "npo_admin", "npo_staff", "event_coordinator", "staff")
async def get_event_dashboard(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    scenario: ScenarioType = Query(default="base"),
    debug_now: str | None = Header(default=None, alias="X-Debug-Now"),
) -> DashboardSummary:
    """Get dashboard summary for an event."""
    service = EventDashboardService(db)
    reference_now = _parse_reference_now(debug_now, current_user)
    try:
        return await service.get_dashboard_summary(
            event_id=event_id,
            scenario=scenario,
            reference_now=reference_now,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/{event_id}/dashboard/projections",
    response_model=ProjectionAdjustmentSet,
    summary="Get dashboard projection values",
)
@require_role("super_admin", "npo_admin", "npo_staff", "event_coordinator", "staff")
async def get_dashboard_projections(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    scenario: ScenarioType = Query(default="base"),
    debug_now: str | None = Header(default=None, alias="X-Debug-Now"),
) -> ProjectionAdjustmentSet:
    """Get projection values for a scenario."""
    service = EventDashboardService(db)
    reference_now = _parse_reference_now(debug_now, current_user)
    return await service.get_projection_adjustments(
        event_id=event_id,
        scenario=scenario,
        reference_now=reference_now,
    )


@router.post(
    "/{event_id}/dashboard/projections",
    response_model=ProjectionAdjustmentSet,
    summary="Update dashboard projection values",
)
@require_role("super_admin", "npo_admin", "npo_staff", "event_coordinator")
async def update_dashboard_projections(
    event_id: UUID,
    payload: ProjectionAdjustmentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    debug_now: str | None = Header(default=None, alias="X-Debug-Now"),
) -> ProjectionAdjustmentSet:
    """Update projection values for a scenario."""
    service = EventDashboardService(db)
    reference_now = _parse_reference_now(debug_now, current_user)
    return await service.update_projection_adjustments(
        event_id=event_id,
        payload=payload,
        updated_by=current_user.email,
        reference_now=reference_now,
    )


@router.get(
    "/{event_id}/dashboard/segments",
    response_model=SegmentBreakdownResponse,
    summary="Get segment contribution breakdown",
)
@require_role("super_admin", "npo_admin", "npo_staff", "event_coordinator", "staff")
async def get_dashboard_segments(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    segment_type: SegmentType = Query(...),
    limit: int = Query(default=20, ge=1, le=200),
    sort: SortType = Query(default="total_amount"),
) -> SegmentBreakdownResponse:
    """Get segment breakdown for selected segment type."""
    service = EventDashboardService(db)
    return await service.get_segment_breakdown(
        event_id=event_id,
        segment_type=segment_type,
        limit=limit,
        sort=sort,
    )
