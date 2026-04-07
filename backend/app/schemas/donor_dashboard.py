"""Pydantic schemas for the admin donor dashboard endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# --- Leaderboard ---


class DonorLeaderboardEntry(BaseModel):
    """Single row in the donor leaderboard."""

    user_id: UUID
    first_name: str
    last_name: str
    email: str
    is_active: bool
    total_given: float = Field(default=0)
    events_attended: int = Field(default=0)
    ticket_total: float = Field(default=0)
    donation_total: float = Field(default=0)
    silent_auction_total: float = Field(default=0)
    live_auction_total: float = Field(default=0)
    buy_now_total: float = Field(default=0)


class DonorLeaderboardResponse(BaseModel):
    """Paginated leaderboard result."""

    items: list[DonorLeaderboardEntry]
    total: int
    page: int
    per_page: int
    pages: int


# --- Donor Profile ---


class EventAttendance(BaseModel):
    event_id: UUID
    event_name: str
    event_date: datetime
    npo_id: UUID
    npo_name: str
    checked_in: bool
    total_given_at_event: float = Field(default=0)


class BidRecord(BaseModel):
    bid_id: UUID
    event_id: UUID
    event_name: str
    npo_id: UUID | None = None
    npo_name: str | None = None
    item_id: UUID
    item_title: str
    item_category: str | None = None
    bid_amount: float
    bid_status: str
    bid_type: str
    created_at: datetime


class DonationRecord(BaseModel):
    donation_id: UUID
    event_id: UUID
    event_name: str
    npo_id: UUID | None = None
    npo_name: str | None = None
    amount: float
    source: str
    is_paddle_raise: bool = False
    created_at: datetime


class TicketRecord(BaseModel):
    purchase_id: UUID
    event_id: UUID
    event_name: str
    npo_id: UUID | None = None
    npo_name: str | None = None
    package_name: str
    quantity: int
    total_price: float
    purchased_at: datetime


class OutbidSummary(BaseModel):
    total_outbid_amount: float = Field(default=0)
    items_bid_on: int = Field(default=0)
    items_won: int = Field(default=0)
    items_lost: int = Field(default=0)
    win_rate: float = Field(default=0)


class CategoryInterest(BaseModel):
    category: str
    bid_count: int = Field(default=0)
    total_bid_amount: float = Field(default=0)
    items_won: int = Field(default=0)


class DonorProfileResponse(BaseModel):
    user_id: UUID
    first_name: str
    last_name: str
    email: str
    phone: str | None = None
    is_active: bool
    total_given: float = Field(default=0)
    events_attended: int = Field(default=0)
    event_history: list[EventAttendance] = Field(default_factory=list)
    bid_history: list[BidRecord] = Field(default_factory=list)
    donation_history: list[DonationRecord] = Field(default_factory=list)
    ticket_history: list[TicketRecord] = Field(default_factory=list)
    category_interests: list[CategoryInterest] = Field(default_factory=list)
    outbid_summary: OutbidSummary = Field(default_factory=OutbidSummary)


# --- Outbid Leaders ---


class OutbidLeaderEntry(BaseModel):
    user_id: UUID
    first_name: str
    last_name: str
    total_outbid_amount: float = Field(default=0)
    items_bid_on: int = Field(default=0)
    items_won: int = Field(default=0)
    items_lost: int = Field(default=0)
    win_rate: float = Field(default=0)


class OutbidLeadersResponse(BaseModel):
    items: list[OutbidLeaderEntry]
    total: int
    page: int
    per_page: int
    pages: int


# --- Bid Wars ---


class BidWarItem(BaseModel):
    item_id: UUID
    item_title: str
    bid_count: int
    highest_bid: float
    won: bool


class BidWarEntry(BaseModel):
    user_id: UUID
    first_name: str
    last_name: str
    bid_war_count: int = Field(default=0)
    total_bids_in_wars: int = Field(default=0)
    top_war_items: list[BidWarItem] = Field(default_factory=list)


class BidWarsResponse(BaseModel):
    items: list[BidWarEntry]
    total: int
    page: int
    per_page: int
    pages: int


# --- Category Breakdown ---


class GivingTypeEntry(BaseModel):
    category: str
    total_amount: float = Field(default=0)
    donor_count: int = Field(default=0)


class AuctionCategoryEntry(BaseModel):
    category: str
    total_bid_amount: float = Field(default=0)
    total_revenue: float = Field(default=0)
    bid_count: int = Field(default=0)
    item_count: int = Field(default=0)


class CategoryBreakdownResponse(BaseModel):
    giving_type_breakdown: list[GivingTypeEntry] = Field(default_factory=list)
    auction_category_breakdown: list[AuctionCategoryEntry] = Field(default_factory=list)
