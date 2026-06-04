"""Persisted attendee survey response state."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.event_registration import EventRegistration
    from app.models.event_survey_config import EventSurveyConfig
    from app.models.survey_answer import SurveyAnswer


class SurveyResponse(Base, UUIDMixin):
    """One survey response per event registration."""

    __tablename__ = "survey_responses"

    registration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("event_registrations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    survey_config_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("event_survey_configs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    discount_cents_applied: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
        default=0,
    )
    donate_back: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
        default=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    registration: Mapped[EventRegistration] = relationship(
        "EventRegistration",
        back_populates="survey_response",
    )
    survey_config: Mapped[EventSurveyConfig | None] = relationship(
        "EventSurveyConfig",
        back_populates="responses",
    )
    answers: Mapped[list[SurveyAnswer]] = relationship(
        "SurveyAnswer",
        back_populates="response",
        cascade="all, delete-orphan",
        order_by="SurveyAnswer.created_at",
    )

    __table_args__ = (
        CheckConstraint("status IN ('completed', 'skipped')", name="ck_survey_responses_status"),
        CheckConstraint(
            "discount_cents_applied >= 0",
            name="ck_survey_responses_discount_cents_applied",
        ),
    )
