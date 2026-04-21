"""Pydantic schemas for the admin auction dashboard endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# --- Summary ---


class AuctionDashboardSummary(BaseModel):
    total_items: int = Field(default=0)
    total_bids: int = Field(default=0)
    total_revenue: float = Field(default=0)
    average_bid_amount: float = Field(default=0)


# --- Items list ---


class AuctionItemRow(BaseModel):
    id: UUID
    title: str
    auction_type: str
    buy_now_enabled: bool
    category: str | None = None
    current_bid_amount: float | None = None
    bid_count: int = Field(default=0)
    watcher_count: int = Field(default=0)
    status: str
    event_id: UUID
    event_name: str
    donated_by: str | None = None


class AuctionItemsListResponse(BaseModel):
    items: list[AuctionItemRow]
    total: int
    page: int
    per_page: int
    total_pages: int


# --- Charts ---


class ChartDataPoint(BaseModel):
    label: str
    value: float = Field(default=0)


class AuctionDashboardCharts(BaseModel):
    revenue_by_type: list[ChartDataPoint] = Field(default_factory=list)
    revenue_by_category: list[ChartDataPoint] = Field(default_factory=list)
    bid_count_by_type: list[ChartDataPoint] = Field(default_factory=list)
    top_items_by_revenue: list[ChartDataPoint] = Field(default_factory=list)
    top_items_by_bid_count: list[ChartDataPoint] = Field(default_factory=list)
    top_items_by_watchers: list[ChartDataPoint] = Field(default_factory=list)


# --- Item detail ---


class BidHistoryEntry(BaseModel):
    id: UUID
    bidder_number: int
    bidder_name: str
    bid_amount: float
    bid_type: str
    bid_status: str
    placed_at: datetime


class BidTimelinePoint(BaseModel):
    timestamp: datetime
    bid_amount: float


class AuctionItemFull(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    auction_type: str
    category: str | None = None
    status: str
    starting_bid: float
    current_bid_amount: float | None = None
    bid_count: int = Field(default=0)
    watcher_count: int = Field(default=0)
    buy_now_enabled: bool
    buy_now_price: float | None = None
    bid_increment: float
    donated_by: str | None = None
    donor_value: float | None = None
    bidding_open: bool
    event_id: UUID
    event_name: str


class AuctionItemDetailResponse(BaseModel):
    item: AuctionItemFull
    bid_history: list[BidHistoryEntry] = Field(default_factory=list)
    bid_timeline: list[BidTimelinePoint] = Field(default_factory=list)
