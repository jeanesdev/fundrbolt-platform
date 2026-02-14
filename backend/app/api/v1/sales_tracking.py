"""Admin API endpoints for ticket sales tracking and analytics."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_active_user
from app.models.event import Event
from app.models.user import User
from app.services.sales_tracking_service import SalesTrackingService

logger = get_logger(__name__)
router = APIRouter()


@router.get(
    "/events/{event_id}/tickets/sales/summary",
    summary="Get event revenue summary",
)
async def get_event_sales_summary(
    event_id: uuid.UUID,
    sponsorships_only: bool = Query(False, description="Filter to sponsorship packages only"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get aggregated sales summary for entire event."""
    # Verify event access
    result = await db.execute(
        select(Event).where(and_(Event.id == event_id, Event.npo_id == current_user.npo_id))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    service = SalesTrackingService(db)
    summary = await service.get_event_revenue_summary(event_id, sponsorships_only=sponsorships_only)

    logger.info(f"Retrieved sales summary for event {event_id}")
    return summary


@router.get(
    "/events/{event_id}/tickets/packages/{package_id}/sales",
    summary="Get package sales details",
)
async def get_package_sales_details(
    event_id: uuid.UUID,
    package_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get detailed sales information for a specific package."""
    # Verify event access
    result = await db.execute(
        select(Event).where(and_(Event.id == event_id, Event.npo_id == current_user.npo_id))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    service = SalesTrackingService(db)

    # Get package summary
    summary = await service.get_package_sales_summary(package_id)
    if not summary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    # Get purchasers list
    purchasers_data = await service.get_purchasers_list(package_id, page, per_page)

    logger.info(f"Retrieved sales details for package {package_id}")
    return {**summary, **purchasers_data}


@router.get(
    "/events/{event_id}/tickets/sales",
    summary="Get event sales list",
)
async def get_event_sales_list(
    event_id: uuid.UUID,
    search: str | None = Query(None, description="Search purchasers, packages, and promos"),
    sort_by: str = Query("purchased_at", description="Sort field"),
    sort_dir: str = Query("desc", description="Sort direction: asc or desc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get paginated list of ticket purchases for an event."""
    result = await db.execute(
        select(Event).where(and_(Event.id == event_id, Event.npo_id == current_user.npo_id))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    service = SalesTrackingService(db)
    try:
        sales_data = await service.get_event_sales_list(
            event_id=event_id,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            page=page,
            per_page=per_page,
        )
    except Exception:
        logger.exception("Failed to retrieve sales list", extra={"event_id": str(event_id)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load sales data",
        )

    logger.info(f"Retrieved sales list for event {event_id}")
    return sales_data


@router.get(
    "/events/{event_id}/tickets/sales/export",
    summary="Export sales data as CSV",
)
async def export_sales_csv(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Response:
    """Export all ticket sales for an event as CSV file."""
    # Verify event access
    result = await db.execute(
        select(Event).where(and_(Event.id == event_id, Event.npo_id == current_user.npo_id))
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    service = SalesTrackingService(db)
    csv_data = await service.generate_sales_csv_export(event_id)

    logger.info(f"Generated CSV export for event {event_id}")

    # Return CSV with appropriate headers
    filename = f"ticket_sales_{event.name.replace(' ', '_')}_{event_id}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
