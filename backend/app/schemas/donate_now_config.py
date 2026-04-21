"""Pydantic schemas for donate-now page configuration."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

# ─── Tier Schemas ───────────────────────────────────────────────────────────


class DonationTierResponse(BaseModel):
    """Public-facing donation tier."""

    id: uuid.UUID
    amount_cents: int
    impact_statement: str | None
    display_order: int

    model_config = ConfigDict(from_attributes=True)


class DonationTierInput(BaseModel):
    """Input schema for creating/updating a donation tier."""

    amount_cents: Annotated[int, Field(gt=0, description="Amount in cents (min $1 = 100)")]
    impact_statement: str | None = Field(None, max_length=200)
    display_order: int = Field(0, ge=0)


# ─── Config Schemas ──────────────────────────────────────────────────────────


class DonateNowConfigResponse(BaseModel):
    """Admin-facing donate-now page configuration."""

    id: uuid.UUID
    npo_id: uuid.UUID
    is_enabled: bool
    donate_plea_text: str | None
    hero_media_url: str | None
    hero_transition_style: str
    processing_fee_pct: Decimal
    npo_info_text: str | None
    tiers: list[DonationTierResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DonateNowConfigUpdate(BaseModel):
    """Admin update payload for donate-now config."""

    is_enabled: bool | None = None
    donate_plea_text: str | None = Field(None, max_length=500)
    hero_media_url: str | None = Field(None, max_length=2000)
    hero_transition_style: str | None = Field(
        None,
        pattern="^(documentary_style|fade|swipe|simple)$",
    )
    processing_fee_pct: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("1"))
    npo_info_text: str | None = None


# ─── Public Page Schemas ─────────────────────────────────────────────────────


class UpcomingEventSummary(BaseModel):
    """Minimal event info for the donate-now page."""

    id: uuid.UUID
    name: str
    slug: str
    start_date: date | None

    model_config = ConfigDict(from_attributes=True)


class SocialLinkPublic(BaseModel):
    """An NPO social link for the donate-now page."""

    platform: str
    url: str


class DonateNowPagePublic(BaseModel):
    """Full donor-facing donate-now page data."""

    npo_id: uuid.UUID
    npo_name: str
    npo_slug: str
    is_enabled: bool
    donate_plea_text: str | None
    hero_media_url: str | None
    hero_transition_style: str
    processing_fee_pct: Decimal
    npo_info_text: str | None
    tiers: list[DonationTierResponse] = []
    social_links: list[SocialLinkPublic] = []
    upcoming_event: UpcomingEventSummary | None = None


# ─── Dashboard / Stats Schemas ───────────────────────────────────────────────


class RecentDonationItem(BaseModel):
    """A single donation entry for the admin dashboard."""

    id: uuid.UUID
    amount_cents: int
    is_monthly: bool
    status: str
    donor_name: str
    event_id: uuid.UUID | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DonationsDashboardResponse(BaseModel):
    """Aggregate donation metrics for the admin donate-now dashboard."""

    total_count: int
    total_amount_cents: int
    one_time_count: int
    one_time_amount_cents: int
    monthly_count: int
    monthly_amount_cents: int
    recent: list[RecentDonationItem] = []
