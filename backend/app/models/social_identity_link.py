"""SocialIdentityLink model – links an external provider identity to a platform user."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class SocialIdentityLink(Base, UUIDMixin):
    """Associates an external provider identity with exactly one platform user.

    Business Rules:
    - Unique constraint on (provider_key, provider_subject).
    - One provider subject cannot be linked to multiple users.
    - Only minimal provider attributes are stored (no tokens).
    """

    __tablename__ = "social_identity_links"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_key: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    provider_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_email_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    linked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    linked_via_attempt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    # Relationships
    user = relationship("User", back_populates="social_identity_links")

    __table_args__ = (
        UniqueConstraint("provider_key", "provider_subject", name="uq_provider_subject"),
    )
