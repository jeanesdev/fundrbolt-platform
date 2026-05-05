"""Pydantic schemas for donor event checkout (feature 044)."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

# ── Processing Fee ────────────────────────────────────────────────────────────


class ProcessingFeeConfigResponse(BaseModel):
    id: uuid.UUID
    rate: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Checkout Items ────────────────────────────────────────────────────────────


class CheckoutItemResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    name: str
    description: str | None = None
    original_amount_cents: int
    adjusted_amount_cents: int | None = None
    effective_amount_cents: int
    source_type: str
    source_id: uuid.UUID | None = None
    display_order: int
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Audit Logs ────────────────────────────────────────────────────────────────


class CheckoutAuditLogResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    admin_user_id: uuid.UUID
    action: str
    item_id: uuid.UUID | None = None
    field_changed: str | None = None
    before_value: str | None = None
    after_value: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Checkout Session ──────────────────────────────────────────────────────────


class CheckoutSessionResponse(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    user_id: uuid.UUID
    status: str
    payment_method: str | None = None
    cover_processing_fee: bool
    auctioneer_tip_cents: int
    platform_tip_cents: int
    subtotal_cents: int
    processing_fee_cents: int
    total_cents: int
    completed_at: datetime | None = None
    receipt_url: str | None = None
    items_updated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    items: list[CheckoutItemResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class AdminCheckoutSessionResponse(CheckoutSessionResponse):
    """Admin view of a checkout session — includes audit logs."""

    audit_logs: list[CheckoutAuditLogResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ── Balance (new version — backwards-compatible with payment.py schema) ───────


class CheckoutBalanceV2Response(BaseModel):
    """Extended checkout balance response with fee rate and cash instructions."""

    event_id: uuid.UUID
    user_id: uuid.UUID
    session_id: uuid.UUID | None = None
    status: str = "not_started"
    subtotal_cents: int = 0
    processing_fee_rate: Decimal | None = None
    processing_fee_cents: int = 0
    total_cents: int = 0
    cover_processing_fee: bool = True
    auctioneer_tip_cents: int = 5000
    platform_tip_cents: int = 0
    cash_instructions: str | None = None
    items_updated_at: datetime | None = None
    items: list[CheckoutItemResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ── Confirm Checkout ──────────────────────────────────────────────────────────


class CheckoutConfirmRequest(BaseModel):
    payment_method: str = Field(..., description="card | cash | check | daf")
    payment_profile_id: uuid.UUID | None = Field(
        default=None,
        description="Required when payment_method=card",
    )
    acknowledged_items_updated_at: datetime | None = Field(
        default=None,
        description="Must match session.items_updated_at when items have been updated",
    )


class CheckoutConfirmResponse(BaseModel):
    session_id: uuid.UUID
    status: str
    receipt_url: str | None = None
    total_cents: int

    model_config = {"from_attributes": True}


# ── Checkout Configuration ────────────────────────────────────────────────────


class CheckoutConfigurationResponse(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    is_open: bool
    donor_visible: bool
    scheduled_open_at: datetime | None = None
    opened_at: datetime | None = None
    processing_fee_rate: Decimal | None = None
    cash_instructions: str | None = None
    celery_task_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UpdateCheckoutConfigurationRequest(BaseModel):
    cash_instructions: str | None = None
    donor_visible: bool | None = None


class ScheduleCheckoutOpenRequest(BaseModel):
    open_at: datetime = Field(..., description="UTC datetime to auto-open checkout")


# ── Admin Donor Checkout Status ───────────────────────────────────────────────


class DonorCheckoutStatusEntry(BaseModel):
    user_id: uuid.UUID
    first_name: str | None = None
    last_name: str | None = None
    email: str
    session_status: str
    total_cents: int
    item_count: int
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class DonorCheckoutStatusListResponse(BaseModel):
    items: list[DonorCheckoutStatusEntry]
    total: int
    page: int
    per_page: int
    pages: int


# ── Admin Item Management ─────────────────────────────────────────────────────


class AdminAddCheckoutItemRequest(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = None
    original_amount_cents: int = Field(..., gt=0)
    source_type: str = Field(default="manual")


class AdminRepriceItemRequest(BaseModel):
    adjusted_amount_cents: int = Field(..., ge=0)


class UpdateCheckoutSessionRequest(BaseModel):
    payment_method: str | None = Field(
        default=None,
        description="card | cash | check | daf",
    )
    cover_processing_fee: bool | None = None
    auctioneer_tip_cents: int | None = Field(default=None, ge=0)
    platform_tip_cents: int | None = Field(default=None, ge=0)


# ── Notifications ─────────────────────────────────────────────────────────────


class SendCheckoutNotificationRequest(BaseModel):
    user_ids: list[uuid.UUID] | None = Field(
        default=None,
        description="Specific user IDs to notify. If None, notify all with open sessions.",
    )


# ── Contact Admin ─────────────────────────────────────────────────────────────


class ContactAdminRequest(BaseModel):
    message: str = Field(..., max_length=1000)
