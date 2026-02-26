"""Pydantic schemas for quick-entry workflows."""

from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class QuickEntryMode(str, Enum):
    """Operational mode for quick-entry page."""

    LIVE_AUCTION = "LIVE_AUCTION"
    PADDLE_RAISE = "PADDLE_RAISE"


class QuickEntryBidCreateRequest(BaseModel):
    """Request payload for creating a quick-entry live auction bid."""

    item_id: UUID
    amount: int = Field(..., ge=1)
    bidder_number: int = Field(..., ge=1)


class QuickEntryPaddleDonationCreateRequest(BaseModel):
    """Request payload for creating a quick-entry paddle raise donation."""

    amount: int = Field(..., ge=1)
    bidder_number: int = Field(..., ge=1)
    label_ids: list[UUID] = Field(default_factory=list)
    custom_label: str | None = Field(default=None, max_length=80)


class QuickEntryBidResponse(BaseModel):
    """Lightweight response for quick-entry bid records."""

    id: UUID
    event_id: UUID
    item_id: UUID
    amount: int
    bidder_number: int
    donor_name: str | None = None
    table_number: str | None = None
    accepted_at: datetime


class QuickEntryBidLogItem(BaseModel):
    """Bid-log row for quick-entry live auction summary."""

    id: UUID
    amount: int
    bidder_number: int
    donor_name: str | None = None
    table_number: str | None = None
    accepted_at: datetime
    status: str


class QuickEntryLiveSummaryResponse(BaseModel):
    """Live auction summary and bid log payload."""

    mode: Literal["LIVE_AUCTION"] = "LIVE_AUCTION"
    item_id: UUID
    current_highest_bid: int = 0
    bid_count: int = 0
    unique_bidder_count: int = 0
    bids: list[QuickEntryBidLogItem] = Field(default_factory=list)
    updated_at: datetime


class AssignWinnerRequest(BaseModel):
    """Request payload for explicit winner assignment confirmation."""

    confirm: bool


class QuickEntryWinnerAssignmentResponse(BaseModel):
    """Response payload when winner assignment completes."""

    item_id: UUID
    winner_bid_id: UUID
    winning_amount: int
    winner_bidder_number: int
    assigned_at: datetime


class QuickEntryPaddleDonationLabel(BaseModel):
    """Label output for quick-entry paddle raise donations."""

    label: str


class QuickEntryPaddleDonationResponse(BaseModel):
    """Response payload for quick-entry paddle raise donation create."""

    id: UUID
    event_id: UUID
    amount: int
    bidder_number: int
    donor_name: str | None = None
    entered_at: datetime
    entered_by: UUID
    labels: list[QuickEntryPaddleDonationLabel] = Field(default_factory=list)


class QuickEntryPaddleAmountLevel(BaseModel):
    """Grouped paddle-raise count by amount level."""

    amount: int
    count: int


class QuickEntryPaddleSummaryResponse(BaseModel):
    """Paddle raise summary metrics payload."""

    mode: Literal["PADDLE_RAISE"] = "PADDLE_RAISE"
    total_pledged: int = 0
    donation_count: int = 0
    unique_donor_count: int = 0
    participation_percent: float = 0.0
    by_amount_level: list[QuickEntryPaddleAmountLevel] = Field(default_factory=list)
    updated_at: datetime


class QuickEntryDonationLabelResponse(BaseModel):
    """Selectable donation label for quick-entry paddle raise mode."""

    id: UUID
    name: str


class QuickEntryDonationLabelListResponse(BaseModel):
    """List response for selectable quick-entry donation labels."""

    items: list[QuickEntryDonationLabelResponse]
