"""Donation model for event-scoped donation records."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.donation_label import DonationLabel
    from app.models.donation_label_assignment import DonationLabelAssignment
    from app.models.event import Event
    from app.models.user import User


class DonationStatus(str, enum.Enum):
    """Donation lifecycle state."""

    ACTIVE = "active"
    VOIDED = "voided"


class Donation(Base, UUIDMixin, TimestampMixin):
    """Donation record tied to a specific event and donor user."""

    __tablename__ = "donations"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    donor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )
    is_paddle_raise: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        index=True,
    )
    status: Mapped[DonationStatus] = mapped_column(
        Enum(
            DonationStatus, name="donation_status", values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False,
        default=DonationStatus.ACTIVE,
        server_default=DonationStatus.ACTIVE.value,
        index=True,
    )
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    event: Mapped["Event"] = relationship("Event", back_populates="donations")
    donor: Mapped["User"] = relationship("User", back_populates="donations")
    label_assignments: Mapped[list["DonationLabelAssignment"]] = relationship(
        "DonationLabelAssignment",
        back_populates="donation",
        cascade="all, delete-orphan",
    )
    labels: Mapped[list["DonationLabel"]] = relationship(
        "DonationLabel",
        secondary="donation_label_assignments",
        primaryjoin="Donation.id == DonationLabelAssignment.donation_id",
        secondaryjoin="DonationLabel.id == DonationLabelAssignment.label_id",
        viewonly=True,
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_donations_amount_positive"),
        CheckConstraint("status IN ('active', 'voided')", name="ck_donations_status"),
    )
