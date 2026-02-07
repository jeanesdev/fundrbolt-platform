"""Auction bid import batch tracking model."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.user import User


class ImportBatchStatus(str, enum.Enum):
    """Import batch status enumeration."""

    PREFLIGHTED = "preflighted"
    COMPLETED = "completed"
    FAILED = "failed"


class AuctionBidImportBatch(Base, UUIDMixin, TimestampMixin):
    """Track auction bid import batches."""

    __tablename__ = "auction_bid_import_batches"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    initiated_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(String(20), nullable=False)
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False)
    valid_rows: Mapped[int] = mapped_column(Integer, nullable=False)
    invalid_rows: Mapped[int] = mapped_column(Integer, nullable=False)
    created_bids: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    validation_errors: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    import_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    preflighted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    event: Mapped["Event"] = relationship("Event")
    initiated_by: Mapped["User"] = relationship("User")

    __table_args__ = (
        CheckConstraint(
            "status IN ('preflighted', 'completed', 'failed')",
            name="ck_auction_bid_import_batches_status",
        ),
    )
