"""Pydantic schemas for NPO (Non-Profit Organization) management."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, HttpUrl, field_validator

from app.models.npo import NPOStatus
from app.schemas.npo_branding import BrandingResponse

# ================================
# Request Schemas
# ================================


class NPOCreateRequest(BaseModel):
    """Request schema for creating a new NPO (draft or application)."""

    name: str = Field(..., min_length=2, max_length=255)
    tagline: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    mission_statement: str | None = Field(default=None, max_length=5000)
    tax_id: str | None = Field(default=None, max_length=50)
    website_url: HttpUrl | None = Field(default=None)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr = Field(...)
    address: dict[str, str] | None = Field(
        default=None,
        description="Address JSON: {street, street2, city, state, postal_code, country}",
    )
    registration_number: str | None = Field(default=None, max_length=100)

    @field_validator("website_url")
    @classmethod
    def convert_url_to_string(cls, v: HttpUrl | None) -> str | None:
        """Convert HttpUrl to string for database storage."""
        return str(v) if v else None

    @field_validator("email")
    @classmethod
    def email_must_be_lowercase(cls, v: str) -> str:
        """Ensure email is lowercase."""
        return v.lower()

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        """Ensure name is not just whitespace."""
        if not v.strip():
            raise ValueError("NPO name cannot be empty or whitespace")
        return v.strip()


class NPOUpdateRequest(BaseModel):
    """Request schema for updating NPO details."""

    name: str | None = Field(default=None, min_length=2, max_length=255)
    tagline: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    mission_statement: str | None = Field(default=None, max_length=5000)
    tax_id: str | None = Field(default=None, max_length=50)
    website_url: HttpUrl | None = Field(default=None)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = Field(default=None)
    address: dict[str, str] | None = Field(default=None)
    registration_number: str | None = Field(default=None, max_length=100)

    @field_validator("website_url")
    @classmethod
    def convert_url_to_string(cls, v: HttpUrl | None) -> str | None:
        """Convert HttpUrl to string for database storage."""
        return str(v) if v else None

    @field_validator("email")
    @classmethod
    def email_must_be_lowercase(cls, v: str | None) -> str | None:
        """Ensure email is lowercase."""
        return v.lower() if v else None

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str | None) -> str | None:
        """Ensure name is not just whitespace."""
        if v is not None and not v.strip():
            raise ValueError("NPO name cannot be empty or whitespace")
        return v.strip() if v else None


class NPOStatusUpdateRequest(BaseModel):
    """Request schema for updating NPO status (admin only)."""

    status: NPOStatus
    notes: str | None = Field(None, max_length=5000, description="Admin notes for status change")


class NPOListRequest(BaseModel):
    """Request schema for listing NPOs with filters."""

    status: NPOStatus | None = Field(default=None)
    search: str | None = Field(default=None, max_length=255, description="Search by name or email")
    created_by_user_id: uuid.UUID | None = Field(default=None)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


# ================================
# Response Schemas
# ================================


class NPOResponse(BaseModel):
    """Response schema for NPO details."""

    id: uuid.UUID
    name: str
    tagline: str | None
    description: str | None
    mission_statement: str | None
    tax_id: str | None
    website_url: str | None
    phone: str | None
    email: str
    address: dict[str, str] | None
    registration_number: str | None
    status: NPOStatus
    created_by_user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    # Related data counts (optional, for list views)
    member_count: int | None = None
    active_member_count: int | None = None

    # Branding info (optional, for selectors/list views)
    logo_url: str | None = None

    model_config = {"from_attributes": True}


class NPODetailResponse(NPOResponse):
    """Detailed response schema for NPO with related entities."""

    # Include branding info
    branding: BrandingResponse | None = Field(None, description="NPO branding information")
    # Include application info (if exists)
    application: dict[str, str] | None = Field(None, description="NPO application details")


class NPOListResponse(BaseModel):
    """Response schema for paginated NPO list."""

    items: list[NPOResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class NPOCreateResponse(BaseModel):
    """Response schema after creating NPO."""

    npo: NPOResponse
    message: str = "NPO created successfully"
