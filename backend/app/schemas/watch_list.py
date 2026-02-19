"""Pydantic schemas for watch list functionality."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class WatchListEntryCreate(BaseModel):
    """Schema for creating a watch list entry."""

    item_id: UUID


class WatchListEntryResponse(BaseModel):
    """Schema for watch list entry response."""

    id: UUID
    item_id: UUID
    event_id: UUID
    user_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class WatchListResponse(BaseModel):
    """Schema for watch list response with items."""

    items: list["AuctionItemSummary"]
    total: int


# Circular import handled via string annotation and late import
from app.schemas.auction_gallery import AuctionItemSummary  # noqa: E402

WatchListResponse.model_rebuild()
