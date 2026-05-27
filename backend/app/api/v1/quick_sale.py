"""Admin API endpoint for quick ticket sales at check-in."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_active_user
from app.models.event import Event
from app.models.user import User
from app.schemas.quick_sale import QuickSaleRequest, QuickSaleResponse
from app.services.permission_service import PermissionService
from app.services.quick_sale_service import QuickSaleService

logger = get_logger(__name__)
router = APIRouter()


async def _require_event_checkin_access(
    db: AsyncSession,
    current_user: User,
    event_id: uuid.UUID,
) -> Event:
    """Verify user has check-in permission for the event."""
    from sqlalchemy import select

    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    permission_service = PermissionService()
    has_access = await permission_service.can_view_event(current_user, event.npo_id, db=db)

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform check-in for this event",
        )

    return event


@router.post(
    "/admin/events/{event_id}/quick-sale",
    response_model=QuickSaleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Quick ticket sale at check-in",
    description="""
    Create a quick ticket sale for walk-up attendees at check-in.

    This endpoint:
    - Creates or finds a user account for the buyer
    - Creates a ticket purchase record (marked as completed/paid)
    - Creates an event registration
    - Creates guest records for all attendees
    - Optionally checks in all guests immediately

    Designed for rapid on-site ticket sales by check-in staff.
    """,
)
async def create_quick_sale(
    event_id: uuid.UUID,
    request: QuickSaleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> QuickSaleResponse:
    """
    Create a quick ticket sale at check-in.

    Args:
        event_id: Event ID
        request: Quick sale details
        db: Database session
        current_user: Current authenticated user (admin)

    Returns:
        QuickSaleResponse with purchase and guest details

    Raises:
        HTTPException: If validation fails or user lacks permission
    """
    # Verify event exists and user has check-in permission
    await _require_event_checkin_access(db, current_user, event_id)

    # Create the quick sale
    service = QuickSaleService(db)
    result = await service.create_quick_sale(
        event_id=event_id,
        request=request,
        admin_user=current_user,
    )

    logger.info(
        f"Quick sale created by {current_user.email} for event {event_id}: "
        f"{result.ticket_count} tickets, confirmation {result.confirmation_code}"
    )

    return result
