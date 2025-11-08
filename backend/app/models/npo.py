"""NPO (Non-Profit Organization) model."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.npo_application import NPOApplication
    from app.models.npo_branding import NPOBranding
    from app.models.npo_member import NPOMember
    from app.models.user import User


class NPOStatus(str, enum.Enum):
    """NPO application/approval status."""

    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SUSPENDED = "suspended"
    REJECTED = "rejected"


class NPO(Base, UUIDMixin, TimestampMixin):
    """NPO (Non-Profit Organization) model.

    Serves as the tenant root for multi-tenant isolation.
    All NPO-related data includes npo_id for tenant boundaries.

    Business Rules:
    - Name must be globally unique across platform
    - Email format validation required
    - Tax ID format validation (country-specific)
    - Cannot create events or send invitations until status=APPROVED
    - At least one active ADMIN required per approved NPO

    State Transitions:
    - DRAFT → PENDING_APPROVAL (on submission)
    - PENDING_APPROVAL → APPROVED (SuperAdmin approval)
    - PENDING_APPROVAL → REJECTED (SuperAdmin rejection)
    - REJECTED → PENDING_APPROVAL (resubmission)
    - APPROVED → SUSPENDED (SuperAdmin enforcement)
    - SUSPENDED → APPROVED (SuperAdmin restoration)
    """

    __tablename__ = "npos"

    # Identity
    name: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    tagline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    mission_statement: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Contact Information
    tax_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Address stored as JSON
    # Schema: {street, street2, city, state, zipCode, country}
    address: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # Registration
    registration_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Status
    status: Mapped[NPOStatus] = mapped_column(
        Enum(NPOStatus, name="npo_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=NPOStatus.DRAFT,
        server_default=NPOStatus.DRAFT.value,
        index=True,
    )

    # Creator tracking
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Soft delete
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    # Relationships
    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by_user_id],
        lazy="joined",
    )

    applications: Mapped[list["NPOApplication"]] = relationship(
        "NPOApplication",
        back_populates="npo",
        cascade="all, delete-orphan",
    )

    members: Mapped[list["NPOMember"]] = relationship(
        "NPOMember",
        back_populates="npo",
        cascade="all, delete-orphan",
    )

    branding: Mapped["NPOBranding | None"] = relationship(
        "NPOBranding",
        back_populates="npo",
        uselist=False,
        cascade="all, delete-orphan",
    )

    events: Mapped[list["Event"]] = relationship(
        "Event",
        back_populates="npo",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        """Return string representation."""
        return f"<NPO(id={self.id}, name={self.name}, status={self.status.value})>"
