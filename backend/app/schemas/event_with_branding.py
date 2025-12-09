"""Pydantic schemas for Event with Branding (Donor PWA Event Homepage)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RegisteredEventWithBranding(BaseModel):
    """Event with resolved branding for donor PWA.

    Branding colors resolve with fallback chain: event → NPO → system defaults.
    """

    # Identity
    id: uuid.UUID
    name: str
    slug: str

    # Timing
    event_datetime: datetime
    timezone: str = Field(default="UTC")
    is_past: bool = Field(description="True if event datetime has passed")
    is_upcoming: bool = Field(description="True if event is within 30 days")

    # Display
    thumbnail_url: str | None = Field(
        default=None, description="Event media[0] or NPO logo as fallback"
    )

    # Branding (resolved: event → NPO → defaults)
    primary_color: str = Field(default="#3B82F6", description="Primary branding color (hex)")
    secondary_color: str = Field(default="#9333EA", description="Secondary branding color (hex)")
    background_color: str = Field(default="#FFFFFF", description="Background color (hex)")
    accent_color: str = Field(default="#3B82F6", description="Accent color (hex)")

    # NPO Info
    npo_name: str
    npo_logo_url: str | None = Field(default=None, description="NPO logo URL")

    class Config:
        from_attributes = True


class RegisteredEventsResponse(BaseModel):
    """Response containing list of events user is registered for."""

    events: list[RegisteredEventWithBranding]
