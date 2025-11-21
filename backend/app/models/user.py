"""User model for authentication and authorization."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog
    from app.models.consent import ConsentAuditLog, CookieConsent, UserConsent
    from app.models.event_registration import EventRegistration
    from app.models.registration_guest import RegistrationGuest
    from app.models.role import Role
    from app.models.session import Session


class User(Base, UUIDMixin, TimestampMixin):
    """User model representing any person using the platform.

    Supports five role types:
    - super_admin: Augeo platform staff with full access
    - npo_admin: Full management within assigned NPO(s)
    - event_coordinator: Event/auction management within NPO
    - staff: Donor registration/check-in within assigned events
    - donor: Bidding and profile management only

    Business Rules:
    - Email must be unique and lowercase
    - Email verification required before login (email_verified=true AND is_active=true)
    - Password hashed with bcrypt (12+ rounds)
    - NPO Admin and Event Coordinator roles MUST have npo_id set
    - Staff and Donor roles MUST NOT have npo_id (staff use event assignments)
    - Default role on registration: "donor"
    - Organization name and address fields are optional for users who wish to provide
      business/organization information
    """

    __tablename__ = "users"

    # Identity
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Profile
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Organization (Optional)
    organization_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Address (Optional)
    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Profile Picture
    profile_picture_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Social Media Links (JSON)
    # Schema: {facebook, twitter, instagram, linkedin, youtube, website}
    social_media_links: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Authentication
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    # Role & Scope
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id"),
        nullable=False,
        index=True,
    )
    npo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,  # FK to organizations table (will be added when that table exists)
    )

    # Last login tracking
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    role: Mapped["Role"] = relationship(
        "Role",
        back_populates="users",
        foreign_keys=[role_id],
    )

    sessions: Mapped[list["Session"]] = relationship(
        "Session",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # Legal compliance relationships
    consents: Mapped[list["UserConsent"]] = relationship(
        "UserConsent",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    cookie_consents: Mapped[list["CookieConsent"]] = relationship(
        "CookieConsent",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    consent_audit_logs: Mapped[list["ConsentAuditLog"]] = relationship(
        "ConsentAuditLog",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # Event registration relationships
    event_registrations: Mapped[list["EventRegistration"]] = relationship(
        "EventRegistration",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    guest_records: Mapped[list["RegistrationGuest"]] = relationship(
        "RegistrationGuest",
        back_populates="user",
        foreign_keys="RegistrationGuest.user_id",
    )

    # Check constraints
    __table_args__ = (
        CheckConstraint("email = LOWER(email)", name="email_lowercase"),
        CheckConstraint("LENGTH(password_hash) > 0", name="password_not_empty"),
    )

    def set_password(self, plain_password: str) -> None:
        """Hash and set the user's password using bcrypt.

        Args:
            plain_password: The plain text password to hash
        """
        from app.core.security import hash_password

        self.password_hash = hash_password(plain_password)

    def verify_password(self, plain_password: str) -> bool:
        """Verify a plain text password against the stored hash.

        Args:
            plain_password: The plain text password to verify

        Returns:
            True if password matches, False otherwise
        """
        from app.core.security import verify_password

        return verify_password(plain_password, self.password_hash)

    @property
    def full_name(self) -> str:
        """Get the user's full name.

        Returns:
            First name and last name concatenated
        """
        return f"{self.first_name} {self.last_name}"

    def __repr__(self) -> str:
        """Return string representation of user."""
        return f"<User(id={self.id}, email={self.email}, role_id={self.role_id})>"
