"""Sponsor models for event sponsorship management."""

import enum
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.user import User


class LogoSize(str, enum.Enum):
    """Logo display size for sponsor branding."""

    XSMALL = "xsmall"  # 64px
    SMALL = "small"  # 96px
    MEDIUM = "medium"  # 128px
    LARGE = "large"  # 192px (default)
    XLARGE = "xlarge"  # 256px


class Sponsor(Base, UUIDMixin, TimestampMixin):
    """Sponsor model representing event sponsors/supporters.

    Business Rules:
    - Sponsor names must be unique per event
    - Logo upload is required (logo_url and thumbnail_url)
    - Donation amounts must be non-negative
    - Display order must be non-negative
    - Logo size defaults to 'large' if not specified
    - All sponsors belong to exactly one event
    - Sponsors deleted when parent event is deleted (CASCADE)

    State Transitions:
    - Created with logo pending upload
    - Logo uploaded and thumbnail generated
    - Can be updated (including logo replacement)
    - Can be deleted (hard delete with logo blobs cleanup)
    """

    __tablename__ = "sponsors"

    # Relationships
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # Required Fields
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Sponsor organization or individual name",
    )
    logo_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Azure Blob Storage URL for full-size logo",
    )
    logo_blob_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Azure Blob Storage blob name/path for logo",
    )
    thumbnail_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Azure Blob Storage URL for thumbnail (128x128)",
    )
    thumbnail_blob_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Azure Blob Storage blob name/path for thumbnail",
    )
    logo_size: Mapped[LogoSize] = mapped_column(
        Enum(LogoSize, name="logo_size", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=LogoSize.LARGE,
        server_default=LogoSize.LARGE.value,
        comment="Display size: xsmall, small, medium, large, xlarge",
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        comment="Order for displaying sponsors (lower = higher priority)",
    )

    # Optional Fields
    website_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Sponsor's website URL",
    )
    sponsor_level: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Sponsor tier/level (e.g., 'Gold', 'Platinum')",
    )

    # Contact Information
    contact_name: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Primary contact person name",
    )
    contact_email: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Contact email address",
    )
    contact_phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Contact phone number",
    )

    # Address Information
    address_line1: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Street address line 1",
    )
    address_line2: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Street address line 2 (optional)",
    )
    city: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="City",
    )
    state: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="State/province",
    )
    postal_code: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="ZIP/postal code",
    )
    country: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Country",
    )

    # Financial Information
    donation_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=12, scale=2),
        nullable=True,
        comment="Donation/sponsorship amount in USD",
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Internal notes about sponsorship agreement",
    )

    # SQLAlchemy Relationships
    event: Mapped["Event"] = relationship(
        "Event",
        back_populates="sponsors",
        lazy="select",
    )
    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="select",
    )

    # Table Constraints (defined in migration, documented here)
    __table_args__ = (
        CheckConstraint("donation_amount >= 0", name="ck_donation_nonnegative"),
        CheckConstraint("display_order >= 0", name="ck_display_order_nonnegative"),
        CheckConstraint(
            "logo_size IN ('xsmall', 'small', 'medium', 'large', 'xlarge')",
            name="ck_logo_size_enum",
        ),
    )

    def __repr__(self) -> str:
        """String representation of Sponsor."""
        return f"<Sponsor(id={self.id}, name='{self.name}', event_id={self.event_id})>"
