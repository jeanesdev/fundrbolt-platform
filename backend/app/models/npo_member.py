"""NPO Member model for staff and administrator relationships."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.npo import NPO
    from app.models.user import User


class MemberRole(str, enum.Enum):
    """NPO member role types."""

    ADMIN = "admin"
    CO_ADMIN = "co_admin"
    STAFF = "staff"


class MemberStatus(str, enum.Enum):
    """NPO member status."""

    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"
    REMOVED = "removed"


class NPOMember(Base, UUIDMixin, TimestampMixin):
    """NPO Member model for staff and administrator relationships.

    Business Rules:
    - Unique constraint on (npo_id, user_id)
    - At least one ADMIN must exist per NPO
    - Role hierarchy: ADMIN > CO_ADMIN > STAFF
    - Only ADMIN can invite CO_ADMIN roles
    - Both ADMIN and CO_ADMIN can invite STAFF

    Permission Matrix:
    | Action              | ADMIN | CO_ADMIN | STAFF |
    |---------------------|-------|----------|-------|
    | Invite ADMIN        | ❌    | ❌       | ❌    |
    | Invite CO_ADMIN     | ✅    | ❌       | ❌    |
    | Invite STAFF        | ✅    | ✅       | ❌    |
    | Manage NPO Settings | ✅    | ✅       | ❌    |
    | Create Events       | ✅    | ✅       | ✅    |
    | View Analytics      | ✅    | ✅       | ✅    |
    """

    __tablename__ = "npo_members"
    __table_args__ = (UniqueConstraint("npo_id", "user_id", name="uq_npo_member"),)

    # NPO relationship
    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # User relationship
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Role and Status
    role: Mapped[MemberRole] = mapped_column(
        Enum(MemberRole, name="member_role", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )

    status: Mapped[MemberStatus] = mapped_column(
        Enum(MemberStatus, name="member_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=MemberStatus.INVITED,
        server_default=MemberStatus.INVITED.value,
        index=True,
    )

    # Timestamps
    joined_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When user accepted invitation and became active member",
    )

    # Invitation tracking
    invited_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    npo: Mapped["NPO"] = relationship(
        "NPO",
        back_populates="members",
    )

    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="joined",
    )

    inviter: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[invited_by_user_id],
        lazy="joined",
    )

    def __repr__(self) -> str:
        """Return string representation."""
        return f"<NPOMember(id={self.id}, npo_id={self.npo_id}, user_id={self.user_id}, role={self.role.value})>"
