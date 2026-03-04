"""Social auth challenge models – pending link, email verification, admin step-up."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin


class SocialPendingLinkConfirmation(Base, UUIDMixin):
    """Tracks first-time candidate matches requiring email-login confirmation before link.

    Business Rules:
    - Pending confirmation expires automatically.
    - Only one active pending confirmation per (provider_key, provider_subject).
    """

    __tablename__ = "social_pending_link_confirmations"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("social_auth_attempts.id", ondelete="CASCADE"),
        nullable=False,
    )
    candidate_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider_key: Mapped[str] = mapped_column(String(20), nullable=False)
    provider_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    confirmation_token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EmailVerificationChallenge(Base, UUIDMixin):
    """In-app email verification when provider email is missing or unverified.

    Business Rules:
    - Access cannot be granted until verification_status = verified.
    - Challenge cannot be reused once verified or expired.
    """

    __tablename__ = "social_email_verification_challenges"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("social_auth_attempts.id", ondelete="CASCADE"),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    verification_token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    verification_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending"
    )
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AdminStepUpChallenge(Base, UUIDMixin):
    """Elevated verification required for admin social sign-ins.

    Business Rules:
    - Admin app session issuance requires status = satisfied.
    - Failed/expired challenges deny admin access and return fallback login path.
    """

    __tablename__ = "social_admin_step_up_challenges"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("social_auth_attempts.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    step_up_token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
