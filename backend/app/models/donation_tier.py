"""DonationTier model for pre-set donation amounts on the donate-now page."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.donate_now_config import DonateNowPageConfig


class DonationTier(Base, UUIDMixin):
    """Pre-set donation amount tier for the donate-now page."""

    __tablename__ = "donation_tiers"
    __table_args__ = (
        CheckConstraint("amount_cents > 0", name="ck_donation_tiers_amount_positive"),
    )

    config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donate_now_page_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount_cents: Mapped[int] = mapped_column(Integer(), nullable=False)
    impact_statement: Mapped[str | None] = mapped_column(String(200), nullable=True)
    display_order: Mapped[int] = mapped_column(SmallInteger(), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    config: Mapped["DonateNowPageConfig"] = relationship(
        "DonateNowPageConfig",
        back_populates="tiers",
    )

    def __repr__(self) -> str:
        """Return string representation."""
        return f"<DonationTier(id={self.id}, amount_cents={self.amount_cents})>"
