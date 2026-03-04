"""SocialAuthAttempt model – tracks one social authentication transaction."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin


class SocialAuthAttempt(Base, UUIDMixin):
    """Represents one social authentication transaction from start to completion/failure.

    Business Rules:
    - state_token must be single-use.
    - Expired attempts cannot be completed.
    - Provider auth codes / verifier material are ephemeral – not stored after completion.
    """

    __tablename__ = "social_auth_attempts"

    provider_key: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    app_context: Mapped[str] = mapped_column(String(20), nullable=False)
    state_token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    pkce_verifier_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    redirect_uri: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result: Mapped[str] = mapped_column(String(30), nullable=False, server_default="started")
    failure_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    client_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
