"""Persisted survey answer snapshots."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.survey_question import SurveyQuestion
    from app.models.survey_question_option import SurveyQuestionOption
    from app.models.survey_response import SurveyResponse


class SurveyAnswer(Base, UUIDMixin):
    """Recorded answer for a question within a survey response."""

    __tablename__ = "survey_answers"

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("survey_responses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("survey_questions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    selected_option_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("survey_question_options.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    question_text_snapshot: Mapped[str] = mapped_column(String(500), nullable=False)
    option_text_snapshot: Mapped[str] = mapped_column(String(300), nullable=False)
    other_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    response: Mapped[SurveyResponse] = relationship("SurveyResponse", back_populates="answers")
    question: Mapped[SurveyQuestion | None] = relationship(
        "SurveyQuestion",
        back_populates="answers",
    )
    selected_option: Mapped[SurveyQuestionOption | None] = relationship("SurveyQuestionOption")
