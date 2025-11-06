"""Invitation model for NPO staff invitations."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.npo import NPO
    from app.models.user import User


class InvitationStatus(str, enum.Enum):
    """Invitation status."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    REVOKED = "revoked"


class Invitation(Base, UUIDMixin, TimestampMixin):
    """Invitation model for NPO staff invitations.

    Manages JWT-based invitation workflow for NPO staff and administrators.

    Business Rules:
    - Token hash must be cryptographically secure
    - Expiry must be within 7 days of creation
    - Email format validation required
    - Only one pending invitation per email per NPO
    - Single-use tokens (invalidated after acceptance)

    Invitation Flow:
    1. NPO Admin creates invitation with email and role
    2. System generates secure JWT token and sends email
    3. Recipient clicks link, creates account (if needed)
    4. Token validated, NPO_MEMBER record created
    5. Invitation marked as accepted, token invalidated
    """

    __tablename__ = "invitations"

    # NPO relationship
    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Inviter
    invited_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Invitee
    invited_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Set when existing user is invited",
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Invitation target email address",
    )

    # Optional name fields for pre-filling registration
    first_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Optional first name to pre-fill registration",
    )

    last_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Optional last name to pre-fill registration",
    )

    # Role (imported from npo_member)
    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Role to assign: admin, co_admin, or staff",
    )

    # Status
    status: Mapped[InvitationStatus] = mapped_column(
        Enum(
            InvitationStatus,
            name="invitation_status",
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=InvitationStatus.PENDING,
        server_default=InvitationStatus.PENDING.value,
        index=True,
    )

    # Token (hashed for security)
    token_hash: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="Hashed JWT invitation token",
    )

    # Timestamps
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="Invitation expiry (7 days from creation)",
    )

    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When invitation was accepted",
    )

    # Relationships
    npo: Mapped["NPO"] = relationship(
        "NPO",
        foreign_keys=[npo_id],
        lazy="joined",
    )

    inviter: Mapped["User"] = relationship(
        "User",
        foreign_keys=[invited_by_user_id],
        lazy="joined",
    )

    invitee: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[invited_user_id],
        lazy="joined",
    )

    def __repr__(self) -> str:
        """Return string representation."""
        return f"<Invitation(id={self.id}, npo_id={self.npo_id}, email={self.email}, status={self.status.value})>"
