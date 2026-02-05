"""Contact submission Pydantic schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

import bleach
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.contact_submission import SubmissionStatus


class ContactSubmissionCreate(BaseModel):
    """Schema for creating contact submission."""

    sender_name: str = Field(..., min_length=1, max_length=100)
    sender_email: EmailStr
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=5000)
    website: str = Field(default="", max_length=0)  # Honeypot field - must be empty

    @field_validator("sender_name")
    @classmethod
    def validate_name_length(cls, value: Any) -> str:
        """Ensure name is at least 2 characters"""
        if not isinstance(value, str) or len(value.strip()) < 2:
            raise ValueError("Name must be at least 2 characters")
        return value

    @field_validator("website")
    @classmethod
    def validate_honeypot(cls, value: str) -> str:
        """Reject if honeypot field is filled (bot detection)"""
        if value:
            raise ValueError("Bot detected")
        return value

    @field_validator("message", "sender_name")
    @classmethod
    def sanitize_html(cls, value: str) -> str:
        """Sanitize HTML to prevent XSS attacks"""
        return bleach.clean(value, tags=[], strip=True)


class ContactSubmissionResponse(BaseModel):
    """Schema for contact submission response (public view)."""

    id: UUID
    sender_name: str
    sender_email: str
    subject: str
    status: SubmissionStatus
    created_at: datetime

    class Config:
        from_attributes = True


class ContactSubmissionDetail(ContactSubmissionResponse):
    """Schema for contact submission detail (admin view)."""

    message: str
    ip_address: str
    updated_at: datetime
