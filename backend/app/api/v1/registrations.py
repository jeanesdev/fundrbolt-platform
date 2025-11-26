"""Event Registration API endpoints."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.event_registration import RegistrationStatus
from app.models.user import User
from app.schemas.event_registration import (
    EventRegistrationCreateRequest,
    EventRegistrationListResponse,
    EventRegistrationResponse,
    EventRegistrationUpdateRequest,
)
from app.schemas.meal_selection import (
    MealSelectionCreateRequest,
    MealSelectionListResponse,
    MealSelectionResponse,
    MealSelectionUpdateRequest,
)
from app.schemas.registration_guest import (
    RegistrationGuestCreateRequest,
    RegistrationGuestListResponse,
    RegistrationGuestResponse,
    RegistrationGuestUpdateRequest,
)
from app.services.event_registration_service import EventRegistrationService
from app.services.guest_service import GuestService
from app.services.meal_selection_service import MealSelectionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/registrations", tags=["registrations"])


# ================================
# Event Registration Endpoints
# ================================


@router.post("", response_model=EventRegistrationResponse, status_code=status.HTTP_201_CREATED)
async def create_registration(
    registration_data: EventRegistrationCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventRegistrationResponse:
    """
    Register current user for an event.

    Creates a new event registration for the authenticated user.
    """
    registration = await EventRegistrationService.create_registration(
        db, registration_data, current_user
    )
    return EventRegistrationResponse.model_validate(registration, from_attributes=True)


@router.get("", response_model=EventRegistrationListResponse)
async def list_user_registrations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    status_filter: RegistrationStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 10,
) -> EventRegistrationListResponse:
    """
    Get all registrations for the current user.

    Returns paginated list of user's event registrations.
    """
    registrations, total = await EventRegistrationService.get_user_registrations(
        db, current_user.id, status_filter, page, per_page
    )

    total_pages = (total + per_page - 1) // per_page

    return EventRegistrationListResponse(
        registrations=[
            EventRegistrationResponse.model_validate(reg, from_attributes=True)
            for reg in registrations
        ],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/{registration_id}", response_model=EventRegistrationResponse)
async def get_registration(
    registration_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventRegistrationResponse:
    """Get registration details by ID."""
    registration = await EventRegistrationService.get_registration_by_id(db, registration_id)

    if not registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Registration with ID {registration_id} not found",
        )

    # Verify ownership
    if registration.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own registrations",
        )

    return EventRegistrationResponse.model_validate(registration, from_attributes=True)


@router.patch("/{registration_id}", response_model=EventRegistrationResponse)
async def update_registration(
    registration_id: uuid.UUID,
    registration_data: EventRegistrationUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventRegistrationResponse:
    """Update an existing registration."""
    registration = await EventRegistrationService.update_registration(
        db, registration_id, registration_data, current_user
    )
    return EventRegistrationResponse.model_validate(registration, from_attributes=True)


@router.delete("/{registration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_registration(
    registration_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> None:
    """Cancel a registration (soft delete)."""
    await EventRegistrationService.cancel_registration(db, registration_id, current_user)


# ================================
# Guest Management Endpoints
# ================================


@router.post(
    "/{registration_id}/guests",
    response_model=RegistrationGuestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_guest(
    registration_id: uuid.UUID,
    guest_data: RegistrationGuestCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> RegistrationGuestResponse:
    """Add a guest to a registration."""
    # Override registration_id from path parameter
    guest_data.registration_id = registration_id

    guest = await GuestService.add_guest(db, guest_data, current_user)
    return RegistrationGuestResponse.model_validate(guest, from_attributes=True)


@router.get("/{registration_id}/guests", response_model=RegistrationGuestListResponse)
async def list_guests(
    registration_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> RegistrationGuestListResponse:
    """Get all guests for a registration."""
    guests = await GuestService.get_registration_guests(db, registration_id)

    return RegistrationGuestListResponse(
        guests=[RegistrationGuestResponse.model_validate(g, from_attributes=True) for g in guests],
        total=len(guests),
    )


@router.patch("/{registration_id}/guests/{guest_id}", response_model=RegistrationGuestResponse)
async def update_guest(
    registration_id: uuid.UUID,
    guest_id: uuid.UUID,
    guest_data: RegistrationGuestUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> RegistrationGuestResponse:
    """Update guest information."""
    guest = await GuestService.update_guest(db, guest_id, guest_data, current_user)
    return RegistrationGuestResponse.model_validate(guest, from_attributes=True)


@router.delete("/{registration_id}/guests/{guest_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_guest(
    registration_id: uuid.UUID,
    guest_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> None:
    """Remove a guest from a registration."""
    await GuestService.remove_guest(db, guest_id, current_user)


# ================================
# Meal Selection Endpoints
# ================================


@router.post(
    "/{registration_id}/meal-selections",
    response_model=MealSelectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_meal_selection(
    registration_id: uuid.UUID,
    meal_data: MealSelectionCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MealSelectionResponse:
    """Create a meal selection for an attendee."""
    # Override registration_id from path parameter
    meal_data.registration_id = registration_id

    meal_selection = await MealSelectionService.create_meal_selection(db, meal_data, current_user)
    return MealSelectionResponse.model_validate(meal_selection, from_attributes=True)


@router.get("/{registration_id}/meal-selections", response_model=MealSelectionListResponse)
async def list_meal_selections(
    registration_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MealSelectionListResponse:
    """Get all meal selections for a registration."""
    meal_selections = await MealSelectionService.get_registration_meal_selections(
        db, registration_id
    )

    return MealSelectionListResponse(
        meal_selections=[
            MealSelectionResponse.model_validate(ms, from_attributes=True) for ms in meal_selections
        ],
        total=len(meal_selections),
    )


@router.patch("/meal-selections/{meal_selection_id}", response_model=MealSelectionResponse)
async def update_meal_selection(
    meal_selection_id: uuid.UUID,
    meal_data: MealSelectionUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MealSelectionResponse:
    """Update a meal selection."""
    meal_selection = await MealSelectionService.update_meal_selection(
        db, meal_selection_id, meal_data, current_user
    )
    return MealSelectionResponse.model_validate(meal_selection, from_attributes=True)
