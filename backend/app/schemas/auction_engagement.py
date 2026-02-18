"""Pydantic schemas for admin engagement analytics."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class UserSummary(BaseModel):
    """Summary of a user for engagement views."""

    user_id: UUID
    display_name: str
    email: str | None

    model_config = {"from_attributes": True}


class WatcherSummary(BaseModel):
    """Summary of a watcher for admin engagement view."""

    user_id: UUID
    user_name: str
    email: str | None
    watching_since: datetime

    model_config = {"from_attributes": True}


class BidSummary(BaseModel):
    """Summary of a bid for admin engagement view."""

    bid_id: UUID
    user_id: UUID
    user_name: str
    bidder_number: int
    amount: Decimal
    is_max_bid: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminEngagementResponse(BaseModel):
    """Response schema for admin engagement data."""

    watchers: list[WatcherSummary]
    views: list["ItemViewSummary"]
    bids: list[BidSummary]
    total_views: int
    total_view_duration_seconds: int
    unique_viewers: int


# Import after class definitions to avoid circular imports
from app.schemas.item_view import ItemViewSummary  # noqa: E402

AdminEngagementResponse.model_rebuild()
