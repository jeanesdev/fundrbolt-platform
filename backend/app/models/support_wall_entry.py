"""SupportWallEntry model for donate-now support wall messages."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.npo import NPO
    from app.models.npo_donation import NpoDonation


class SupportWallEntry(Base, UUIDMixin):
    """A supporter message/entry on the NPO donate-now support wall."""

    __tablename__ = "support_wall_entries"

    donation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npo_donations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    show_amount: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    message: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_hidden: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    donation: Mapped["NpoDonation"] = relationship(
        "NpoDonation", back_populates="support_wall_entry"
    )
    npo: Mapped["NPO"] = relationship("NPO", foreign_keys=[npo_id])

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"<SupportWallEntry(id={self.id}, npo_id={self.npo_id}, anonymous={self.is_anonymous})>"
        )
