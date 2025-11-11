"""Pydantic schemas for Event management."""

import re
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.models.event import EventLinkType, EventMediaStatus, EventStatus

# ================================
# Request Schemas
# ================================


class EventCreateRequest(BaseModel):
    """Request schema for creating a new event."""

    npo_id: uuid.UUID = Field(..., description="ID of the NPO hosting this event")
    name: str = Field(..., min_length=1, max_length=255)
    custom_slug: str | None = Field(
        default=None,
        max_length=255,
        description="Optional custom URL slug (auto-generated if not provided)",
    )
    event_datetime: datetime = Field(..., description="Event date and time")
    timezone: str = Field(..., max_length=50, description="IANA timezone name")
    venue_name: str | None = Field(default=None, max_length=255)
    venue_address: str | None = Field(default=None)
    description: str | None = Field(default=None, description="Rich text description (Markdown)")
    primary_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    secondary_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        """Ensure name is not just whitespace."""
        if not v.strip():
            raise ValueError("Event name cannot be empty or whitespace")
        return v.strip()

    @field_validator("custom_slug")
    @classmethod
    def validate_custom_slug(cls, v: str | None) -> str | None:
        """Validate custom slug format."""
        if v is None:
            return None
        # Must be lowercase alphanumeric with hyphens
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError(
                "Custom slug must contain only lowercase letters, numbers, and hyphens"
            )
        return v

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        """Validate IANA timezone name."""
        # Basic validation - full validation happens in service layer with pytz
        if not v or "/" not in v:
            raise ValueError("Timezone must be a valid IANA timezone name (e.g., America/Chicago)")
        return v


class EventUpdateRequest(BaseModel):
    """Request schema for updating event details."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    custom_slug: str | None = Field(default=None, max_length=255)
    event_datetime: datetime | None = Field(default=None)
    timezone: str | None = Field(default=None, max_length=50)
    venue_name: str | None = Field(default=None, max_length=255)
    venue_address: str | None = Field(default=None)
    description: str | None = Field(default=None)
    logo_url: str | None = Field(default=None, max_length=500)
    primary_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    secondary_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    version: int | None = Field(default=None, description="Current version for optimistic locking")

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str | None) -> str | None:
        """Ensure name is not just whitespace."""
        if v is not None and not v.strip():
            raise ValueError("Event name cannot be empty or whitespace")
        return v.strip() if v else None

    @field_validator("custom_slug")
    @classmethod
    def validate_custom_slug(cls, v: str | None) -> str | None:
        """Validate custom slug format."""
        if v is None:
            return None
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError(
                "Custom slug must contain only lowercase letters, numbers, and hyphens"
            )
        return v


# ================================
# Media Schemas
# ================================


class MediaUploadUrlRequest(BaseModel):
    """Request schema for requesting a pre-signed upload URL."""

    file_name: str = Field(..., max_length=255)
    file_type: str = Field(
        ...,
        description="MIME type (image/png, image/jpeg, image/svg+xml, application/pdf)",
    )
    file_size: int = Field(..., ge=1, le=10485760, description="File size in bytes (max 10MB)")

    @field_validator("file_type")
    @classmethod
    def validate_file_type(cls, v: str) -> str:
        """Validate allowed file types."""
        allowed_types = ["image/png", "image/jpeg", "image/svg+xml", "application/pdf"]
        if v not in allowed_types:
            raise ValueError(f"File type must be one of: {', '.join(allowed_types)}")
        return v


class MediaUpdateRequest(BaseModel):
    """Request schema for updating media metadata."""

    display_order: int | None = Field(default=None, ge=0)


# ================================
# Link Schemas
# ================================


class EventLinkCreateRequest(BaseModel):
    """Request schema for adding an external link."""

    link_type: EventLinkType = Field(...)
    url: HttpUrl = Field(...)
    label: str | None = Field(default=None, max_length=255)
    platform: str | None = Field(default=None, max_length=50)
    display_order: int = Field(default=0, ge=0)

    @field_validator("url")
    @classmethod
    def convert_url_to_string(cls, v: HttpUrl) -> str:
        """Convert HttpUrl to string for database storage."""
        return str(v)

    @field_validator("url")
    @classmethod
    def validate_video_url(cls, v: str, info: Any) -> str:
        """Validate video URLs are YouTube or Vimeo."""
        if info.data.get("link_type") == EventLinkType.VIDEO:
            youtube_pattern = r"(youtube\.com|youtu\.be)"
            vimeo_pattern = r"vimeo\.com"
            if not (re.search(youtube_pattern, v) or re.search(vimeo_pattern, v)):
                raise ValueError("Video links must be YouTube or Vimeo URLs")
        return v


class EventLinkUpdateRequest(BaseModel):
    """Request schema for updating link metadata."""

    label: str | None = Field(default=None, max_length=255)
    display_order: int | None = Field(default=None, ge=0)


# ================================
# Food Option Schemas
# ================================


class FoodOptionCreateRequest(BaseModel):
    """Request schema for adding a food option."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None)
    display_order: int = Field(default=0, ge=0)

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        """Ensure name is not just whitespace."""
        if not v.strip():
            raise ValueError("Food option name cannot be empty or whitespace")
        return v.strip()


