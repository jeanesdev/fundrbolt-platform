"""Pydantic schemas for attendee profile surveys."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SurveyQuestionOptionResponse(BaseModel):
    """Survey option response payload."""

    id: UUID
    text: str
    display_order: int

    model_config = ConfigDict(from_attributes=True)


class SurveyQuestionResponse(BaseModel):
    """Survey question response payload."""

    id: UUID
    text: str
    display_order: int
    is_active: bool
    options: list[SurveyQuestionOptionResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class SurveyConfigResponse(BaseModel):
    """Full survey config payload."""

    id: UUID
    event_id: UUID
    is_active: bool
    modal_prompt_title: str
    modal_prompt_body: str
    discount_cents: int
    questions: list[SurveyQuestionResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class SurveyConfigUpdateRequest(BaseModel):
    """Partial update to survey config settings."""

    is_active: bool | None = None
    modal_prompt_title: str | None = Field(default=None, max_length=200)
    modal_prompt_body: str | None = None
    discount_cents: int | None = Field(default=None, ge=0)

    @field_validator("modal_prompt_body")
    @classmethod
    def validate_modal_prompt_body(cls, value: str | None) -> str | None:
        if value is not None and len(value) > 280:
            raise ValueError("Modal prompt body must be 280 characters or fewer")
        return value


class SurveyQuestionOptionCreateRequest(BaseModel):
    """Option payload for create/update flows."""

    id: UUID | None = None
    text: str = Field(min_length=1, max_length=300)
    display_order: int = Field(default=0, ge=0)


class SurveyQuestionCreateRequest(BaseModel):
    """Create survey question request."""

    text: str = Field(min_length=1, max_length=500)
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True
    options: list[SurveyQuestionOptionCreateRequest]

    @field_validator("options")
    @classmethod
    def validate_option_count(
        cls, value: list[SurveyQuestionOptionCreateRequest]
    ) -> list[SurveyQuestionOptionCreateRequest]:
        if len(value) < 2 or len(value) > 10:
            raise ValueError("Questions must have between 2 and 10 options")
        return value


class SurveyQuestionUpdateRequest(BaseModel):
    """Update survey question request."""

    text: str | None = Field(default=None, min_length=1, max_length=500)
    display_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    options: list[SurveyQuestionOptionCreateRequest] | None = None

    @field_validator("options")
    @classmethod
    def validate_optional_option_count(
        cls, value: list[SurveyQuestionOptionCreateRequest] | None
    ) -> list[SurveyQuestionOptionCreateRequest] | None:
        if value is not None and (len(value) < 2 or len(value) > 10):
            raise ValueError("Questions must have between 2 and 10 options")
        return value


class DonorSurveyStatusResponse(BaseModel):
    """Whether the donor should see the survey modal."""

    should_show: bool
    survey: SurveyConfigResponse | None = None


class DonorSurveyAnswerInput(BaseModel):
    """Selected answer for a donor survey question."""

    question_id: UUID
    option_id: UUID


class DonorSurveySubmitRequest(BaseModel):
    """Submit or skip the donor survey."""

    action: Literal["complete", "skip"]
    answers: list[DonorSurveyAnswerInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_answers(self) -> DonorSurveySubmitRequest:
        if self.action == "complete" and not self.answers:
            raise ValueError("Answers are required when completing the survey")
        if self.action == "skip":
            self.answers = []
        return self


class DonorSurveySubmitResponse(BaseModel):
    """Response after donor submits or skips survey."""

    status: str
    discount_cents_applied: int = 0
    suggested_label_ids: list[UUID] = Field(default_factory=list)


class SurveySuggestedLabel(BaseModel):
    """Suggested donor label summary."""

    id: UUID
    name: str
    color: str | None = None


class SurveyAnswerDetail(BaseModel):
    """Single survey answer summary."""

    question_text: str
    option_text: str


class SurveyResponseSummary(BaseModel):
    """Survey responses shown in donor dashboard details."""

    event_id: UUID
    event_name: str
    status: str
    completed_at: datetime | None = None
    discount_cents_applied: int = 0
    answers: list[SurveyAnswerDetail] = Field(default_factory=list)
    suggested_labels: list[SurveySuggestedLabel] = Field(default_factory=list)


class DonorSurveyAnswerRecord(BaseModel):
    """Flat donor answer record for event-level analytics."""

    user_id: UUID
    question_id: UUID | None = None
    option_text_snapshot: str
    question_text_snapshot: str


class SurveyDonorAnswerQuestion(BaseModel):
    """Question metadata for donor answer table."""

    id: UUID
    text: str


class SurveyDonorAnswerDonor(BaseModel):
    """Donor row for dynamic survey answer table."""

    user_id: UUID
    name: str
    answers: dict[str, str] = Field(default_factory=dict)


class SurveyDonorAnswersResponse(BaseModel):
    """Event-level donor answer table payload."""

    questions: list[SurveyDonorAnswerQuestion] = Field(default_factory=list)
    donors: list[SurveyDonorAnswerDonor] = Field(default_factory=list)
