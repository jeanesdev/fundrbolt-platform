"""Admin API endpoints for seating management."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.event import Event
from app.models.registration_guest import RegistrationGuest
from app.models.user import User
from app.schemas.seating import (
    AutoAssignResponse,
    AvailableBidderNumbersResponse,
    BidderNumberAssignmentRequest,
    BidderNumberAssignmentResponse,
    EventSeatingConfigRequest,
    EventSeatingConfigResponse,
    GuestSeatingListResponse,
    TableAssignmentRequest,
    TableAssignmentResponse,
    TableOccupancyResponse,
)
from app.services.auto_assign_service import AutoAssignService
from app.services.bidder_number_service import BidderNumberService
from app.services.seating_service import SeatingService

router = APIRouter(prefix="/admin/events", tags=["admin-seating"])


@router.patch(
    "/{event_id}/seating/config",
    response_model=EventSeatingConfigResponse,
    status_code=status.HTTP_200_OK,
)
async def configure_event_seating(
    event_id: UUID,
    config: EventSeatingConfigRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventSeatingConfigResponse:
    """
    Configure event seating (table count and max guests per table).

    Requires NPO Admin or NPO Staff role.

    Args:
        event_id: Event UUID
        config: Seating configuration (table_count, max_guests_per_table)
        current_user: Authenticated user
        db: Database session

    Returns:
        EventSeatingConfigResponse with configured values

    Raises:
        HTTPException 404: Event not found
        HTTPException 403: User lacks permission to manage event
        HTTPException 400: Invalid configuration values
    """
    # Require NPO Admin or NPO Staff role
    role_name = getattr(current_user, "role_name", "")
    if role_name not in ["super_admin", "npo_admin", "npo_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. NPO Admin or NPO Staff role required.",
        )

    # Get event
    query = select(Event).where(Event.id == event_id)
    result = await db.execute(query)
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found",
        )

    # Verify user has permission to manage this event
    # Super admins can manage any event, others must belong to the same NPO
    # Verify user has permission to manage this event
    # Super admins can manage any event, others must belong to the same NPO
    if current_user.role_name != "super_admin":
        if hasattr(current_user, "npo_id") and current_user.npo_id != event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event",
            )

    # Validate configuration
    try:
        await SeatingService.validate_seating_config(
            config.table_count,
            config.max_guests_per_table,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Update event seating configuration
    event.table_count = config.table_count
    event.max_guests_per_table = config.max_guests_per_table
    event.updated_by = current_user.id

    await db.commit()
    await db.refresh(event)

    # Return response
    return EventSeatingConfigResponse(
        event_id=event.id,
        table_count=event.table_count,
        max_guests_per_table=event.max_guests_per_table,
        total_capacity=event.total_seating_capacity or 0,
    )


@router.get(
    "/{event_id}/seating/bidder-numbers/available",
    response_model=AvailableBidderNumbersResponse,
    status_code=status.HTTP_200_OK,
)
async def get_available_bidder_numbers(
    event_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(
        default=10, ge=1, le=100, description="Number of available bidder numbers to return"
    ),
) -> AvailableBidderNumbersResponse:
    """
    Get available bidder numbers for an event.

    Returns a list of the next available bidder numbers (100-999) for assignment.
    Useful for displaying available numbers in the admin UI before manual assignment.

    Requires NPO Admin or NPO Staff role.

    Args:
        event_id: Event UUID
        current_user: Authenticated user
        db: Database session
        limit: Maximum number of available numbers to return (1-100, default 10)

    Returns:
        AvailableBidderNumbersResponse with available numbers list and counts

    Raises:
        HTTPException 404: Event not found
        HTTPException 403: User lacks permission to manage event
    """
    # Require NPO Admin or NPO Staff role
    if current_user.role_name not in ["super_admin", "npo_admin", "npo_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. NPO Admin or NPO Staff role required.",
        )

    # Get event
    query = select(Event).where(Event.id == event_id)
    result = await db.execute(query)
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found",
        )

    # Verify user has permission to manage this event
    # Super admins can manage any event, others must belong to the same NPO
    # Verify user has permission to manage this event
    # Super admins can manage any event, others must belong to the same NPO
    if current_user.role_name != "super_admin":
        if hasattr(current_user, "npo_id") and current_user.npo_id != event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event",
            )

    # Get available bidder numbers
    available_numbers = await BidderNumberService.get_available_bidder_numbers(db, event_id, limit)

    # Get total assigned count
    total_assigned = await BidderNumberService.get_bidder_count(db, event_id)
    total_available = 900 - total_assigned  # Range is 100-999

    return AvailableBidderNumbersResponse(
        event_id=event_id,
        available_numbers=available_numbers,
        total_available=total_available,
        total_assigned=total_assigned,
    )


@router.patch(
    "/{event_id}/guests/{guest_id}/bidder-number",
    response_model=BidderNumberAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
async def assign_bidder_number_manually(
    event_id: UUID,
    guest_id: UUID,
    request: BidderNumberAssignmentRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BidderNumberAssignmentResponse:
    """
    Manually assign or reassign a bidder number to a guest.

    If the requested bidder number is already assigned to another guest, the service
    will automatically swap the numbers (conflict resolution).

    Requires NPO Admin or NPO Staff role.

    Args:
        event_id: Event UUID
        guest_id: Guest UUID to assign bidder number to
        request: BidderNumberAssignmentRequest with bidder_number (100-999)
        current_user: Authenticated user
        db: Database session

    Returns:
        BidderNumberAssignmentResponse with guest_id, bidder_number, assigned_at,
        and previous_holder_id (if a swap occurred)

    Raises:
        HTTPException 404: Event or guest not found
        HTTPException 403: User lacks permission to manage event
        HTTPException 400: Guest does not belong to event or assignment failed
    """
    # Require NPO Admin or NPO Staff role
    if current_user.role_name not in ["super_admin", "npo_admin", "npo_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. NPO Admin or NPO Staff role required.",
        )

    # Get event
    event_query = select(Event).where(Event.id == event_id)
    event_result = await db.execute(event_query)
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found",
        )

    # Verify user has permission to manage this event

    # Super admins can manage any event, others must belong to the same NPO

    # Verify user has permission to manage this event
    # Super admins can manage any event, others must belong to the same NPO
    if current_user.role_name != "super_admin":
        if hasattr(current_user, "npo_id") and current_user.npo_id != event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event",
            )

    # Get guest and verify they belong to this event
    guest_query = select(RegistrationGuest).where(RegistrationGuest.id == guest_id)
    guest_result = await db.execute(guest_query)
    guest = guest_result.scalar_one_or_none()

    if not guest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guest {guest_id} not found",
        )

    # Verify guest's registration belongs to this event
    from app.models.event_registration import EventRegistration

    registration_query = select(EventRegistration).where(
        EventRegistration.id == guest.registration_id
    )
    registration_result = await db.execute(registration_query)
    registration = registration_result.scalar_one_or_none()

    if not registration or registration.event_id != event_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Guest {guest_id} does not belong to event {event_id}",
        )

    # Call reassignment service (handles conflict resolution automatically)
    try:
        result = await BidderNumberService.reassign_bidder_number(
            db, event_id, guest_id, request.bidder_number
        )

        # Log the assignment
        if result["previous_holder_id"]:
            print(
                f"Manual bidder number assignment: Swapped {request.bidder_number} "
                f"from guest {result['previous_holder_id']} to guest {guest_id}"
            )
        else:
            print(
                f"Manual bidder number assignment: Assigned {request.bidder_number} "
                f"to guest {guest_id}"
            )

        # Type assertions for service response
        guest_id_result = result["guest_id"]
        bidder_number_result = result["bidder_number"]
        previous_holder_id_result = result.get("previous_holder_id")

        assert isinstance(guest_id_result, UUID)
        assert isinstance(bidder_number_result, int)

        return BidderNumberAssignmentResponse(
            guest_id=guest_id_result,
            bidder_number=bidder_number_result,
            assigned_at=datetime.now(UTC),
            previous_holder_id=previous_holder_id_result
            if isinstance(previous_holder_id_result, UUID)
            else None,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.patch(
    "/{event_id}/guests/{guest_id}/table",
    response_model=TableAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
async def assign_guest_to_table(
    event_id: UUID,
    guest_id: UUID,
    request: TableAssignmentRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TableAssignmentResponse:
    """
    Assign a guest to a table.

    Validates table number is within event configuration and checks capacity.

    Requires NPO Admin or NPO Staff role.

    Args:
        event_id: Event UUID
        guest_id: Guest UUID
        request: TableAssignmentRequest with table_number
        current_user: Authenticated user
        db: Database session

    Returns:
        TableAssignmentResponse with guest_id, table_number, and bidder_number

    Raises:
        HTTPException 404: Event or guest not found
        HTTPException 403: User lacks permission to manage event
        HTTPException 400: Table assignment validation failed (invalid number or at capacity)
    """
    # Require NPO Admin or NPO Staff role
    if current_user.role_name not in ["super_admin", "npo_admin", "npo_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. NPO Admin or NPO Staff role required.",
        )

    # Get event
    event_query = select(Event).where(Event.id == event_id)
    event_result = await db.execute(event_query)
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found",
        )

    # Verify user has permission to manage this event

    # Super admins can manage any event, others must belong to the same NPO

    # Verify user has permission to manage this event
    # Super admins can manage any event, others must belong to the same NPO
    if current_user.role_name != "super_admin":
        if hasattr(current_user, "npo_id") and current_user.npo_id != event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event",
            )

    # Get guest
    guest_query = select(RegistrationGuest).where(RegistrationGuest.id == guest_id)
    guest_result = await db.execute(guest_query)
    guest = guest_result.scalar_one_or_none()

    if not guest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guest {guest_id} not found",
        )

    # Assign guest to table
    try:
        updated_guest = await SeatingService.assign_guest_to_table(
            db, event_id, guest_id, request.table_number
        )

        return TableAssignmentResponse(
            guest_id=updated_guest.id,
            table_number=updated_guest.table_number,  # type: ignore
            bidder_number=updated_guest.bidder_number,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete(
    "/{event_id}/guests/{guest_id}/table",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_guest_from_table(
    event_id: UUID,
    guest_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Remove a guest from their assigned table.

    Requires NPO Admin or NPO Staff role.

    Args:
        event_id: Event UUID
        guest_id: Guest UUID
        current_user: Authenticated user
        db: Database session

    Raises:
        HTTPException 404: Event or guest not found
        HTTPException 403: User lacks permission to manage event
    """
    # Require NPO Admin or NPO Staff role
    if current_user.role_name not in ["super_admin", "npo_admin", "npo_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. NPO Admin or NPO Staff role required.",
        )

    # Get event
    event_query = select(Event).where(Event.id == event_id)
    event_result = await db.execute(event_query)
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found",
        )

    # Verify user has permission to manage this event

    # Super admins can manage any event, others must belong to the same NPO

    # Verify user has permission to manage this event
    # Super admins can manage any event, others must belong to the same NPO
    if current_user.role_name != "super_admin":
        if hasattr(current_user, "npo_id") and current_user.npo_id != event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event",
            )

    # Get guest
    guest_query = select(RegistrationGuest).where(RegistrationGuest.id == guest_id)
    guest_result = await db.execute(guest_query)
    guest = guest_result.scalar_one_or_none()

    if not guest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guest {guest_id} not found",
        )

    # Remove guest from table
    await SeatingService.remove_guest_from_table(db, guest_id)