class FoodOptionUpdateRequest(BaseModel):
    """Request schema for updating a food option."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None)
    display_order: int | None = Field(default=None, ge=0)

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str | None) -> str | None:
        """Ensure name is not just whitespace."""
        if v is not None and not v.strip():
            raise ValueError("Food option name cannot be empty or whitespace")
        return v.strip() if v else None


# ================================
# Response Schemas
# ================================


class EventMediaResponse(BaseModel):
    """Response schema for event media."""

    id: uuid.UUID
    event_id: uuid.UUID
    file_url: str
    file_name: str
    file_type: str
    file_size: int
    display_order: int
    status: EventMediaStatus
    uploaded_at: datetime
    uploaded_by: uuid.UUID

    class Config:
        from_attributes = True


class EventLinkResponse(BaseModel):
    """Response schema for event links."""

    id: uuid.UUID
    event_id: uuid.UUID
    link_type: EventLinkType
    url: str
    label: str | None
    platform: str | None
    display_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class FoodOptionResponse(BaseModel):
    """Response schema for food options."""

    id: uuid.UUID
    event_id: uuid.UUID
    name: str
    description: str | None
    display_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class EventSummaryResponse(BaseModel):
    """Summary response for event listings."""

    id: uuid.UUID
    npo_id: uuid.UUID
    npo_name: str | None
    name: str
    slug: str
    status: EventStatus
    event_datetime: datetime
    timezone: str
    venue_name: str | None
    logo_url: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EventDetailResponse(BaseModel):
    """Detailed response with all event information."""

    id: uuid.UUID
    npo_id: uuid.UUID
    name: str
    slug: str
    status: EventStatus
    event_datetime: datetime
    timezone: str
    venue_name: str | None
    venue_address: str | None
    description: str | None
    logo_url: str | None
    primary_color: str | None
    secondary_color: str | None
    version: int
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID
    updated_by: uuid.UUID
    media: list[EventMediaResponse]
    links: list[EventLinkResponse]
    food_options: list[FoodOptionResponse]

    class Config:
        from_attributes = True


class EventPublicResponse(BaseModel):
    """Public event response (no internal fields)."""

    id: uuid.UUID
    name: str
    slug: str
    event_datetime: datetime
    timezone: str
    venue_name: str | None
    venue_address: str | None
    description: str | None
    logo_url: str | None
    primary_color: str | None
    secondary_color: str | None
    media: list[EventMediaResponse]
    links: list[EventLinkResponse]
    food_options: list[FoodOptionResponse]

    class Config:
        from_attributes = True


class MediaUploadUrlResponse(BaseModel):
    """Response for pre-signed upload URL request."""

    upload_url: str = Field(..., description="Pre-signed URL for file upload (15-minute expiry)")
    media_id: uuid.UUID = Field(..., description="ID of the EventMedia record created")
    expires_at: datetime = Field(..., description="Upload URL expiration timestamp")


class EventListResponse(BaseModel):
    """Paginated event list response."""

    items: list[EventSummaryResponse]
    total: int
    page: int
    per_page: int
    total_pages: int
