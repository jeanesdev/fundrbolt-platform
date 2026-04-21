"""DonateNowPageConfig model for per-NPO donate-now page configuration."""

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.donation_tier import DonationTier
    from app.models.npo import NPO
    from app.models.npo_donation import NpoDonation


class DonateNowPageConfig(Base, UUIDMixin, TimestampMixin):
    """Per-NPO configuration for the public donate-now page."""

    __tablename__ = "donate_now_page_configs"

    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    donate_plea_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hero_media_url: Mapped[str | None] = mapped_column(Text(), nullable=True)
    hero_transition_style: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="documentary_style",
    )
    processing_fee_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 4),
        nullable=False,
        default=Decimal("0.0290"),
    )
    npo_info_text: Mapped[str | None] = mapped_column(Text(), nullable=True)

    # Relationships
    npo: Mapped["NPO"] = relationship("NPO", back_populates="donate_now_config")
    tiers: Mapped[list["DonationTier"]] = relationship(
        "DonationTier",
        back_populates="config",
        cascade="all, delete-orphan",
        order_by="DonationTier.display_order",
    )
    donations: Mapped[list["NpoDonation"]] = relationship(
        "NpoDonation",
        back_populates="config",
    )

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"<DonateNowPageConfig(id={self.id}, npo_id={self.npo_id}, enabled={self.is_enabled})>"
        )
