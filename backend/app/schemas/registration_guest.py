"""Pydantic schemas for Registration Guest management."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

# ================================
# Request Schemas
# ================================


class RegistrationGuestCreateRequest(BaseModel):
    """Request schema for adding a guest to an event registration."""

    registration_id: uuid.UUID = Field(..., description="ID of the parent registration")
    name: str | None = Field(
        default=None,
        max_length=255,
        description="Guest's full name",
    )
    email: EmailStr | None = Field(
        default=None,
        description="Guest's email address",
    )
    phone: str | None = Field(
        default=None,
        max_length=20,
        description="Guest's phone number",
    )


class RegistrationGuestUpdateRequest(BaseModel):
    """Request schema for updating a guest's information."""

    name: str | None = Field(
        default=None,
        max_length=255,
        description="Updated guest name",
    )
    email: EmailStr | None = Field(
        default=None,
        description="Updated guest email",
    )
    phone: str | None = Field(
        default=None,
        max_length=20,
        description="Updated guest phone",
    )


# ================================
# Response Schemas
# ================================


class RegistrationGuestResponse(BaseModel):
    """Response schema for registration guest details."""

    id: uuid.UUID
    registration_id: uuid.UUID
    user_id: uuid.UUID | None
    name: str | None
    email: str | None
    phone: str | None
    invited_by_admin: bool
    invitation_sent_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RegistrationGuestListResponse(BaseModel):
    """Response schema for list of registration guests."""

    guests: list[RegistrationGuestResponse]
    total: int
