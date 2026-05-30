"""Pydantic schemas for auctioneer endpoints."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.revenue_generator import RevenueGeneratorDashboardSummary

# --- Commission schemas ---


class CommissionUpsertRequest(BaseModel):
    commission_percent: Decimal = Field(ge=0, le=100)
    flat_fee: Decimal = Field(ge=0)
    notes: str | None = Field(default=None, max_length=2000)


class CommissionResponse(BaseModel):
    id: UUID
    auction_item_id: UUID
    commission_percent: Decimal
    flat_fee: Decimal
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommissionListItem(BaseModel):
    id: UUID
    auction_item_id: UUID
    auction_item_title: str
    auction_item_bid_number: int | None
    auction_type: str | None
    commission_percent: Decimal
    flat_fee: Decimal
    notes: str | None
    item_status: str | None
    current_bid_amount: Decimal | None
    quantity_available: int | None
    bid_count: int
    donor_value: Decimal | None
    cost: Decimal | None
    primary_image_url: str | None
    created_at: datetime
    updated_at: datetime


class CommissionListResponse(BaseModel):
    commissions: list[CommissionListItem]
    total: int


# --- Event settings schemas ---

DEFAULT_PADDLE_RAISE_LEVELS = [10000, 5000, 2500, 1000, 500, 250, 100]


class EventSettingsUpsertRequest(BaseModel):
    live_auction_percent: Decimal = Field(ge=0, le=100)
    paddle_raise_percent: Decimal = Field(ge=0, le=100)
    silent_auction_percent: Decimal = Field(ge=0, le=100)
    paddle_raise_levels: list[int] = Field(
        default_factory=lambda: DEFAULT_PADDLE_RAISE_LEVELS.copy()
    )
    paddle_raise_total_goal: int | None = Field(default=None, ge=1)
    paddle_raise_level_goals: dict[str, int] = Field(default_factory=dict)
    paddle_raise_level_notes: dict[str, str] = Field(default_factory=dict)

    @field_validator("paddle_raise_levels")
    @classmethod
    def validate_paddle_raise_levels(cls, value: list[int]) -> list[int]:
        normalized = sorted({level for level in value if level > 0}, reverse=True)
        if not normalized:
            raise ValueError("At least one positive paddle raise level is required")
        return normalized

    @field_validator("paddle_raise_level_goals")
    @classmethod
    def validate_paddle_raise_level_goals(cls, value: dict[str, int]) -> dict[str, int]:
        normalized: dict[str, int] = {}
        for key, goal in value.items():
            amount = int(key)
            if amount <= 0 or goal <= 0:
                continue
            normalized[str(amount)] = goal
        return normalized

    @field_validator("paddle_raise_level_notes")
    @classmethod
    def validate_paddle_raise_level_notes(cls, value: dict[str, str]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for key, note in value.items():
            amount = int(key)
            cleaned_note = note.strip()
            if amount <= 0 or not cleaned_note:
                continue
            normalized[str(amount)] = cleaned_note[:500]
        return normalized


class EventSettingsResponse(BaseModel):
    auctioneer_user_id: UUID
    event_id: UUID
    live_auction_percent: Decimal
    paddle_raise_percent: Decimal
    silent_auction_percent: Decimal
    paddle_raise_levels: list[int]
    paddle_raise_total_goal: Decimal | None = None
    paddle_raise_level_goals: dict[str, int] = Field(default_factory=dict)
    paddle_raise_level_notes: dict[str, str] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Dashboard schemas ---


class EarningsSummary(BaseModel):
    per_item_total: Decimal
    per_item_count: int
    live_auction_category_earning: Decimal
    paddle_raise_category_earning: Decimal
    silent_auction_category_earning: Decimal
    total_earnings: Decimal


class EventTotals(BaseModel):
    live_auction_raised: Decimal
    paddle_raise_raised: Decimal
    silent_auction_raised: Decimal
    event_total_raised: Decimal


AuctionStatus = Literal["not_started", "in_progress", "ended", "not_scheduled"]
SilentAuctionStatus = Literal["not_started", "open", "closed", "not_scheduled"]


class TimerData(BaseModel):
    live_auction_start_datetime: datetime | None
    auction_close_datetime: datetime | None
    live_auction_status: AuctionStatus
    silent_auction_status: SilentAuctionStatus


class DashboardResponse(BaseModel):
    earnings: EarningsSummary
    event_totals: EventTotals
    timers: TimerData
    last_refreshed_at: datetime
    revenue_generators: RevenueGeneratorDashboardSummary | None = None


# --- Live auction schemas ---


class LiveAuctionItem(BaseModel):
    id: UUID
    bid_number: int | None
    title: str
    description: str | None
    starting_bid: Decimal | None
    current_bid_amount: Decimal | None
    bid_count: int
    primary_image_url: str | None
    donor_value: Decimal | None
    cost: Decimal | None


class HighBidder(BaseModel):
    bidder_number: int | None
    first_name: str
    last_name: str
    table_number: int | None
    profile_picture_url: str | None


class BidHistoryEntry(BaseModel):
    bidder_number: int | None
    bidder_name: str
    bid_amount: Decimal
    placed_at: datetime


class LiveAuctionResponse(BaseModel):
    current_item: LiveAuctionItem | None
    high_bidder: HighBidder | None
    bid_history: list[BidHistoryEntry]
    auction_status: AuctionStatus


class AuctioneerItemSummary(BaseModel):
    id: UUID
    bid_number: int | None
    title: str
    auction_type: str
    status: str | None
    description: str | None
    current_bid_amount: Decimal | None
    bid_count: int
    bidder_count: int
    primary_image_url: str | None
    donor_value: Decimal | None
    cost: Decimal | None
    commission_percent: Decimal | None = None
    flat_fee: Decimal | None = None
    has_commission: bool = False
    has_bounty: bool = False
    slide_presentation_html: str | None = None
    slide_presentation_layout: str


class AuctioneerItemGalleryResponse(BaseModel):
    items: list[AuctioneerItemSummary]
    total_items: int
    total_raised: Decimal
    total_bids: int


class AuctioneerBidderProfile(BaseModel):
    bidder_number: int | None
    bidder_name: str
    table_number: int | None
    profile_picture_url: str | None
    user_id: UUID | None = None


class AuctioneerBidActivityEntry(BaseModel):
    id: UUID
    bid_amount: Decimal
    placed_at: datetime
    bid_status: str
    bid_source: Literal["live", "silent", "paddle_raise"]
    label_names: list[str] = Field(default_factory=list)
    is_monthly: bool = False
    bidder: AuctioneerBidderProfile


class AuctioneerBidderSummary(BaseModel):
    bidder: AuctioneerBidderProfile
    total_bid_amount: Decimal
    highest_bid_amount: Decimal
    bid_count: int
    latest_bid_at: datetime


class AuctioneerItemDetailResponse(BaseModel):
    item: AuctioneerItemSummary
    current_high_bid: Decimal | None
    high_bidder: AuctioneerBidderProfile | None
    bids: list[AuctioneerBidActivityEntry]
    bidder_summaries: list[AuctioneerBidderSummary]


class AuctioneerPaddleRaiseLevelSummary(BaseModel):
    amount: int
    bidder_count: int
    total_amount: Decimal
    participation_percent: float
    donations_count: int
    goal_amount: Decimal | None = None
    goal_progress_percent: float | None = None
    is_monthly: bool = False


class AuctioneerPaddleRaiseBidderSummary(BaseModel):
    bidder: AuctioneerBidderProfile
    total_amount: Decimal
    donation_count: int
    label_names: list[str] = Field(default_factory=list)
    is_last_hero: bool = False


class AuctioneerPaddleRaiseResponse(BaseModel):
    configured_levels: list[int]
    total_pledged: Decimal
    total_goal: Decimal | None = None
    total_goal_progress_percent: float | None = None
    donation_count: int
    unique_donor_count: int
    participation_percent: float
    last_hero_total: Decimal
    level_summaries: list[AuctioneerPaddleRaiseLevelSummary]
    donations: list[AuctioneerBidActivityEntry]
    bidder_totals: list[AuctioneerPaddleRaiseBidderSummary]
    last_hero_bidder_totals: list[AuctioneerPaddleRaiseBidderSummary]
