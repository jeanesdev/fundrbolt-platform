"""Auction bid models for live and silent auctions."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.auction_item import AuctionItem
    from app.models.event import Event
    from app.models.user import User


class BidType(str, enum.Enum):
    """Bid type enumeration."""

    REGULAR = "regular"
    BUY_NOW = "buy_now"
    PROXY_AUTO = "proxy_auto"


class BidStatus(str, enum.Enum):
    """Bid status enumeration."""

    ACTIVE = "active"
    OUTBID = "outbid"
    WINNING = "winning"
    CANCELLED = "cancelled"
    WITHDRAWN = "withdrawn"


class TransactionStatus(str, enum.Enum):
    """Transaction status enumeration."""

    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"
    REFUNDED = "refunded"


class BidActionType(str, enum.Enum):
    """Administrative action types for bids."""

    MARK_WINNING = "mark_winning"
    ADJUST_AMOUNT = "adjust_amount"
    CANCEL = "cancel"
    OVERRIDE_PAYMENT = "override_payment"


class AuctionBid(Base, UUIDMixin, TimestampMixin):
    """Auction bid record (immutable)."""

    __tablename__ = "auction_bids"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    auction_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auction_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    bidder_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    bid_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    max_bid: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    bid_type: Mapped[str] = mapped_column(String(20), nullable=False)
    bid_status: Mapped[str] = mapped_column(String(20), nullable=False)
    transaction_status: Mapped[str] = mapped_column(String(20), nullable=False)

    placed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_bid_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auction_bids.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    event: Mapped[Event] = relationship("Event")
    auction_item: Mapped[AuctionItem] = relationship("AuctionItem")
    user: Mapped[User] = relationship("User", foreign_keys=[user_id])
    source_bid: Mapped[AuctionBid | None] = relationship(
        "AuctionBid",
        remote_side="AuctionBid.id",
        uselist=False,
    )

    __table_args__ = (
        CheckConstraint("bid_amount >= 0", name="ck_auction_bids_amount_nonnegative"),
        CheckConstraint(
            "max_bid IS NULL OR max_bid >= bid_amount",
            name="ck_auction_bids_max_bid_min",
        ),
        CheckConstraint(
            "bid_type IN ('regular', 'buy_now', 'proxy_auto')",
            name="ck_auction_bids_bid_type",
        ),
        CheckConstraint(
            "bid_status IN ('active', 'outbid', 'winning', 'cancelled', 'withdrawn')",
            name="ck_auction_bids_bid_status",
        ),
        CheckConstraint(
            "transaction_status IN ('pending', 'processing', 'processed', 'failed', 'refunded')",
            name="ck_auction_bids_transaction_status",
        ),
    )


class BidActionAudit(Base, UUIDMixin, TimestampMixin):
    """Administrative actions applied to bids."""

    __tablename__ = "auction_bid_actions"

    bid_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auction_bids.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    action_type: Mapped[str] = mapped_column(String(30), nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    action_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata",
        JSON,
        nullable=True,
    )

    bid: Mapped[AuctionBid] = relationship("AuctionBid")
    actor: Mapped[User] = relationship("User", foreign_keys=[actor_user_id])

    __table_args__ = (
        CheckConstraint(
            "action_type IN ('mark_winning', 'adjust_amount', 'cancel', 'override_payment')",
            name="ck_auction_bid_actions_action_type",
        ),
    )


class PaddleRaiseContribution(Base, UUIDMixin, TimestampMixin):
    """Paddle raise contribution record."""

    __tablename__ = "paddle_raise_contributions"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    bidder_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    tier_name: Mapped[str] = mapped_column(String(100), nullable=False)
    placed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    event: Mapped[Event] = relationship("Event")
    user: Mapped[User] = relationship("User")

    __table_args__ = (CheckConstraint("amount >= 0", name="ck_paddle_raise_amount_nonnegative"),)
