"""Schemas for auction bid import."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class AuctionBidImportIssueSeverity(str, Enum):
    """Severity level for auction bid import issues."""

    ERROR = "error"
    WARNING = "warning"


class AuctionBidImportIssue(BaseModel):
    """Row-level validation issue for auction bid import."""

    row_number: int = Field(..., ge=1)
    field_name: str | None = None
    severity: AuctionBidImportIssueSeverity
    message: str
    raw_value: str | None = None


class AuctionBidPreflightResult(BaseModel):
    """Preflight validation summary for auction bid import."""

    import_batch_id: str
    detected_format: str
    total_rows: int = Field(..., ge=0)
    valid_rows: int = Field(..., ge=0)
    invalid_rows: int = Field(..., ge=0)
    warning_rows: int = Field(..., ge=0)
    row_errors: list[AuctionBidImportIssue] = Field(default_factory=list)
    row_warnings: list[AuctionBidImportIssue] = Field(default_factory=list)
    error_report_url: str | None = Field(
        None, description="Optional URL for downloadable error report"
    )


class AuctionBidImportSummary(BaseModel):
    """Import summary for confirmed auction bid import."""

    import_batch_id: str
    created_bids: int = Field(..., ge=0)
    skipped_bids: int = Field(..., ge=0)
    started_at: datetime
    completed_at: datetime


class AuctionBidDashboardHighestBid(BaseModel):
    auction_item_id: UUID
    auction_item_code: str
    auction_item_title: str
    bid_amount: Decimal
    bidder_name: str
    bidder_email: str


class AuctionBidDashboardRecentBid(BaseModel):
    auction_item_id: UUID
    auction_item_code: str
    auction_item_title: str
    bid_amount: Decimal
    bidder_name: str
    bidder_email: str
    bid_time: datetime


class AuctionBidDashboardResponse(BaseModel):
    total_bid_count: int
    total_bid_value: Decimal
    highest_bids: list[AuctionBidDashboardHighestBid]
    recent_bids: list[AuctionBidDashboardRecentBid]


class AuctionBidImportConfirmRequest(BaseModel):
    import_batch_id: UUID
