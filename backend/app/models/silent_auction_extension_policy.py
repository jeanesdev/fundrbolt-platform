"""Event-level silent auction extension policy and item timing state models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.auction_item import AuctionItem
    from app.models.event import Event


class SilentAuctionExtensionPolicy(Base, UUIDMixin, TimestampMixin):
    """Event-level anti-sniping extension policy."""

    __tablename__ = "silent_auction_extension_policies"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    auto_extension_enabled: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
        server_default="true",
    )
    trigger_window_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
        server_default="3",
    )
    extension_duration_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
        server_default="3",
    )
    max_total_extension_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=30,
        server_default="30",
    )
    updated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    event: Mapped[Event] = relationship("Event", back_populates="silent_auction_extension_policy")

    __table_args__ = (
        CheckConstraint("trigger_window_minutes > 0", name="ck_saep_trigger_window_positive"),
        CheckConstraint(
            "extension_duration_minutes BETWEEN 1 AND 10",
            name="ck_saep_extension_duration_range",
        ),
        CheckConstraint(
            "max_total_extension_minutes BETWEEN 0 AND 60",
            name="ck_saep_max_total_extension_range",
        ),
    )


class SilentAuctionItemExtensionState(Base, UUIDMixin, TimestampMixin):
    """Per-item extension timing state for silent auction anti-sniping."""

    __tablename__ = "silent_auction_item_extension_states"

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
    original_close_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    effective_close_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_extension_minutes_applied: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    event: Mapped[Event] = relationship("Event")
    auction_item: Mapped[AuctionItem] = relationship("AuctionItem")

    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "auction_item_id",
            name="uq_saies_event_item",
        ),
        CheckConstraint(
            "total_extension_minutes_applied >= 0",
            name="ck_saies_total_extension_nonnegative",
        ),
    )
