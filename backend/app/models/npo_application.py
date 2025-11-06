"""NPO Application model for approval workflow."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.npo import NPO
    from app.models.user import User


class ApplicationStatus(str, enum.Enum):
    """Application review status."""

    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class NPOApplication(Base, UUIDMixin, TimestampMixin):
    """NPO Application model for approval workflow.

    Tracks the SuperAdmin review process for NPO applications.

    Business Rules:
    - Only one active application per NPO at a time
    - Review notes required for rejected applications
    - Reviewer must have SuperAdmin role
    - Application automatically created when NPO submitted
    """

    __tablename__ = "npo_applications"

    # NPO relationship
    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Status
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(
            ApplicationStatus,
            name="application_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=ApplicationStatus.SUBMITTED,
        server_default=ApplicationStatus.SUBMITTED.value,
        index=True,
    )

    # Review information
    review_notes: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Array of review notes with timestamp, reviewer, action, notes",
    )

    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Timestamps
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    npo: Mapped["NPO"] = relationship(
        "NPO",
        back_populates="applications",
    )

    reviewer: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[reviewed_by_user_id],
        lazy="joined",
    )

    def __repr__(self) -> str:
        """Return string representation."""
        return f"<NPOApplication(id={self.id}, npo_id={self.npo_id}, status={self.status.value})>"
