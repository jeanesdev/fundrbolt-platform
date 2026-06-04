"""Event-scoped attendee survey configuration."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.survey_question import SurveyQuestion
    from app.models.survey_response import SurveyResponse


class EventSurveyConfig(Base, UUIDMixin, TimestampMixin):
    """Configurable attendee survey for a single event."""

    __tablename__ = "event_survey_configs"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    modal_prompt_title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        server_default="Tell us about yourself",
    )
    modal_prompt_body: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        server_default="Help us understand what matters to you most tonight",
    )
    discount_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
        default=0,
    )

    event: Mapped[Event] = relationship("Event", back_populates="event_survey_config")
    questions: Mapped[list[SurveyQuestion]] = relationship(
        "SurveyQuestion",
        back_populates="survey_config",
        cascade="all, delete-orphan",
        order_by="SurveyQuestion.display_order",
    )
    responses: Mapped[list[SurveyResponse]] = relationship(
        "SurveyResponse",
        back_populates="survey_config",
    )

    __table_args__ = (
        CheckConstraint("discount_cents >= 0", name="ck_event_survey_configs_discount_cents"),
    )
