"""Pydantic schemas for auction items."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

import bleach
from bleach.css_sanitizer import CSSSanitizer
from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.auction_item import AuctionType, ItemStatus, SlidePresentationLayout

_ALLOWED_SLIDE_TAGS = ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "span"]
_ALLOWED_SLIDE_ATTRS = {"p": ["style"], "span": ["style"]}
_ALLOWED_SLIDE_CSS = ["color", "font-family", "text-align"]
_SLIDE_CSS_SANITIZER = CSSSanitizer(allowed_css_properties=_ALLOWED_SLIDE_CSS)


def _sanitize_slide_html(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = bleach.clean(
        value,
        tags=_ALLOWED_SLIDE_TAGS,
        attributes=_ALLOWED_SLIDE_ATTRS,
        css_sanitizer=_SLIDE_CSS_SANITIZER,
        strip=True,
    ).strip()
    return cleaned or None


class AuctionItemBase(BaseModel):
    """Base schema for auction items."""

    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=10000)
    auction_type: AuctionType
    category: str | None = Field(None, max_length=100)
    starting_bid: Decimal | None = Field(None, ge=0, decimal_places=2)
    bid_increment: Decimal | None = Field(None, gt=0, decimal_places=2)
    donor_value: Decimal | None = Field(None, ge=0, decimal_places=2)
    cost: Decimal | None = Field(None, ge=0, decimal_places=2)
    buy_now_price: Decimal | None = Field(None, ge=0, decimal_places=2)
    buy_now_enabled: bool = False
    quantity_available: int = Field(default=1, ge=0)
    donated_by: str | None = Field(None, max_length=200)
    sponsor_id: UUID | None = None
    item_webpage: str | None = Field(None, max_length=2048)
    display_priority: int | None = None
    slide_presentation_html: str | None = Field(None, max_length=20000)
    slide_presentation_layout: SlidePresentationLayout = SlidePresentationLayout.BELOW_IMAGE
    display_starting_bid: bool = Field(
        default=False, description="Whether to display starting bid on donor-facing pages"
    )
    display_fair_market_value: bool = Field(
        default=False, description="Whether to display fair market value on donor-facing pages"
    )

    @field_validator("buy_now_price")
    @classmethod
    def validate_buy_now_price(cls, v: Decimal | None) -> Decimal | None:
        """Ensure buy_now_price >= starting_bid if set."""
        # Note: Cross-field validation will be handled in service layer
        # to avoid pydantic v2 ValidationInfo complexity
        return v

    @field_validator("slide_presentation_html")
    @classmethod
    def validate_slide_presentation_html(cls, value: str | None) -> str | None:
        return _sanitize_slide_html(value)

    @model_validator(mode="after")
    def validate_auction_type_requirements(self) -> "AuctionItemBase":
        if self.auction_type == AuctionType.SILENT:
            if self.starting_bid is None:
                raise ValueError("starting_bid is required for silent auctions")
            if self.bid_increment is None:
                # Backward-compatible default used by persisted model and existing API tests.
                self.bid_increment = Decimal("50.00")
        return self


class AuctionItemCreate(AuctionItemBase):
    """Schema for creating auction items."""

    external_id: str | None = Field(None, min_length=1, max_length=200)


class AuctionItemUpdate(BaseModel):
    """Schema for updating auction items (all fields optional)."""

    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, min_length=1, max_length=10000)
    auction_type: AuctionType | None = None
    category: str | None = Field(None, max_length=100)
    starting_bid: Decimal | None = Field(None, ge=0, decimal_places=2)
    bid_increment: Decimal | None = Field(None, gt=0, decimal_places=2)
    donor_value: Decimal | None = Field(None, ge=0, decimal_places=2)
    cost: Decimal | None = Field(None, ge=0, decimal_places=2)
    buy_now_price: Decimal | None = Field(None, ge=0, decimal_places=2)
    buy_now_enabled: bool | None = None
    quantity_available: int | None = Field(None, ge=0)
    donated_by: str | None = Field(None, max_length=200)
    sponsor_id: UUID | None = None
    item_webpage: str | None = Field(None, max_length=2048)
    display_priority: int | None = None
    slide_presentation_html: str | None = Field(None, max_length=20000)
    slide_presentation_layout: SlidePresentationLayout | None = None
    display_starting_bid: bool | None = Field(
        None, description="Whether to display starting bid on donor-facing pages"
    )
    display_fair_market_value: bool | None = Field(
        None, description="Whether to display fair market value on donor-facing pages"
    )

    @field_validator("slide_presentation_html")
    @classmethod
    def validate_slide_presentation_html(cls, value: str | None) -> str | None:
        return _sanitize_slide_html(value)


class AuctionItemResponse(AuctionItemBase):
    """Schema for auction item responses."""

    id: UUID
    event_id: UUID
    external_id: str
    category: str | None = None
    bid_number: int = Field(..., ge=100, le=999)
    status: ItemStatus
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    primary_image_url: str | None = Field(
        None, description="URL of primary image (with SAS token if Azure)"
    )

    # Bidding state fields
    current_bid_amount: Decimal | None = None
    min_next_bid_amount: Decimal | None = None
    bid_count: int = 0
    bidding_open: bool = False
    original_close_at: datetime | None = None
    effective_close_at: datetime | None = None

    # Engagement and promotion fields
    watcher_count: int = 0
    buy_now_purchased_count: int = 0
    promotion_badge: str | None = None
    promotion_notice: str | None = None
    slide_presentation_html: str | None = None
    slide_presentation_layout: SlidePresentationLayout = SlidePresentationLayout.BELOW_IMAGE

    model_config = {"from_attributes": True}


class AuctionItemDetail(AuctionItemResponse):
    """Schema for detailed auction item response with media and sponsor."""

    media: list["MediaResponse"] = Field(
        default_factory=list, description="Media items with SAS URLs"
    )
    # Sponsor will be added when we integrate sponsor display

    model_config = {"from_attributes": True}


# Import MediaResponse for forward reference
from app.schemas.auction_item_media import MediaResponse  # noqa: E402

# Rebuild model to resolve forward references
AuctionItemDetail.model_rebuild()


class AuctionItemListResponse(BaseModel):
    """Schema for paginated list of auction items."""

    items: list[AuctionItemResponse]
    pagination: "PaginationInfo"

    model_config = {"from_attributes": True}


class PaginationInfo(BaseModel):
    """Schema for pagination metadata."""

    page: int = Field(..., ge=1)
    limit: int = Field(..., ge=1, le=100)
    total: int = Field(..., ge=0)
    pages: int = Field(..., ge=0)

    model_config = {"from_attributes": True}
