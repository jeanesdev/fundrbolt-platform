"""Donation label assignment join model."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.donation import Donation
    from app.models.donation_label import DonationLabel


class DonationLabelAssignment(Base, UUIDMixin, TimestampMixin):
    """Join table linking donations with labels."""

    __tablename__ = "donation_label_assignments"

    donation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donation_labels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    donation: Mapped["Donation"] = relationship("Donation", back_populates="label_assignments")
    label: Mapped["DonationLabel"] = relationship("DonationLabel", back_populates="assignments")

    __table_args__ = (
        UniqueConstraint("donation_id", "label_id", name="uq_donation_label_assignments_pair"),
    )
