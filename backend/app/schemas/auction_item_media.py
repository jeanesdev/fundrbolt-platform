"""Pydantic schemas for auction item media."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class MediaUploadRequest(BaseModel):
    """Request schema for generating media upload URL."""

    file_name: str = Field(..., min_length=1, max_length=255, description="Original file name")
    content_type: str = Field(..., description="MIME type (e.g., image/jpeg, video/mp4)")
    file_size: int = Field(..., gt=0, description="File size in bytes")
    media_type: str = Field(
        ..., pattern="^(image|video)$", description="Media type: image or video"
    )

    model_config = {"from_attributes": True}


class MediaUploadResponse(BaseModel):
    """Response schema for media upload URL generation."""

    upload_url: str = Field(..., description="Pre-signed SAS URL for uploading file")
    media_url: str = Field(..., description="Final public URL of the media")
    blob_name: str = Field(..., description="Blob name in Azure Storage")
    expires_in: int = Field(..., description="SAS URL expiration time in seconds")

    model_config = {"from_attributes": True}


class MediaUploadConfirmRequest(BaseModel):
    """Request schema for confirming media upload."""

    blob_name: str = Field(..., description="Blob name returned from upload URL generation")
    file_name: str = Field(..., min_length=1, max_length=255, description="Original file name")
    file_size: int = Field(..., gt=0, description="File size in bytes")
    content_type: str = Field(..., description="MIME type")
    media_type: str = Field(
        ..., pattern="^(image|video)$", description="Media type: image or video"
    )
    video_url: str | None = Field(
        None,
        description="Optional YouTube/Vimeo URL for video embeds",
    )

    model_config = {"from_attributes": True}


class MediaResponse(BaseModel):
    """Response schema for auction item media."""

    id: UUID
    auction_item_id: UUID
    media_type: str = Field(..., description="Media type: image or video")
    file_path: str = Field(..., description="Public URL of the media file")
    file_name: str = Field(..., description="Original file name")
    file_size: int = Field(..., description="File size in bytes")
    mime_type: str = Field(..., description="MIME type")
    display_order: int = Field(..., description="Display order for sorting")
    thumbnail_path: str | None = Field(None, description="Thumbnail URL (for images)")
    video_url: str | None = Field(None, description="YouTube/Vimeo URL for video embeds")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MediaReorderRequest(BaseModel):
    """Schema for reordering media items."""

    media_order: list[UUID] = Field(..., min_length=1, description="Ordered list of media IDs")

    @field_validator("media_order")
    @classmethod
    def validate_unique_ids(cls, v: list[UUID]) -> list[UUID]:
        """Ensure all media IDs are unique."""
        if len(v) != len(set(v)):
            raise ValueError("Duplicate media IDs found in reorder list")
        return v

    model_config = {"from_attributes": True}


class MediaListResponse(BaseModel):
    """Schema for list of media items."""

    items: list[MediaResponse]
    total: int

    model_config = {"from_attributes": True}