@router.get(
    "/{event_id}/seating/tables/{table_number}/occupancy",
    response_model=TableOccupancyResponse,
    status_code=status.HTTP_200_OK,
)
async def get_table_occupancy(
    event_id: UUID,
    table_number: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TableOccupancyResponse:
    """
    Get occupancy information for a specific table.

    Returns current occupancy, capacity, and list of guests at the table.

    Requires NPO Admin or NPO Staff role.

    Args:
        event_id: Event UUID
        table_number: Table number
        current_user: Authenticated user
        db: Database session

    Returns:
        TableOccupancyResponse with occupancy details and guest list

    Raises:
        HTTPException 404: Event not found
        HTTPException 403: User lacks permission to manage event
    """
    # Require NPO Admin or NPO Staff role
    if current_user.role_name not in ["super_admin", "npo_admin", "npo_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. NPO Admin or NPO Staff role required.",
        )

    # Get event
    event_query = select(Event).where(Event.id == event_id)
    event_result = await db.execute(event_query)
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found",
        )

    # Verify user has permission to manage this event

    # Super admins can manage any event, others must belong to the same NPO

    # Verify user has permission to manage this event
    # Super admins can manage any event, others must belong to the same NPO
    if current_user.role_name != "super_admin":
        if hasattr(current_user, "npo_id") and current_user.npo_id != event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event",
            )

    # Get table occupancy
    occupancy = await SeatingService.get_table_occupancy(db, event_id, table_number)
    guests = await SeatingService.get_guests_at_table(db, event_id, table_number)

    # Get max capacity
    max_capacity = event.max_guests_per_table or 0

    # Convert guests to GuestSeatingInfo
    from app.schemas.seating import GuestSeatingInfo

    guest_info_list = [
        GuestSeatingInfo(
            guest_id=g.id,
            name=g.name,
            email=g.email,
            bidder_number=g.bidder_number,
            table_number=g.table_number,
            registration_id=g.registration_id,
            checked_in=False,  # TODO: Add check-in status when implemented
        )
        for g in guests
    ]

    return TableOccupancyResponse(
        table_number=table_number,
        current_occupancy=occupancy,
        max_capacity=max_capacity,
        guests=guest_info_list,
        is_full=(occupancy >= max_capacity),
    )


