"""Pydantic schemas for auction bids and reporting."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.auction_bid import BidStatus, BidType, TransactionStatus
from app.models.auction_item import AuctionType


class BidCreateRequest(BaseModel):
    """Schema for placing a bid."""

    event_id: UUID
    auction_item_id: UUID
    bid_amount: Decimal = Field(..., ge=0, decimal_places=2)
    max_bid: Decimal | None = Field(None, ge=0, decimal_places=2)
    bid_type: BidType


class BidResponse(BaseModel):
    """Schema for bid responses."""

    id: UUID
    event_id: UUID
    auction_item_id: UUID
    user_id: UUID
    bidder_number: int
    bid_amount: Decimal
    max_bid: Decimal | None
    bid_type: BidType
    bid_status: BidStatus
    transaction_status: TransactionStatus
    placed_at: datetime

    model_config = {"from_attributes": True}


class BidHistoryResponse(BaseModel):
    """Schema for paginated bid history."""

    page: int = Field(..., ge=1)
    per_page: int = Field(..., ge=1, le=100)
    total: int = Field(..., ge=0)
    items: list[BidResponse]


class MarkWinningRequest(BaseModel):
    """Admin request to mark a bid as winning."""

    reason: str = Field(..., min_length=1, max_length=500)


class AdjustBidRequest(BaseModel):
    """Admin request to adjust a bid amount."""

    new_amount: Decimal = Field(..., ge=0, decimal_places=2)
    reason: str = Field(..., min_length=1, max_length=500)


class AdminActionRequest(BaseModel):
    """Admin request with a reason."""

    reason: str = Field(..., min_length=1, max_length=500)


class TransactionStatusRequest(BaseModel):
    """Admin request to override transaction status."""

    transaction_status: TransactionStatus
    reason: str = Field(..., min_length=1, max_length=500)


class PaddleRaiseRequest(BaseModel):
    """Request to record a paddle raise contribution."""

    event_id: UUID
    amount: Decimal = Field(..., ge=0, decimal_places=2)
    tier_name: str = Field(..., min_length=1, max_length=100)


class PaddleRaiseResponse(BaseModel):
    """Response for paddle raise contributions."""

    id: UUID
    event_id: UUID
    user_id: UUID
    bidder_number: int
    amount: Decimal
    tier_name: str
    placed_at: datetime

    model_config = {"from_attributes": True}


class WinningBidReportItem(BaseModel):
    bid_id: UUID
    auction_item_id: UUID
    bidder_number: int
    bid_amount: Decimal
    bid_status: BidStatus
    transaction_status: TransactionStatus
    auction_type: AuctionType
    placed_at: datetime


class UnprocessedTransactionReportItem(BaseModel):
    bid_id: UUID
    auction_item_id: UUID
    bidder_number: int
    bid_amount: Decimal
    transaction_status: TransactionStatus
    placed_at: datetime


class BidderAnalyticsReportItem(BaseModel):
    bidder_number: int
    total_won: Decimal
    total_lost: Decimal
    total_unprocessed: Decimal
    total_max_potential: Decimal
    live_total: Decimal
    silent_total: Decimal
    paddle_raise_total: Decimal
    bidding_war_count: int
    proxy_usage_rate: Decimal


class ItemPerformanceReportItem(BaseModel):
    auction_item_id: UUID
    total_bids: int
    unique_bidders: int
    starting_bid: Decimal
    final_price: Decimal
    revenue_total: Decimal
    proxy_used: bool


class BiddingWarReportItem(BaseModel):
    auction_item_id: UUID
    participant_count: int
    bid_frequency: Decimal
    escalation_amount: Decimal
    intensity_score: Decimal
    manual_vs_proxy_ratio: Decimal


class HighValueDonorReportItem(BaseModel):
    bidder_number: int
    total_giving_potential: Decimal
    winning_total: Decimal
    paddle_raise_total: Decimal


class WinningBidsReportResponse(BaseModel):
    generated_at: datetime
    items: list[WinningBidReportItem]


class UnprocessedTransactionsReportResponse(BaseModel):
    generated_at: datetime
    items: list[UnprocessedTransactionReportItem]


class BidderAnalyticsReportResponse(BaseModel):
    generated_at: datetime
    items: list[BidderAnalyticsReportItem]


class ItemPerformanceReportResponse(BaseModel):
    generated_at: datetime
    items: list[ItemPerformanceReportItem]


class BiddingWarsReportResponse(BaseModel):
    generated_at: datetime
    items: list[BiddingWarReportItem]


class HighValueDonorReportResponse(BaseModel):
    generated_at: datetime
    items: list[HighValueDonorReportItem]
