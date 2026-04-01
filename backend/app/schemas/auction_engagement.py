"""Pydantic schemas for admin engagement analytics."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UserSummary(BaseModel):
    """Summary of a user for engagement views."""

    id: UUID
    name: str
    email: str | None = None

    model_config = {"from_attributes": True}


class WatcherSummary(BaseModel):
    """Summary of a watcher for admin engagement view."""

    user: UserSummary
    watching_since: datetime

    model_config = {"from_attributes": True}


class BidSummary(BaseModel):
    """Summary of a bid for admin engagement view."""

    id: UUID
    user: UserSummary
    amount: float
    bid_type: str
    placed_at: datetime

    model_config = {"from_attributes": True}


class EngagementSummary(BaseModel):
    """Aggregate engagement statistics."""

    total_watchers: int
    total_views: int
    unique_viewers: int
    total_view_duration_seconds: int
    total_bids: int


class AdminEngagementResponse(BaseModel):
    """Response schema for admin engagement data."""

    auction_item_id: UUID
    watchers: list[WatcherSummary]
    views: list["ItemViewSummary"]
    bids: list[BidSummary]
    summary: EngagementSummary


# Import after class definitions to avoid circular imports
from app.schemas.item_view import ItemViewSummary  # noqa: E402

AdminEngagementResponse.model_rebuild()
