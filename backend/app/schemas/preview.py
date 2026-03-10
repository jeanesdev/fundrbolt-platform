"""Pydantic schemas for event preview."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.auction_item import AuctionItemDetail
from app.schemas.event import EventDetailResponse
from app.schemas.sponsor import SponsorResponse


class PreviewTokenRequest(BaseModel):
    """Request schema for generating a preview token (empty body, event_id from path)."""

    pass


class PreviewTokenResponse(BaseModel):
    """Response schema for a generated preview token."""

    token: str = Field(..., description="Short-lived JWT preview token (30-minute expiry)")
    event_id: uuid.UUID = Field(
        ..., description="ID of the event this token grants preview access to"
    )
    expires_at: datetime = Field(..., description="Token expiration timestamp")


class PreviewEventResponse(BaseModel):
    """Bundled response for previewing an event as a donor.

    Includes all data needed to render the full donor experience
    in a single request, avoiding multiple authenticated API calls.
    """

    event: EventDetailResponse = Field(..., description="Full event details")
    auction_items: list[AuctionItemDetail] = Field(
        default_factory=list,
        description="Auction items for the event with gallery/detail fields for preview mode",
    )
    sponsors: list[SponsorResponse] = Field(
        default_factory=list,
        description="Event sponsors",
    )
