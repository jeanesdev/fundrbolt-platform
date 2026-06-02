"""Survey question option model."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.survey_question import SurveyQuestion


class SurveyQuestionOption(Base, UUIDMixin, TimestampMixin):
    """Selectable option for a survey question."""

    __tablename__ = "survey_question_options"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("survey_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    text: Mapped[str] = mapped_column(String(300), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    question: Mapped[SurveyQuestion] = relationship("SurveyQuestion", back_populates="options")

    __table_args__ = (
        Index("ix_survey_question_options_question_order", "question_id", "display_order"),
    )
