"""Survey question model."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event_survey_config import EventSurveyConfig
    from app.models.survey_answer import SurveyAnswer
    from app.models.survey_question_option import SurveyQuestionOption


class SurveyQuestion(Base, UUIDMixin, TimestampMixin):
    """Single selectable survey question."""

    __tablename__ = "survey_questions"

    survey_config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("event_survey_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    text: Mapped[str] = mapped_column(String(500), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    allow_multiple: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    survey_config: Mapped[EventSurveyConfig] = relationship(
        "EventSurveyConfig",
        back_populates="questions",
    )
    options: Mapped[list[SurveyQuestionOption]] = relationship(
        "SurveyQuestionOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="SurveyQuestionOption.display_order",
    )
    answers: Mapped[list[SurveyAnswer]] = relationship(
        "SurveyAnswer",
        back_populates="question",
    )

    __table_args__ = (
        Index("ix_survey_questions_config_order", "survey_config_id", "display_order"),
    )
