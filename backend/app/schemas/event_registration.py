"""Pydantic schemas for Event Registration management."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.event_registration import RegistrationStatus

# ================================
# Cancel Request Schema
# ================================


class EventRegistrationCancelRequest(BaseModel):
    """Request schema for cancelling a registration with reason/note."""

    cancellation_reason: Literal["duplicate", "requested", "payment_issue", "other"] = Field(
        ..., description="Reason for cancellation"
    )
    cancellation_note: str | None = Field(
        default=None, max_length=255, description="Optional cancellation note"
    )


# ================================
# Request Schemas
# ================================


class EventRegistrationCreateRequest(BaseModel):
    """Request schema for creating a new event registration."""

    event_id: uuid.UUID = Field(..., description="ID of the event to register for")
    ticket_purchase_id: uuid.UUID | None = Field(
        default=None,
        description="Linked ticket purchase ID (optional)",
    )
    number_of_guests: int = Field(
        default=1,
        ge=1,
        description="Number of guests (including registrant)",
    )


class EventRegistrationUpdateRequest(BaseModel):
    """Request schema for updating an event registration."""

    ticket_purchase_id: uuid.UUID | None = Field(
        default=None,
        description="Linked ticket purchase ID (optional)",
    )
    number_of_guests: int | None = Field(
        default=None,
        ge=1,
        description="Updated number of guests",
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
    ticket_purchase_id: uuid.UUID | None
    status: RegistrationStatus
    number_of_guests: int
    check_in_time: datetime | None
    created_at: datetime
    updated_at: datetime

    cancellation_reason: str | None
    cancellation_note: str | None

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
