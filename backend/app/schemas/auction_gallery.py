"""Pydantic schemas for auction gallery view (donor PWA)."""

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class AuctionItemSummary(BaseModel):
    """Summary schema for auction items in gallery view."""

    id: UUID
    title: str
    current_bid_amount: Decimal | None
    min_next_bid_amount: Decimal | None
    bid_count: int
    bidding_open: bool
    watcher_count: int
    buy_now_enabled: bool
    buy_now_price: Decimal | None
    quantity_available: int
    promotion_badge: str | None
    promotion_notice: str | None
    primary_image_url: str | None

    model_config = {"from_attributes": True}


class AuctionGalleryResponse(BaseModel):
    """Response schema for auction gallery."""

    items: list[AuctionItemSummary]
    total: int
