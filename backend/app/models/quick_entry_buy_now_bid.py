"""Quick-entry buy-it-now bid model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.auction_item import AuctionItem
    from app.models.event import Event
    from app.models.user import User


class QuickEntryBuyNowBid(Base, UUIDMixin, TimestampMixin):
    """Stores quick-entry buy-it-now bid submissions."""

    __tablename__ = "quick_entry_buy_now_bids"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auction_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bidder_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    donor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    entered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    entered_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    event: Mapped[Event] = relationship("Event")
    item: Mapped[AuctionItem] = relationship("AuctionItem")
    donor: Mapped[User | None] = relationship("User", foreign_keys=[donor_user_id])
    entered_by: Mapped[User] = relationship("User", foreign_keys=[entered_by_user_id])

    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_quick_entry_buy_now_bids_amount_positive",
        ),
        CheckConstraint(
            "bidder_number > 0",
            name="ck_quick_entry_buy_now_bids_bidder_number_positive",
        ),
    )
