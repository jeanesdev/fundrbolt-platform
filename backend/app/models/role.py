"""Role model for authorization."""

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class Role(Base, UUIDMixin, TimestampMixin):
    """Role model representing user authorization levels.

    Five role types:
    - super_admin: Augeo platform staff with full access
    - npo_admin: Full management within assigned NPO(s)
    - event_coordinator: Event/auction management within NPO
    - staff: Donor registration/check-in within assigned events
    - donor: Bidding and profile management only
    """

    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    scope: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Access scope: platform, npo, event, own",
    )

    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="role",
        foreign_keys="User.role_id",
    )

    def __repr__(self) -> str:
        """Return string representation of role."""
        return f"<Role(id={self.id}, name={self.name})>"
