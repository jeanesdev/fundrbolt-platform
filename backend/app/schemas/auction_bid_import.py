"""Pydantic schemas for auction bid import."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class ImportRowStatus(str, Enum):
    """Status of an import row."""

    VALID = "valid"
    ERROR = "error"
    SKIPPED = "skipped"


class BidImportRow(BaseModel):
    """Schema for a single bid import row."""

    donor_email: str = Field(..., max_length=255)
    auction_item_code: str = Field(..., max_length=200)
    bid_amount: Decimal = Field(..., ge=0, decimal_places=2)
    bid_time: datetime


class ImportRowResult(BaseModel):
    """Result of validating a single row."""

    row_number: int
    donor_email: str | None
    auction_item_code: str | None
    bid_amount: Decimal | None
    status: ImportRowStatus
    message: str


class PreflightResult(BaseModel):
    """Result of preflight validation."""

    import_batch_id: str
    total_rows: int
    valid_rows: int
    invalid_rows: int
    row_errors: list[ImportRowResult]


class ImportSummary(BaseModel):
    """Summary of completed import."""

    import_batch_id: str
    created_bids: int
    started_at: datetime
    completed_at: datetime


class HighestBid(BaseModel):
    """Highest bid for an auction item."""

    auction_item_code: str
    bid_amount: Decimal
    bidder_email: str


class RecentBid(BaseModel):
    """Recent bid information."""

    auction_item_code: str
    bid_amount: Decimal
    bidder_email: str
    bid_time: datetime


class BidsDashboard(BaseModel):
    """Dashboard summary for auction bids."""

    total_bid_count: int
    total_bid_value: Decimal
    highest_bids: list[HighestBid]
    recent_bids: list[RecentBid]
