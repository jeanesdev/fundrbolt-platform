"""Pydantic schemas for authenticated support messages."""

from typing import Literal

import bleach
from pydantic import BaseModel, Field, field_validator


class SupportMessageCreate(BaseModel):
    """Schema for sending a support message from an authenticated user."""

    reason: Literal[
        "bug",
        "event-inquiry",
        "account",
        "feature-request",
        "general",
        "other",
    ]
    subject: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=10, max_length=5000)

    @field_validator("subject", "message")
    @classmethod
    def sanitize_html(cls, value: str) -> str:
        """Strip any HTML before emailing the message."""
        return bleach.clean(value, tags=[], strip=True).strip()
