"""Auction item models for live and silent auctions."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.sponsor import Sponsor
    from app.models.user import User


class AuctionType(str, enum.Enum):
    """Auction type enumeration."""

    LIVE = "live"
    SILENT = "silent"


class ItemStatus(str, enum.Enum):
    """Auction item status."""

    DRAFT = "draft"
    PUBLISHED = "published"
    SOLD = "sold"
    WITHDRAWN = "withdrawn"


class MediaType(str, enum.Enum):
    """Media file type."""

    IMAGE = "image"
    VIDEO = "video"


class AuctionItem(Base, UUIDMixin, TimestampMixin):
    """Auction item model."""

    __tablename__ = "auction_items"

    # Relationships
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sponsor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sponsors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Core fields
    external_id: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
        default=lambda: str(uuid.uuid4()),
    )
    bid_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    auction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Pricing
    starting_bid: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    bid_increment: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("50.00"),
        server_default="50.00",
    )
    donor_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    buy_now_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    buy_now_enabled: Mapped[bool] = mapped_column(
        default=False,
        server_default="false",
        nullable=False,
    )

    # Additional fields
    quantity_available: Mapped[int] = mapped_column(
        Integer,
        default=1,
        server_default="1",
        nullable=False,
    )
    donated_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    item_webpage: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        default=ItemStatus.DRAFT.value,
        server_default=ItemStatus.DRAFT.value,
        nullable=False,
    )
    display_priority: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Bidding state (for donor UI)
    current_bid_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    min_next_bid_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    bid_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        nullable=False,
    )
    bidding_open: Mapped[bool] = mapped_column(
        default=False,
        server_default="false",
        nullable=False,
    )

    # Engagement metrics
    watcher_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        nullable=False,
    )

    # Promotion fields
    promotion_badge: Mapped[str | None] = mapped_column(String(50), nullable=True)
    promotion_notice: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Soft delete
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    # SQLAlchemy relationships
    event: Mapped["Event"] = relationship("Event", back_populates="auction_items")
    sponsor: Mapped["Sponsor | None"] = relationship("Sponsor", lazy="select")
    media: Mapped[list["AuctionItemMedia"]] = relationship(
        "AuctionItemMedia",
        back_populates="auction_item",
        cascade="all, delete-orphan",
        order_by="AuctionItemMedia.display_order",
    )
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])

    # Constraints (documented in migration)
    __table_args__ = (
        UniqueConstraint("event_id", "external_id", name="uq_auction_items_event_external_id"),
        CheckConstraint("auction_type IN ('live', 'silent')", name="ck_auction_items_auction_type"),
        CheckConstraint(
            "status IN ('draft', 'published', 'sold', 'withdrawn')",
            name="ck_auction_items_status",
        ),
        CheckConstraint("starting_bid >= 0", name="ck_auction_items_starting_bid_nonnegative"),
        CheckConstraint("bid_increment > 0", name="ck_auction_items_bid_increment_positive"),
        CheckConstraint(
            "donor_value IS NULL OR donor_value >= 0",
            name="ck_auction_items_donor_value_nonnegative",
        ),
        CheckConstraint("cost IS NULL OR cost >= 0", name="ck_auction_items_cost_nonnegative"),
        CheckConstraint(
            "buy_now_price IS NULL OR buy_now_price >= starting_bid",
            name="ck_auction_items_buy_now_price_min",
        ),
        CheckConstraint("quantity_available >= 1", name="ck_auction_items_quantity_min"),
        CheckConstraint(
            "(buy_now_enabled = false) OR (buy_now_enabled = true AND buy_now_price IS NOT NULL)",
            name="ck_auction_items_buy_now_consistency",
        ),
    )


class AuctionItemMedia(Base, UUIDMixin, TimestampMixin):
    """Auction item media (images/videos)."""

    __tablename__ = "auction_item_media"

    auction_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auction_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    media_type: Mapped[str] = mapped_column(String(20), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        nullable=False,
    )
    thumbnail_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    auction_item: Mapped["AuctionItem"] = relationship("AuctionItem", back_populates="media")

    # Constraints
    __table_args__ = (
        CheckConstraint("media_type IN ('image', 'video')", name="ck_auction_item_media_type"),
        CheckConstraint("file_size > 0", name="ck_auction_item_media_file_size_positive"),
    )
