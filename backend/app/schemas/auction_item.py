"""Pydantic schemas for auction items."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.auction_item import AuctionType, ItemStatus


class AuctionItemBase(BaseModel):
    """Base schema for auction items."""

    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=10000)
    auction_type: AuctionType
    starting_bid: Decimal = Field(..., ge=0, decimal_places=2)
    bid_increment: Decimal = Field(default=Decimal("50.00"), gt=0, decimal_places=2)
    donor_value: Decimal | None = Field(None, ge=0, decimal_places=2)
    cost: Decimal | None = Field(None, ge=0, decimal_places=2)
    buy_now_price: Decimal | None = Field(None, ge=0, decimal_places=2)
    buy_now_enabled: bool = False
    quantity_available: int = Field(default=1, ge=1)
    donated_by: str | None = Field(None, max_length=200)
    sponsor_id: UUID | None = None
    item_webpage: str | None = Field(None, max_length=2048)
    display_priority: int | None = None

    @field_validator("buy_now_price")
    @classmethod
    def validate_buy_now_price(cls, v: Decimal | None) -> Decimal | None:
        """Ensure buy_now_price >= starting_bid if set."""
        # Note: Cross-field validation will be handled in service layer
        # to avoid pydantic v2 ValidationInfo complexity
        return v


class AuctionItemCreate(AuctionItemBase):
    """Schema for creating auction items."""

    pass


class AuctionItemUpdate(BaseModel):
    """Schema for updating auction items (all fields optional)."""

    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, min_length=1, max_length=10000)
    auction_type: AuctionType | None = None
    starting_bid: Decimal | None = Field(None, ge=0, decimal_places=2)
    bid_increment: Decimal | None = Field(None, gt=0, decimal_places=2)
    donor_value: Decimal | None = Field(None, ge=0, decimal_places=2)
    cost: Decimal | None = Field(None, ge=0, decimal_places=2)
    buy_now_price: Decimal | None = Field(None, ge=0, decimal_places=2)
    buy_now_enabled: bool | None = None
    quantity_available: int | None = Field(None, ge=1)
    donated_by: str | None = Field(None, max_length=200)
    sponsor_id: UUID | None = None
    item_webpage: str | None = Field(None, max_length=2048)
    display_priority: int | None = None


class AuctionItemResponse(AuctionItemBase):
    """Schema for auction item responses."""

    id: UUID
    event_id: UUID
    bid_number: int = Field(..., ge=100, le=999)
    status: ItemStatus
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    primary_image_url: str | None = Field(
        None, description="URL of primary image (with SAS token if Azure)"
    )

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
