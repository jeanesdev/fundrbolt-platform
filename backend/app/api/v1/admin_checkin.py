"""Admin check-in API endpoints for event management."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import require_role
from app.models.role import Role
from app.schemas.registration_guest import RegistrationGuestResponse
from app.services.checkin_service import CheckInService

router = APIRouter(prefix="/admin/events/{event_id}/checkins", tags=["Admin Check-in"])


# ================================
# Request/Response Schemas
# ================================


class GuestSearchResult(BaseModel):
    """Search result for a registered guest."""

    registration_id: uuid.UUID
    donor_name: str | None
    email: str | None
    phone: str | None
    bidder_number: int | None
    table_number: int | None
    dinner_selection: str | None
    checkin_status: str
    checked_in_at: str | None
    checked_out_at: str | None

    class Config:
        from_attributes = True


class CheckinSearchResponse(BaseModel):
    """Response for guest search."""

    results: list[GuestSearchResult]


class CheckinDashboardResponse(BaseModel):
    """Response for check-in dashboard."""

    total_registered: int
    total_checked_in: int
    checked_in: list[GuestSearchResult]


class CheckinStatusResponse(BaseModel):
    """Response for check-in action."""

    registration_id: uuid.UUID
    status: str
    checked_in_at: str | None
    checked_out_at: str | None


class CheckOutRequest(BaseModel):
    """Request for checking out a guest."""

    reason: str = Field(..., min_length=1, description="Required reason for check-out")


class DonorUpdateRequest(BaseModel):
    """Request for updating donor information."""

    full_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None


class SeatingUpdateRequest(BaseModel):
    """Request for updating seating assignment."""

    bidder_number: int | None = None
    table_number: int | None = None


class DinnerSelectionUpdateRequest(BaseModel):
    """Request for updating dinner selection."""

    dinner_selection_id: uuid.UUID | None = None


class TransferRequest(BaseModel):
    """Request for transferring a ticket."""

    to_donor_id: uuid.UUID = Field(..., description="New donor user ID")
    note: str | None = None


class RegistrationCreateRequest(BaseModel):
    """Request for creating a new registration."""

    donor_full_name: str = Field(..., min_length=1)
    donor_email: EmailStr | None = None
    donor_phone: str | None = None
    ticket_id: uuid.UUID | None = None
    dinner_selection_id: uuid.UUID | None = None


# ================================
# Endpoints
# ================================


@router.get("/search", response_model=CheckinSearchResponse)
@require_role([Role.SUPER_ADMIN, Role.NPO_ADMIN, Role.NPO_STAFF])
async def search_guests(
    event_id: uuid.UUID,
    q: str = Field(..., min_length=1, description="Search query (name, phone, email)"),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> CheckinSearchResponse:
    """Search for registered guests for check-in.

    - **q**: Search term for name, phone, or email
    - Returns list of matching guests with current check-in status
    """
    guests = await CheckInService.search_guests(db, event_id, q)

    results = [
        GuestSearchResult(
            registration_id=guest.id,
            donor_name=guest.name,
            email=guest.email,
            phone=guest.phone,
            bidder_number=guest.bidder_number,
            table_number=guest.table_number,
            dinner_selection=None,  # TODO: Add dinner selection lookup
            checkin_status="checked_in" if guest.checked_in else "not_checked_in",
            checked_in_at=guest.checked_in_at.isoformat() if guest.checked_in_at else None,
            checked_out_at=guest.checked_out_at.isoformat() if guest.checked_out_at else None,
        )
        for guest in guests
    ]

    return CheckinSearchResponse(results=results)


@router.post("/{registration_id}/check-in", response_model=CheckinStatusResponse)
@require_role([Role.SUPER_ADMIN, Role.NPO_ADMIN, Role.NPO_STAFF])
async def check_in_guest(
    event_id: uuid.UUID,
    registration_id: uuid.UUID,
    current_user: Annotated[dict, Depends(require_role([Role.SUPER_ADMIN, Role.NPO_ADMIN, Role.NPO_STAFF]))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> CheckinStatusResponse:
    """Check in a guest/ticket.

    - Records check-in timestamp
    - Creates audit log entry
    - Returns 409 if already checked in
    """
    guest, error = await CheckInService.check_in_guest_with_audit(
        db, registration_id, current_user["user_id"]
    )

    if error:
        if "already checked in" in error.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error)

    return CheckinStatusResponse(
        registration_id=guest.id,
        status="checked_in",
        checked_in_at=guest.checked_in_at.isoformat() if guest.checked_in_at else None,
        checked_out_at=guest.checked_out_at.isoformat() if guest.checked_out_at else None,
    )


@router.post("/{registration_id}/check-out", response_model=CheckinStatusResponse)
@require_role([Role.SUPER_ADMIN, Role.NPO_ADMIN, Role.NPO_STAFF])
async def check_out_guest(
    event_id: uuid.UUID,
    registration_id: uuid.UUID,
    request: CheckOutRequest,
    current_user: Annotated[dict, Depends(require_role([Role.SUPER_ADMIN, Role.NPO_ADMIN, Role.NPO_STAFF]))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> CheckinStatusResponse:
    """Undo a check-in (check-out).

    - Requires a reason
    - Creates audit log entry
    - Returns 400 if reason is missing
    """
    guest, error = await CheckInService.check_out_guest_with_audit(
        db, registration_id, current_user["user_id"], request.reason
    )

    if error:
        if "reason is required" in error.lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error)

    return CheckinStatusResponse(
        registration_id=guest.id,
        status="not_checked_in",
        checked_in_at=guest.checked_in_at.isoformat() if guest.checked_in_at else None,
        checked_out_at=guest.checked_out_at.isoformat() if guest.checked_out_at else None,
    )


@router.get("/dashboard", response_model=CheckinDashboardResponse)
@require_role([Role.SUPER_ADMIN, Role.NPO_ADMIN, Role.NPO_STAFF])
async def get_checkin_dashboard(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> CheckinDashboardResponse:
    """Get check-in dashboard with totals and checked-in list.

    - Returns total registered count
    - Returns total checked-in count
    - Returns list of checked-in guests (searchable)
    """
    dashboard_data = await CheckInService.get_checkin_dashboard(db, event_id)

    checked_in_results = [
        GuestSearchResult(
            registration_id=guest.id,
            donor_name=guest.name,
            email=guest.email,
            phone=guest.phone,
            bidder_number=guest.bidder_number,
            table_number=guest.table_number,
            dinner_selection=None,  # TODO: Add dinner selection lookup
            checkin_status="checked_in",
            checked_in_at=guest.checked_in_at.isoformat() if guest.checked_in_at else None,
            checked_out_at=guest.checked_out_at.isoformat() if guest.checked_out_at else None,
        )
        for guest in dashboard_data["checked_in"]
    ]

    return CheckinDashboardResponse(
        total_registered=dashboard_data["total_registered"],
        total_checked_in=dashboard_data["total_checked_in"],
        checked_in=checked_in_results,
    )


@router.patch("/{registration_id}/donor", response_model=RegistrationGuestResponse)
@require_role([Role.SUPER_ADMIN, Role.NPO_ADMIN, Role.NPO_STAFF])
async def update_donor_info(
    event_id: uuid.UUID,
    registration_id: uuid.UUID,
    request: DonorUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> RegistrationGuestResponse:
    """Update donor contact information during check-in.

    - Updates name, email, and/or phone
    - Returns updated guest record
    """
    guest = await CheckInService.update_guest_donor_info(
        db,
        registration_id,
        full_name=request.full_name,
        email=request.email,
        phone=request.phone,
    )

    if not guest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest not found",
        )

    return RegistrationGuestResponse.model_validate(guest)


@router.patch("/{registration_id}/seating", response_model=RegistrationGuestResponse)
@require_role([Role.SUPER_ADMIN, Role.NPO_ADMIN, Role.NPO_STAFF])
async def update_seating(
    event_id: uuid.UUID,
    registration_id: uuid.UUID,
    request: SeatingUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> RegistrationGuestResponse:
    """Assign or change bidder and table numbers during check-in.

    - Enforces bidder/table number uniqueness within event
    - Returns 409 on conflict
    """
    guest, error = await CheckInService.update_guest_seating(
        db,
        event_id,
        registration_id,
        bidder_number=request.bidder_number,
        table_number=request.table_number,
    )

    if error:
        if "already assigned" in error.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error)

    return RegistrationGuestResponse.model_validate(guest)


@router.patch("/{registration_id}/dinner-selection", response_model=RegistrationGuestResponse)
@require_role([Role.SUPER_ADMIN, Role.NPO_ADMIN, Role.NPO_STAFF])
async def update_dinner_selection(
    event_id: uuid.UUID,
    registration_id: uuid.UUID,
    request: DinnerSelectionUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> RegistrationGuestResponse:
    """Set or change dinner selection during check-in.

    - Updates meal selection for the guest
    - Returns updated guest record
    """
    guest = await CheckInService.update_guest_dinner_selection(
        db,
        registration_id,
        request.dinner_selection_id,
    )

    if not guest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest not found",
        )

    return RegistrationGuestResponse.model_validate(guest)


@router.post("/{registration_id}/transfer", response_model=RegistrationGuestResponse)
@require_role([Role.SUPER_ADMIN, Role.NPO_ADMIN])
async def transfer_ticket(
    event_id: uuid.UUID,
    registration_id: uuid.UUID,
    request: TransferRequest,
    current_user: Annotated[dict, Depends(require_role([Role.SUPER_ADMIN, Role.NPO_ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> RegistrationGuestResponse:
    """Transfer a ticket to another donor during check-in.

    - Updates ownership
    - Creates audit log entry
    - No verification required per spec
    """
    guest, error = await CheckInService.transfer_ticket(
        db,
        event_id,
        registration_id,
        request.to_donor_id,
        current_user["user_id"],
        request.note,
    )

    if error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error,
        )

    return RegistrationGuestResponse.model_validate(guest)
