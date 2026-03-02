"""Watch list entry models for auction items."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.auction_item import AuctionItem
    from app.models.event import Event
    from app.models.user import User


class WatchListEntry(Base, UUIDMixin, TimestampMixin):
    """Watch list entry for auction items."""

    __tablename__ = "watch_list_entries"

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

    # SQLAlchemy relationships
    auction_item: Mapped["AuctionItem"] = relationship("AuctionItem")
    event: Mapped["Event"] = relationship("Event")
    user: Mapped["User"] = relationship("User")

    # Constraints
    __table_args__ = (UniqueConstraint("item_id", "user_id", name="uq_watch_list_item_user"),)
