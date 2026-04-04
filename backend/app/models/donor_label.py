"""Donor label model for tagging users within an NPO."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.donor_label_assignment import DonorLabelAssignment
    from app.models.npo import NPO
    from app.models.user import User


class DonorLabel(Base, UUIDMixin, TimestampMixin):
    """An NPO-scoped label for tagging donors (e.g. 'Major Donor')."""

    __tablename__ = "donor_labels"

    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)

    npo: Mapped["NPO"] = relationship("NPO", back_populates="donor_labels")
    assignments: Mapped[list["DonorLabelAssignment"]] = relationship(
        "DonorLabelAssignment",
        back_populates="label",
        cascade="all, delete-orphan",
    )
    users: Mapped[list["User"]] = relationship(
        "User",
        secondary="donor_label_assignments",
        primaryjoin="DonorLabel.id == DonorLabelAssignment.label_id",
        secondaryjoin="User.id == DonorLabelAssignment.user_id",
        viewonly=True,
    )
