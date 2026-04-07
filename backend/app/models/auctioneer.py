"""Auctioneer models for commission tracking and event settings."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.auction_item import AuctionItem
    from app.models.event import Event
    from app.models.user import User


class AuctioneerItemCommission(Base):
    """Per-auctioneer, per-item commission and fee tracking.

    Only visible to the owning auctioneer and Super Admins.
    """

    __tablename__ = "auctioneer_item_commissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    auctioneer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    auction_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auction_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    commission_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
    )
    flat_fee: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0"),
        server_default="0",
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    auctioneer: Mapped["User"] = relationship("User", foreign_keys=[auctioneer_user_id])
    auction_item: Mapped["AuctionItem"] = relationship("AuctionItem")

    __table_args__ = (
        UniqueConstraint(
            "auctioneer_user_id",
            "auction_item_id",
            name="uq_auctioneer_item_commission",
        ),
        CheckConstraint(
            "commission_percent >= 0 AND commission_percent <= 100",
            name="ck_commission_percent_range",
        ),
        CheckConstraint(
            "flat_fee >= 0",
            name="ck_flat_fee_nonnegative",
        ),
    )


class AuctioneerEventSettings(Base):
    """Per-auctioneer, per-event category-level earning percentages."""

    __tablename__ = "auctioneer_event_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    auctioneer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    live_auction_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("0"),
        server_default="0",
    )
    paddle_raise_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("0"),
        server_default="0",
    )
    silent_auction_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("0"),
        server_default="0",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    auctioneer: Mapped["User"] = relationship("User", foreign_keys=[auctioneer_user_id])
    event: Mapped["Event"] = relationship("Event")

    __table_args__ = (
        UniqueConstraint(
            "auctioneer_user_id",
            "event_id",
            name="uq_auctioneer_event_settings",
        ),
        CheckConstraint(
            "live_auction_percent >= 0 AND live_auction_percent <= 100",
            name="ck_live_auction_percent_range",
        ),
        CheckConstraint(
            "paddle_raise_percent >= 0 AND paddle_raise_percent <= 100",
            name="ck_paddle_raise_percent_range",
        ),
        CheckConstraint(
            "silent_auction_percent >= 0 AND silent_auction_percent <= 100",
            name="ck_silent_auction_percent_range",
        ),
    )
