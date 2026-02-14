"""Item view tracking models for auction items."""

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


class ItemView(Base, UUIDMixin, TimestampMixin):
    """Item view tracking for engagement analytics."""

    __tablename__ = "item_views"

    # Relationships
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auction_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # View tracking
    view_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    view_duration_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    # SQLAlchemy relationships
    auction_item: Mapped["AuctionItem"] = relationship("AuctionItem")
    event: Mapped["Event"] = relationship("Event")
    user: Mapped["User"] = relationship("User")

    # Constraints
    __table_args__ = (
        CheckConstraint("view_duration_seconds >= 0", name="ck_item_views_duration_nonnegative"),
    )
