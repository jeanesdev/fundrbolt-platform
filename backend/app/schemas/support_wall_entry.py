"""Pydantic schemas for support wall entries."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class SupportWallEntryPublic(BaseModel):
    """Public-facing support wall entry."""

    id: uuid.UUID
    display_name: str | None
    is_anonymous: bool
    show_amount: bool
    amount_cents: int | None
    is_monthly: bool
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
    donor_name: str | None
    donor_email: str | None
    public_display_name: str | None
    is_anonymous: bool
    show_amount: bool
    amount_cents: int | None
    covers_processing_fee: bool
    processing_fee_cents: int
    total_charged_cents: int
    is_monthly: bool
    recurrence_status: str | None
    next_charge_date: date | None
    donation_status: str
    message: str | None
    moderation_status: str
    is_reviewed: bool
    is_hidden: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupportWallBulkModerationRequest(BaseModel):
    """Bulk moderation request for support wall entries."""

    entry_ids: list[uuid.UUID]


class AdminSupportWallPage(BaseModel):
    """Paginated admin view of support wall entries."""

    entries: list[AdminSupportWallEntryResponse]
    total: int
    page: int
    per_page: int
    pages: int
