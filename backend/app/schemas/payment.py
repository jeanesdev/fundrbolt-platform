"""Pydantic v2 schemas for payment processing.

T015 — Phase 2.

All schemas here are request/response models for the payment API endpoints.
Sensitive fields (credentials) are masked — only last 4 chars shown.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

# ── Line Item ─────────────────────────────────────────────────────────────────


class LineItemSchema(BaseModel):
    """A single line in a payment breakdown (ticket, auction win, donation, etc.)."""

    type: str = Field(
        ...,
        description=("Line item type: ticket | auction_win | donation | extra_tip | fee_coverage"),
        examples=["ticket"],
    )
    label: str = Field(..., description="Human-readable label shown on receipt.", max_length=200)
    amount: Decimal = Field(..., ge=0, description="Amount in USD for this line item.")


# ── HPF Session ───────────────────────────────────────────────────────────────


class PaymentSessionRequest(BaseModel):
    """Request body for POST /payments/session — create a hosted payment form session."""

    event_id: uuid.UUID | None = Field(
        default=None,
        description="Event the payment is for. Required when collecting a payment; may be null for card-save-only (vault) sessions.",
    )
    npo_id: uuid.UUID | None = Field(
        default=None,
        description="NPO to associate with this session. Required when event_id is null (e.g., card-vault-only from the settings page).",
    )
    line_items: list[LineItemSchema] = Field(
        ..., min_length=1, description="Items being purchased."
    )
    save_profile: bool = Field(
        default=True,
        description="If true, request vault profile creation after HPF completion.",
    )
    return_url: str = Field(..., description="Frontend URL to redirect to after HPF completes.")
    idempotency_key: str = Field(
        ...,
        max_length=64,
        description="Caller-generated idempotency key to prevent duplicate sessions.",
    )


class PaymentSessionResponse(BaseModel):
    """Response for POST /payments/session."""

    transaction_id: uuid.UUID = Field(..., description="Our internal PaymentTransaction.id.")
    session_token: str = Field(..., description="Short-lived HPF session token.")
    hpf_url: str = Field(..., description="URL to embed in an iframe or open in browser.")
    expires_at: datetime = Field(..., description="When the session token expires.")
    amount_total: Decimal = Field(..., description="Total amount being collected in this session.")


# ── Payment Profiles ─────────────────────────────────────────────────────────


class PaymentProfileCreate(BaseModel):
    """Request body for POST /payments/profiles — save a card after HPF completes."""

    npo_id: uuid.UUID
    gateway_profile_id: str = Field(..., max_length=255)
    card_last4: str = Field(..., min_length=4, max_length=4)
    card_brand: str = Field(..., max_length=20, examples=["Visa", "Mastercard", "Amex"])
    card_expiry_month: int = Field(..., ge=1, le=12)
    card_expiry_year: int = Field(..., ge=2024)
    billing_name: str | None = Field(None, max_length=200)
    billing_zip: str | None = Field(None, max_length=10)
    is_default: bool = False


class PaymentProfileRead(BaseModel):
    """Response schema for a saved payment profile — never exposes vault token directly."""

    id: uuid.UUID
    npo_id: uuid.UUID
    gateway_profile_id: str = Field(..., description="Opaque vault token from gateway.")
    card_last4: str
    card_brand: str
    card_expiry_month: int
    card_expiry_year: int
    billing_name: str | None = None
    billing_zip: str | None = None
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Checkout ──────────────────────────────────────────────────────────────────


class CheckoutRequest(BaseModel):
    """Request body for POST /payments/checkout — end-of-night self-checkout."""

    event_id: uuid.UUID
    payment_profile_id: uuid.UUID = Field(..., description="Saved card to charge.")
    line_items: list[LineItemSchema] = Field(
        default_factory=list,
        description="Informational only; server re-derives balance from DB.",
    )
    total_amount: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        description="Informational only; server re-derives balance from DB.",
    )
    cover_processing_fee: bool = Field(
        default=False,
        description="If true, processing fee is added to total and included as a line item.",
    )
    idempotency_key: str | None = Field(None, max_length=64)


class CheckoutResponse(BaseModel):
    """Response for POST /payments/checkout."""

    transaction_id: uuid.UUID
    status: str = Field(..., description="approved | declined | pending")
    amount_charged: Decimal
    gateway_transaction_id: str | None = None
    decline_reason: str | None = None
    receipt_pending: bool = Field(
        default=True,
        description="True when receipt email is queued but not yet sent.",
    )


class CheckoutBalanceResponse(BaseModel):
    """Response for GET /payments/checkout/balance — outstanding balance summary."""

    event_id: uuid.UUID
    user_id: uuid.UUID
    total_balance: Decimal = Field(..., description="Total outstanding balance.")
    line_items: list[LineItemSchema]
    processing_fee: Decimal = Field(..., description="Estimated processing fee if covered.")
    total_with_fee: Decimal


# ── Admin Charge / Refund ─────────────────────────────────────────────────────


class AdminChargeRequest(BaseModel):
    """Request body for POST /admin/payments/charge — admin-initiated manual charge."""

    user_id: uuid.UUID
    npo_id: uuid.UUID
    event_id: uuid.UUID | None = None
    payment_profile_id: uuid.UUID
    line_items: list[LineItemSchema] = Field(..., min_length=1)
    total_amount: Decimal = Field(..., ge=0)
    reason: str = Field(..., max_length=500, description="Required reason for manual charge.")
    idempotency_key: str | None = Field(None, max_length=64)


class AdminChargeResponse(BaseModel):
    """Response for POST /admin/payments/charge."""

    transaction_id: uuid.UUID
    status: str
    amount_charged: Decimal
    gateway_transaction_id: str | None = None
    decline_reason: str | None = None


class VoidRequest(BaseModel):
    """Request body for POST /admin/payments/{transaction_id}/void."""

    reason: str = Field(..., max_length=500)


class RefundRequest(BaseModel):
    """Request body for POST /admin/payments/{transaction_id}/refund."""

    amount: Decimal = Field(..., gt=0, description="Amount to refund (may be partial).")
    reason: str = Field(..., max_length=500)


class RefundResponse(BaseModel):
    """Response for POST /admin/payments/{transaction_id}/refund."""

    refund_transaction_id: uuid.UUID
    gateway_transaction_id: str | None = None
    status: str
    amount_refunded: Decimal


# ── NPO Gateway Credentials ───────────────────────────────────────────────────


class CredentialCreate(BaseModel):
    """Request body for POST/PUT /admin/npos/{npo_id}/payment-credentials."""

    gateway_name: str = Field(default="deluxe", pattern="^(deluxe|stub)$")
    merchant_id: str = Field(..., min_length=1, description="Will be encrypted before storage.")
    api_key: str = Field(..., min_length=1, description="Will be encrypted before storage.")
    api_secret: str = Field(..., min_length=1, description="Will be encrypted before storage.")
    gateway_id: str | None = Field(None, max_length=100)
    is_live_mode: bool = False

    @field_validator("merchant_id", "api_key", "api_secret")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class CredentialRead(BaseModel):
    """Response schema — all sensitive values masked to last 4 chars."""

    id: uuid.UUID
    npo_id: uuid.UUID
    gateway_name: str
    merchant_id_masked: str = Field(..., description="Last 4 chars of merchant_id, rest *.")
    api_key_masked: str = Field(..., description="Last 4 chars of api_key, rest *.")
    gateway_id: str | None = None
    is_live_mode: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CredentialNotConfigured(BaseModel):
    """Response when an NPO has no payment credentials configured."""

    npo_id: uuid.UUID
    configured: bool = False


class CredentialTestResponse(BaseModel):
    """Response for POST /admin/npos/{npo_id}/payment-credentials/test."""

    success: bool
    message: str
    gateway_name: str | None = None
    is_live_mode: bool | None = None
    latency_ms: int | None = None
