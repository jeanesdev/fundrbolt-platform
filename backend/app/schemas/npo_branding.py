"""Pydantic schemas for NPO branding and visual identity."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

# ================================
# Request Schemas
# ================================


class BrandingCreateRequest(BaseModel):
    """Request schema for creating NPO branding."""

    primary_color: str | None = Field(
        None, pattern="^#[0-9A-Fa-f]{6}$", description="Hex color code (e.g., #FF5733)"
    )
    secondary_color: str | None = Field(
        None, pattern="^#[0-9A-Fa-f]{6}$", description="Hex color code (e.g., #33FF57)"
    )
    background_color: str | None = Field(
        "#FFFFFF", pattern="^#[0-9A-Fa-f]{6}$", description="Background hex color (default white)"
    )
    accent_color: str | None = Field(
        None, pattern="^#[0-9A-Fa-f]{6}$", description="Accent/highlight hex color"
    )
    logo_url: str | None = Field(
        None, max_length=500, description="Azure Blob Storage URL for logo"
    )
    social_media_links: dict[str, str] | None = Field(
        None,
        description="Social media links JSON: {facebook, twitter, instagram, linkedin}",
    )
    custom_css_properties: dict[str, str] | None = Field(
        None,
        description="Custom CSS properties JSON for theme customization",
    )

    @field_validator("primary_color", "secondary_color", "background_color", "accent_color")
    @classmethod
    def validate_hex_color(cls, v: str | None) -> str | None:
        """Validate hex color format."""
        if v is None:
            return None
        if not v.startswith("#"):
            raise ValueError("Color must start with #")
        if len(v) != 7:
            raise ValueError("Color must be in format #RRGGBB")
        try:
            int(v[1:], 16)
        except ValueError:
            raise ValueError("Invalid hex color code")
        return v.upper()


class BrandingUpdateRequest(BaseModel):
    """Request schema for updating NPO branding."""

    primary_color: str | None = Field(
        None, pattern="^#[0-9A-Fa-f]{6}$", description="Hex color code"
    )
    secondary_color: str | None = Field(
        None, pattern="^#[0-9A-Fa-f]{6}$", description="Hex color code"
    )
    background_color: str | None = Field(
        None, pattern="^#[0-9A-Fa-f]{6}$", description="Background hex color"
    )
    accent_color: str | None = Field(
        None, pattern="^#[0-9A-Fa-f]{6}$", description="Accent/highlight hex color"
    )
    logo_url: str | None = Field(
        None, max_length=500, description="Azure Blob Storage URL for logo"
    )
    social_media_links: dict[str, str] | None = None
    custom_css_properties: dict[str, str] | None = None

    @field_validator("primary_color", "secondary_color", "background_color", "accent_color")
    @classmethod
    def validate_hex_color(cls, v: str | None) -> str | None:
        """Validate hex color format."""
        if v is None:
            return None
        if not v.startswith("#"):
            raise ValueError("Color must start with #")
        if len(v) != 7:
            raise ValueError("Color must be in format #RRGGBB")
        try:
            int(v[1:], 16)
        except ValueError:
            raise ValueError("Invalid hex color code")
        return v.upper()


class LogoUploadRequest(BaseModel):
    """Request schema for logo upload metadata."""

    file_name: str = Field(max_length=255)
    file_size: int = Field(gt=0, le=5_000_000, description="File size in bytes (max 5MB)")
    content_type: str = Field(
        pattern="^image/(jpeg|jpg|png|gif|webp)$",
        description="MIME type (image/jpeg, image/png, etc.)",
    )

    @field_validator("file_name")
    @classmethod
    def validate_file_extension(cls, v: str) -> str:
        """Validate file extension."""
        allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
        if not any(v.lower().endswith(ext) for ext in allowed_extensions):
            raise ValueError(f"Invalid file extension. Allowed: {', '.join(allowed_extensions)}")
        return v


# ================================
# Response Schemas
# ================================


class BrandingResponse(BaseModel):
    """Response schema for NPO branding details."""

    id: uuid.UUID
    npo_id: uuid.UUID
    primary_color: str | None
    secondary_color: str | None
    background_color: str | None
    accent_color: str | None
    logo_url: str | None
    social_media_links: dict[str, str] | None
    custom_css_properties: dict[str, str] | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BrandingDetailResponse(BrandingResponse):
    """Detailed response schema for branding with NPO info."""

    npo_name: str | None = None


class LogoUploadResponse(BaseModel):
    """Response schema after requesting logo upload."""

    upload_url: str = Field(description="Pre-signed Azure Blob Storage SAS URL")
    logo_url: str = Field(description="Final public URL for the uploaded logo")
    expires_in: int = Field(description="Upload URL expiration time in seconds")
    message: str = "Upload URL generated. Use PUT request to upload file."


class BrandingCreateResponse(BaseModel):
    """Response schema after creating branding."""

    branding: BrandingResponse
    message: str = "Branding created successfully"


class BrandingUpdateResponse(BaseModel):
    """Response schema after updating branding."""

    branding: BrandingResponse
    message: str = "Branding updated successfully"
