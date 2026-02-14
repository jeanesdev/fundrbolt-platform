"""
Event Dashboard Admin API Endpoints

Provides admin-facing endpoints for event dashboard including:
- Dashboard summary with all metrics
- Segment breakdowns
- Projection adjustments
"""

import logging
from datetime import date
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models import User
from app.schemas.event_dashboard import (
    DashboardSummary,
    SegmentBreakdownResponse,
    SegmentType,
    ProjectionAdjustmentSet,
    ProjectionAdjustmentUpdate,
    ScenarioType,
)
from app.services.event_dashboard_service import EventDashboardService

logger = logging.getLogger(__name__)
router = APIRouter()


def require_admin(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    """Require admin privileges (Super Admin, NPO Admin, or NPO Staff)"""
    allowed_roles = ["super_admin", "npo_admin", "npo_staff"]
    user_role = getattr(current_user, "role_name", None)

    if user_role not in allowed_roles:
        logger.warning(f"User {current_user.id} with role {user_role} attempted to access admin dashboard")
        raise HTTPException(status_code=403, detail="Admin privileges required")

    return current_user


@router.get("/events/{event_id}/dashboard", response_model=DashboardSummary, tags=["Admin Dashboard"])
async def get_event_dashboard_summary(
    event_id: UUID,
    start_date: Optional[date] = Query(None, description="Filter start date"),
    end_date: Optional[date] = Query(None, description="Filter end date"),
    sources: Optional[str] = Query(None, description="Comma-separated revenue sources filter"),
    scenario: ScenarioType = Query(ScenarioType.BASE, description="Projection scenario"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> DashboardSummary:
    """
    Get event dashboard summary with all metrics

    Returns aggregated fundraising data including:
    - Total raised vs goal with variance
    - Revenue breakdowns by source (actual, projected, target)
    - Pacing status (on-track/off-track)
    - Waterfall chart data
    - Cashflow timeline
    - Conversion funnel
    - Active alerts

    **Permissions**: Super Admin, NPO Admin, NPO Staff
    **Auto-refresh**: Frontend should poll every 60 seconds
    """
    logger.info(f"Admin {current_user.id} requesting dashboard for event {event_id}")

    try:
        # Parse sources if provided
        source_list = sources.split(",") if sources else None

        summary = await EventDashboardService.get_dashboard_summary(
            db=db, event_id=event_id, start_date=start_date, end_date=end_date, sources=source_list, scenario=scenario
        )

        return summary

    except ValueError as e:
        logger.error(f"Error getting dashboard for event {event_id}: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting dashboard for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve dashboard data")


@router.get(
    "/events/{event_id}/dashboard/segments", response_model=SegmentBreakdownResponse, tags=["Admin Dashboard"]
)
async def get_dashboard_segments(
    event_id: UUID,
    segment_type: SegmentType = Query(..., description="Type of segment breakdown"),
    start_date: Optional[date] = Query(None, description="Filter start date"),
    end_date: Optional[date] = Query(None, description="Filter end date"),
    limit: int = Query(100, ge=1, le=200, description="Max number of items to return"),
    sort: str = Query("total_amount", description="Sort field: total_amount or contribution_share"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> SegmentBreakdownResponse:
    """
    Get segment breakdown by table, guest, registrant, or company

    Returns ranked list of segments with:
    - Total amount contributed
    - Contribution share (percentage of total)
    - Guest count

    **Permissions**: Super Admin, NPO Admin, NPO Staff
    """
    logger.info(f"Admin {current_user.id} requesting {segment_type} breakdown for event {event_id}")

    try:
        breakdown = await EventDashboardService.get_segment_breakdown(
            db=db, event_id=event_id, segment_type=segment_type, start_date=start_date, end_date=end_date, limit=limit, sort=sort
        )

        return breakdown

    except ValueError as e:
        logger.error(f"Error getting segment breakdown for event {event_id}: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting segment breakdown for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve segment breakdown")


@router.get(
    "/events/{event_id}/dashboard/projections",
    response_model=ProjectionAdjustmentSet,
    tags=["Admin Dashboard"],
)
async def get_projection_adjustments(
    event_id: UUID,
    scenario: ScenarioType = Query(ScenarioType.BASE, description="Projection scenario"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> ProjectionAdjustmentSet:
    """
    Get current projection adjustments for an event

    Returns projection values by revenue source for the selected scenario:
    - Base: Conservative estimates
    - Optimistic: Best-case projections
    - Conservative: Worst-case projections

    **Permissions**: Super Admin, NPO Admin, NPO Staff
    """
    logger.info(f"Admin {current_user.id} requesting projections for event {event_id}, scenario={scenario}")

    try:
        projections = await EventDashboardService.get_projection_adjustments(db=db, event_id=event_id, scenario=scenario)

        return projections

    except ValueError as e:
        logger.error(f"Error getting projections for event {event_id}: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting projections for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve projections")


@router.post(
    "/events/{event_id}/dashboard/projections",
    response_model=ProjectionAdjustmentSet,
    tags=["Admin Dashboard"],
)
async def update_projection_adjustments(
    event_id: UUID,
    update: ProjectionAdjustmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> ProjectionAdjustmentSet:
    """
    Update projection adjustments for an event

    Allows admins to adjust projected revenue by source for what-if analysis.
    Adjustments are event-wide and shared across all admins.

    **Permissions**: Super Admin, NPO Admin, NPO Staff
    **Effect**: Updates projected totals immediately in dashboard view
    """
    logger.info(
        f"Admin {current_user.id} updating projections for event {event_id}, scenario={update.scenario}"
    )

    try:
        projections = await EventDashboardService.update_projection_adjustments(
            db=db, event_id=event_id, scenario=update.scenario, adjustments=update.adjustments, user_id=current_user.id
        )

        logger.info(f"Successfully updated projections for event {event_id}")
        return projections

    except ValueError as e:
        logger.error(f"Error updating projections for event {event_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error updating projections for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update projections")
