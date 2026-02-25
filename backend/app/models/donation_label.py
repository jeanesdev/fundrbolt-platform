"""Donation label model for event-scoped attribution tags."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.donation import Donation
    from app.models.donation_label_assignment import DonationLabelAssignment
    from app.models.event import Event


class DonationLabel(Base, UUIDMixin, TimestampMixin):
    """Reusable event-scoped label for donation attribution."""

    __tablename__ = "donation_labels"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        index=True,
    )
    retired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    event: Mapped["Event"] = relationship("Event", back_populates="donation_labels")
    assignments: Mapped[list["DonationLabelAssignment"]] = relationship(
        "DonationLabelAssignment",
        back_populates="label",
        cascade="all, delete-orphan",
    )
    donations: Mapped[list["Donation"]] = relationship(
        "Donation",
        secondary="donation_label_assignments",
        primaryjoin="DonationLabel.id == DonationLabelAssignment.label_id",
        secondaryjoin="Donation.id == DonationLabelAssignment.donation_id",
        viewonly=True,
    )
