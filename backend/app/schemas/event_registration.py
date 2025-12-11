"""Pydantic schemas for Event Registration management."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.event_registration import RegistrationStatus

# ================================
# Request Schemas
# ================================


class EventRegistrationCreateRequest(BaseModel):
    """Request schema for creating a new event registration."""

    event_id: uuid.UUID = Field(..., description="ID of the event to register for")
    number_of_guests: int = Field(
        default=1,
        ge=1,
        description="Number of guests (including registrant)",
    )
    ticket_type: str | None = Field(
        default=None,
        max_length=100,
        description="Type of ticket (future use: VIP, General, etc.)",
    )


class EventRegistrationUpdateRequest(BaseModel):
    """Request schema for updating an event registration."""

    number_of_guests: int | None = Field(
        default=None,
        ge=1,
        description="Updated number of guests",
    )
    ticket_type: str | None = Field(
        default=None,
        max_length=100,
        description="Updated ticket type",
    )
    status: RegistrationStatus | None = Field(
        default=None,
        description="Updated registration status",
    )


# ================================
# Response Schemas
# ================================


class EventRegistrationResponse(BaseModel):
    """Response schema for event registration details."""

    id: uuid.UUID
    user_id: uuid.UUID
    event_id: uuid.UUID
    status: RegistrationStatus
    ticket_type: str | None
    number_of_guests: int
    check_in_time: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EventRegistrationListResponse(BaseModel):
    """Response schema for paginated list of event registrations."""

    registrations: list[EventRegistrationResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


# ================================
# Internal Schemas
# ================================


class EventRegistrationWithDetails(EventRegistrationResponse):
    """Event registration with full related data (user, event, guests, meals)."""

    # Will be extended with related data in service layer
    pass
