"""Donor label assignment join model."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.donor_label import DonorLabel
    from app.models.user import User


class DonorLabelAssignment(Base, UUIDMixin, TimestampMixin):
    """Join table linking users with donor labels."""

    __tablename__ = "donor_label_assignments"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donor_labels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user: Mapped["User"] = relationship("User", back_populates="donor_label_assignments")
    label: Mapped["DonorLabel"] = relationship("DonorLabel", back_populates="assignments")

    __table_args__ = (
        UniqueConstraint("user_id", "label_id", name="uq_donor_label_assignments_pair"),
    )
