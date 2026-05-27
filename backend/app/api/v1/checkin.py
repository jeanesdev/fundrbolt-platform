"""Check-in API endpoints for event registration check-in operations."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.event_registration import EventRegistrationResponse
from app.schemas.registration_guest import RegistrationGuestResponse
from app.services.bidder_number_service import BidderNumberService
from app.services.checkin_service import CheckInService

router = APIRouter(prefix="/checkin", tags=["Check-in"])


# ================================
# Request/Response Schemas
# ================================


class RegistrationWithGuestsResponse(BaseModel):
    """Extended registration response with guests and meals."""

    id: uuid.UUID
    user_id: uuid.UUID
    event_id: uuid.UUID
    ticket_purchase_id: uuid.UUID | None
    status: str
    number_of_guests: int
    check_in_time: str | None
    created_at: str
    updated_at: str
    guests: list[RegistrationGuestResponse] = []

    class Config:
        from_attributes = True


class CheckInLookupRequest(BaseModel):
    """Request schema for looking up a registration."""

    confirmation_code: str | None = Field(
        default=None,
        description="Registration confirmation code (registration ID)",
    )
    email: EmailStr | None = Field(
        default=None,
        description="Email address to lookup registrations",
    )
    event_id: uuid.UUID | None = Field(
        default=None,
        description="Optional event ID to filter email lookups",
    )


class CheckInLookupResponse(BaseModel):
    """Response schema for registration lookup."""

    registrations: list[RegistrationWithGuestsResponse]
    total: int


class CheckInResponse(BaseModel):
    """Response schema for check-in operation."""

    success: bool
    message: str
    registration: EventRegistrationResponse | None = None
    guest: RegistrationGuestResponse | None = None


class CheckInWithAssignmentRequest(BaseModel):
    """Optional request body for check-in with bidder/table assignment."""

    bidder_number: int | None = Field(
        default=None,
        ge=100,
        le=999,
        description="Bidder number to assign (100-999). Auto-assigned if not provided.",
    )
    table_number: int | None = Field(
        default=None,
        ge=1,
        description="Table number to assign. Auto-assigned if not provided.",
    )


class NextAssignmentResponse(BaseModel):
    """Response schema for next available bidder/table assignment preview."""

    next_bidder_number: int
    next_table_number: int | None


# ================================
# Endpoints
# ================================


@router.post("/lookup", response_model=CheckInLookupResponse)
async def lookup_registration(
    request: CheckInLookupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CheckInLookupResponse:
    """Lookup registration by confirmation code or email.

    - **confirmation_code**: Registration ID as string
    - **email**: Email address to search
    - **event_id**: Optional event filter for email search

    Returns list of matching registrations.
    """
    registrations = []

    if request.confirmation_code:
        # Lookup by confirmation code (registration ID)
        registration = await CheckInService.get_registration_by_confirmation(
            db, request.confirmation_code
        )
        if registration:
            registrations = [registration]
    elif request.email:
        # Lookup by email
        registrations = await CheckInService.get_registration_by_email(
            db, request.email, request.event_id
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either confirmation_code or email must be provided",
        )

    return CheckInLookupResponse(
        registrations=[RegistrationWithGuestsResponse.model_validate(reg) for reg in registrations],
        total=len(registrations),
    )


@router.get("/events/{event_id}/next-assignment", response_model=NextAssignmentResponse)
async def get_next_assignment(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> NextAssignmentResponse:
    """Get the next available bidder number and table number for an event.

    Used to pre-populate the check-in assignment dialog.
    """
    next_bidder = await BidderNumberService.get_next_available_bidder_number(db, event_id)
    next_table = await CheckInService.get_next_available_table(db, event_id)
    return NextAssignmentResponse(
        next_bidder_number=next_bidder,
        next_table_number=next_table,
    )


@router.post("/registrations/{registration_id}", response_model=CheckInResponse)
async def check_in_registration(
    registration_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    request: CheckInWithAssignmentRequest | None = None,
) -> CheckInResponse:
    """Mark a registration as checked in.

    Assigns bidder number and table number if not already assigned.
    Accepts optional body to specify bidder/table; auto-assigns if not provided.
    """
    registration = await CheckInService.check_in_registration(
        db,
        registration_id,
        bidder_number=request.bidder_number if request else None,
        table_number=request.table_number if request else None,
    )

    if not registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration not found",
        )

    return CheckInResponse(
        success=True,
        message="Successfully checked in",
        registration=EventRegistrationResponse.model_validate(registration),
    )


@router.post("/guests/{guest_id}", response_model=CheckInResponse)
async def check_in_guest(
    guest_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    request: CheckInWithAssignmentRequest | None = None,
) -> CheckInResponse:
    """Mark a guest as checked in.

    Assigns bidder number and table number if not already assigned.
    Accepts optional body to specify bidder/table; auto-assigns if not provided.
    """
    guest = await CheckInService.check_in_guest(
        db,
        guest_id,
        bidder_number=request.bidder_number if request else None,
        table_number=request.table_number if request else None,
    )

    if not guest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest not found",
        )

    return CheckInResponse(
        success=True,
        message="Guest successfully checked in",
        guest=RegistrationGuestResponse.model_validate(guest),
    )


@router.delete("/registrations/{registration_id}", response_model=CheckInResponse)
async def undo_check_in_registration(
    registration_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CheckInResponse:
    """Undo check-in for a registration.

    Clears check_in_time.
    Useful for correcting mistakes.
    """
    registration = await CheckInService.undo_check_in_registration(db, registration_id)

    if not registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration not found",
        )

    return CheckInResponse(
        success=True,
        message="Check-in undone",
        registration=EventRegistrationResponse.model_validate(registration),
    )


@router.delete("/guests/{guest_id}", response_model=CheckInResponse)
async def undo_check_in_guest(
    guest_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CheckInResponse:
    """Undo check-in for a guest.

    Sets checked_in flag to false.
    Useful for correcting mistakes.
    """
    guest = await CheckInService.undo_check_in_guest(db, guest_id)

    if not guest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest not found",
        )

    return CheckInResponse(
        success=True,
        message="Guest check-in undone",
        guest=RegistrationGuestResponse.model_validate(guest),
    )
