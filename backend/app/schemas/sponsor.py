"""Sponsor Pydantic schemas for request/response validation."""

import uuid
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl

from app.models.sponsor import LogoSize


class SponsorBase(BaseModel):
    """Base sponsor schema with common fields."""

    name: Annotated[str, Field(min_length=1, max_length=200)]
    website_url: HttpUrl | None = None
    logo_size: LogoSize = LogoSize.LARGE
    sponsor_level: Annotated[str, Field(max_length=100)] | None = None

    # Contact Information
    contact_name: Annotated[str, Field(max_length=200)] | None = None
    contact_email: EmailStr | None = None
    contact_phone: Annotated[str, Field(max_length=20)] | None = None

    # Address Information
    address_line1: Annotated[str, Field(max_length=200)] | None = None
    address_line2: Annotated[str, Field(max_length=200)] | None = None
    city: Annotated[str, Field(max_length=100)] | None = None
    state: Annotated[str, Field(max_length=100)] | None = None
    postal_code: Annotated[str, Field(max_length=20)] | None = None
    country: Annotated[str, Field(max_length=100)] | None = None

    # Financial Information
    donation_amount: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)] | None = None
    notes: str | None = None


class SponsorCreate(SponsorBase):
    """Schema for creating a new sponsor (includes logo file metadata)."""

    logo_file_name: Annotated[str, Field(min_length=1)]
    logo_file_type: Annotated[str, Field(min_length=1)]
    logo_file_size: Annotated[int, Field(gt=0, le=5242880)]  # Max 5MB


class SponsorUpdate(BaseModel):
    """Schema for updating a sponsor (all fields optional)."""

    name: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    website_url: HttpUrl | str | None = None  # Allow empty string for removal
    logo_size: LogoSize | None = None
    sponsor_level: Annotated[str, Field(max_length=100)] | str | None = None  # Allow empty string

    # Contact Information
    contact_name: Annotated[str, Field(max_length=200)] | str | None = None
    contact_email: EmailStr | str | None = None
    contact_phone: Annotated[str, Field(max_length=20)] | str | None = None

    # Address Information
    address_line1: Annotated[str, Field(max_length=200)] | str | None = None
    address_line2: Annotated[str, Field(max_length=200)] | str | None = None
    city: Annotated[str, Field(max_length=100)] | str | None = None
    state: Annotated[str, Field(max_length=100)] | str | None = None
    postal_code: Annotated[str, Field(max_length=20)] | str | None = None
    country: Annotated[str, Field(max_length=100)] | str | None = None

    # Financial Information
    donation_amount: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)] | None = None
    notes: str | None = None


class SponsorResponse(BaseModel):
    """Schema for sponsor response."""

    id: uuid.UUID
    event_id: uuid.UUID
    name: Annotated[str, Field(min_length=1, max_length=200)]
    logo_url: str
    logo_blob_name: str
    thumbnail_url: str
    thumbnail_blob_name: str
    website_url: str | None = None
    logo_size: LogoSize = LogoSize.LARGE
    sponsor_level: Annotated[str, Field(max_length=100)] | None = None

    # Contact Information
    contact_name: Annotated[str, Field(max_length=200)] | None = None
    contact_email: str | None = None  # Already validated as EmailStr in database
    contact_phone: Annotated[str, Field(max_length=20)] | None = None

    # Address Information
    address_line1: Annotated[str, Field(max_length=200)] | None = None
    address_line2: Annotated[str, Field(max_length=200)] | None = None
    city: Annotated[str, Field(max_length=100)] | None = None
    state: Annotated[str, Field(max_length=100)] | None = None
    postal_code: Annotated[str, Field(max_length=20)] | None = None
    country: Annotated[str, Field(max_length=100)] | None = None

    # Financial Information
    donation_amount: Decimal | None = None
    notes: str | None = None

    display_order: int
    created_at: str
    updated_at: str
    created_by: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class SponsorCreateResponse(BaseModel):
    """Schema for sponsor creation response with upload URL."""

    sponsor: SponsorResponse
    upload_url: str
    expires_at: str


class LogoUploadRequest(BaseModel):
    """Schema for logo upload URL request."""

    file_name: Annotated[str, Field(min_length=1)]
    file_type: Annotated[str, Field(min_length=1)]
    file_size: Annotated[int, Field(gt=0, le=5242880)]  # Max 5MB


class LogoUploadResponse(BaseModel):
    """Schema for logo upload URL response."""

    upload_url: str
    expires_at: str


class ReorderRequest(BaseModel):
    """Schema for reordering sponsors."""

    sponsor_ids: Annotated[list[uuid.UUID], Field(min_length=1)]
