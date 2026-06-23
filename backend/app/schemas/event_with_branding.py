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
    page_background_style: str = Field(default="solid", description="Donor page background style")
    page_background_image_url: str | None = Field(
        default=None, description="Optional image URL used for donor page background"
    )
    page_background_gradient_start_color: str | None = Field(
        default=None, description="Optional first color stop for donor page gradient backgrounds"
    )
    page_background_gradient_end_color: str | None = Field(
        default=None, description="Optional second color stop for donor page gradient backgrounds"
    )
    action_card_background_style: str = Field(
        default="gradient", description="Donor action card background style"
    )
    action_card_background_image_url: str | None = Field(
        default=None, description="Optional image URL used for donor action card backgrounds"
    )
    action_card_gradient_start_color: str | None = Field(
        default=None, description="Optional first color stop for donor action card gradients"
    )
    action_card_gradient_end_color: str | None = Field(
        default=None, description="Optional second color stop for donor action card gradients"
    )
    action_card_background_opacity: float = Field(
        default=1.0, description="Opacity for donor action card backgrounds"
    )
    cause_section_border_color: str | None = Field(
        default=None,
        description="Optional border color for built-in donor cause section cards",
    )
    cause_section_border_width: int | None = Field(
        default=None,
        description="Optional border width in px for built-in donor cause section cards",
    )

    # NPO Info
    npo_name: str
    npo_logo_url: str | None = Field(default=None, description="NPO logo URL")

    class Config:
        from_attributes = True


class RegisteredEventsResponse(BaseModel):
    """Response containing list of events user is registered for."""

    events: list[RegisteredEventWithBranding]
