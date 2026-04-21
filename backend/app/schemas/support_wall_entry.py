"""Pydantic schemas for support wall entries."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SupportWallEntryPublic(BaseModel):
    """Public-facing support wall entry."""

    id: uuid.UUID
    display_name: str | None
    is_anonymous: bool
    show_amount: bool
    amount_cents: int | None
    tier_label: str | None
    message: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupportWallPage(BaseModel):
    """Paginated page of support wall entries."""

    entries: list[SupportWallEntryPublic]
    total: int
    page: int
    per_page: int
    pages: int


class AdminSupportWallEntryResponse(BaseModel):
    """Admin-facing support wall entry (includes hidden status and donor info)."""

    id: uuid.UUID
    donation_id: uuid.UUID
    npo_id: uuid.UUID
    donor_user_id: uuid.UUID | None
    display_name: str | None
    is_anonymous: bool
    show_amount: bool
    amount_cents: int | None
    message: str | None
    is_hidden: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminSupportWallPage(BaseModel):
    """Paginated admin view of support wall entries."""

    entries: list[AdminSupportWallEntryResponse]
    total: int
    page: int
    per_page: int
    pages: int
