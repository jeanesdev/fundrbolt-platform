"""Pydantic schemas for auctioneer endpoints."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

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
    cost: Decimal | None
    primary_image_url: str | None
    created_at: datetime
    updated_at: datetime


class CommissionListResponse(BaseModel):
    commissions: list[CommissionListItem]
    total: int


# --- Event settings schemas ---


class EventSettingsUpsertRequest(BaseModel):
    live_auction_percent: Decimal = Field(ge=0, le=100)
    paddle_raise_percent: Decimal = Field(ge=0, le=100)
    silent_auction_percent: Decimal = Field(ge=0, le=100)


class EventSettingsResponse(BaseModel):
    auctioneer_user_id: UUID
    event_id: UUID
    live_auction_percent: Decimal
    paddle_raise_percent: Decimal
    silent_auction_percent: Decimal
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
