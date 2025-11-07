"""Testimonial Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from app.models.testimonial import AuthorRole


class TestimonialCreate(BaseModel):
    """Schema for creating testimonial."""

    quote_text: str = Field(..., min_length=10, max_length=500)
    author_name: str = Field(..., min_length=1, max_length=100)
    author_role: AuthorRole
    organization_name: str | None = Field(None, max_length=200)
    photo_url: HttpUrl | None = None
    display_order: int = Field(default=0, ge=0, le=9999)
    is_published: bool = False


class TestimonialUpdate(BaseModel):
    """Schema for updating testimonial."""

    quote_text: str | None = Field(None, min_length=10, max_length=500)
    author_name: str | None = Field(None, min_length=1, max_length=100)
    author_role: AuthorRole | None = None
    organization_name: str | None = Field(None, max_length=200)
    photo_url: HttpUrl | None = None
    display_order: int | None = Field(None, ge=0, le=9999)
    is_published: bool | None = None


class TestimonialResponse(BaseModel):
    """Schema for testimonial response (public view)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    quote_text: str
    author_name: str
    author_role: AuthorRole
    organization_name: str | None
    photo_url: str | None
    display_order: int
    is_published: bool
    created_at: datetime


class TestimonialDetail(TestimonialResponse):
    """Schema for testimonial detail (admin view)."""

    created_by: UUID
    updated_at: datetime
    deleted_at: datetime | None