@router.get(
    "/{event_id}/seating/guests",
    response_model=GuestSeatingListResponse,
    status_code=status.HTTP_200_OK,
)
async def get_seating_guests(
    event_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1, description="Page number"),
    per_page: int = Query(default=50, ge=1, le=200, description="Items per page"),
    table_filter: int | None = Query(
        default=None, description="Filter by table number (null for unassigned)"
    ),
) -> GuestSeatingListResponse:
    """
    Get paginated list of guests with seating information.

    Can filter by table number or show only unassigned guests.

    Requires NPO Admin or NPO Staff role.

    Args:
        event_id: Event UUID
        current_user: Authenticated user
        db: Database session
        page: Page number (default 1)
        per_page: Items per page (default 50, max 200)
        table_filter: Optional table number filter (null for unassigned only)

    Returns:
        GuestSeatingListResponse with paginated guest list

    Raises:
        HTTPException 404: Event not found
        HTTPException 403: User lacks permission to manage event
    """
    # Require NPO Admin or NPO Staff role
    if current_user.role_name not in ["super_admin", "npo_admin", "npo_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. NPO Admin or NPO Staff role required.",
        )

    # Get event
    event_query = select(Event).where(Event.id == event_id)
    event_result = await db.execute(event_query)
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found",
        )

    # Verify user has permission to manage this event
    # Super admins can manage any event, others must belong to the same NPO
    # Verify user has permission to manage this event
    # Super admins can manage any event, others must belong to the same NPO
    if current_user.role_name != "super_admin":
        if hasattr(current_user, "npo_id") and current_user.npo_id != event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event",
            )

    # Build query
    from app.models.event_registration import EventRegistration, RegistrationStatus

    base_query = (
        select(RegistrationGuest)
        .join(EventRegistration)
        .where(
            EventRegistration.event_id == event_id,
            EventRegistration.status == RegistrationStatus.CONFIRMED,
        )
    )

    # Apply table filter
    if table_filter is not None:
        if table_filter == 0:
            # 0 means unassigned
            base_query = base_query.where(RegistrationGuest.table_number.is_(None))
        else:
            base_query = base_query.where(RegistrationGuest.table_number == table_filter)

    # Get total count
    from sqlalchemy import func

    count_query = select(func.count()).select_from(base_query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar_one()

    # Get paginated results
    offset = (page - 1) * per_page
    guests_query = base_query.offset(offset).limit(per_page)
    guests_result = await db.execute(guests_query)
    guests = list(guests_result.scalars().all())

    # Convert to GuestSeatingInfo
    from app.schemas.seating import GuestSeatingInfo

    guest_info_list = [
        GuestSeatingInfo(
            guest_id=g.id,
            name=g.name,
            email=g.email,
            bidder_number=g.bidder_number,
            table_number=g.table_number,
            registration_id=g.registration_id,
            checked_in=False,  # TODO: Add check-in status when implemented
        )
        for g in guests
    ]

    has_more = (page * per_page) < total

    return GuestSeatingListResponse(
        guests=guest_info_list,
        total=total,
        page=page,
        per_page=per_page,
        has_more=has_more,
    )


@router.post(
    "/{event_id}/seating/auto-assign",
    response_model=AutoAssignResponse,
    status_code=status.HTTP_200_OK,
)
async def auto_assign_guests(
    event_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AutoAssignResponse:
    """
    Automatically assign unassigned guests to tables.

    Uses party-aware algorithm that:
    - Groups guests by registration (party)
    - Prioritizes keeping parties together
    - Fills tables sequentially for efficient packing
    - Splits large parties only when necessary

    Requires NPO Admin or NPO Staff role.

    Args:
        event_id: Event UUID
        current_user: Authenticated user
        db: Database session

    Returns:
        AutoAssignResponse with assignment results and warnings

    Raises:
        HTTPException 404: Event not found
        HTTPException 403: User lacks permission
        HTTPException 400: Seating not configured or validation error
    """
    # Require NPO Admin or NPO Staff role
    if current_user.role_name not in ["super_admin", "npo_admin", "npo_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. NPO Admin or NPO Staff role required.",
        )

    # Get event
    event_query = select(Event).where(Event.id == event_id)
    event_result = await db.execute(event_query)
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found",
        )

    # Verify user has permission to manage this event

    # Super admins can manage any event, others must belong to the same NPO

    # Verify user has permission to manage this event
    # Super admins can manage any event, others must belong to the same NPO
    if current_user.role_name != "super_admin":
        if hasattr(current_user, "npo_id") and current_user.npo_id != event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event",
            )

    # Perform auto-assignment
    try:
        result = await AutoAssignService.auto_assign_guests(db, event_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Convert assignments to response format
    from app.schemas.seating import TableAssignmentResponse

    assignment_responses = [
        TableAssignmentResponse(
            guest_id=a["guest_id"],
            table_number=a["table_number"],
            bidder_number=a["bidder_number"],
        )
        for a in result["assignments"]
    ]

    return AutoAssignResponse(
        assigned_count=result["assigned_count"],
        assignments=assignment_responses,
        unassigned_count=result["unassigned_count"],
        warnings=result["warnings"],
    )
