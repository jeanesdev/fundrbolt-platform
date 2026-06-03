"""Business logic for event attendee profile surveys."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.donor_label import DonorLabel
from app.models.donor_label_assignment import DonorLabelAssignment
from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.event_survey_config import EventSurveyConfig
from app.models.survey_answer import SurveyAnswer
from app.models.survey_question import SurveyQuestion
from app.models.survey_question_option import SurveyQuestionOption
from app.models.survey_response import SurveyResponse
from app.models.user import User
from app.schemas.survey import (
    SurveyConfigResponse,
    SurveyDonorAnswerDonor,
    SurveyDonorAnswerQuestion,
    SurveyDonorAnswersResponse,
    SurveyQuestionCreateRequest,
    SurveyQuestionOptionResponse,
    SurveyQuestionResponse,
    SurveyQuestionUpdateRequest,
)

DEFAULT_MODAL_PROMPT_TITLE = "Tell us about yourself"
DEFAULT_MODAL_PROMPT_BODY = "Help us understand what matters to you most tonight"
DEFAULT_SURVEY_QUESTIONS = [
    {
        "text": "Which part of our mission matters most to you?",
        "options": [
            "Program A",
            "Program B",
            "Families served",
            "Faith impact",
            "Community outreach",
        ],
    },
    {
        "text": "What most motivates your support tonight?",
        "options": [
            "Personal connection",
            "Measurable impact",
            "Community leadership",
            "Faith or values",
            "Fun event experience",
        ],
    },
    {
        "text": "How would you most like to help?",
        "options": ["Donate", "Bid", "Sponsor", "Match gift", "Volunteer", "Invite friends"],
    },
    {
        "text": "Which sounds most compelling?",
        "options": [
            "Help one family tonight",
            "Fund a proven program",
            "Join others making this possible",
            "Live your values through giving",
        ],
    },
    {
        "text": "Would you like impact updates after the event?",
        "options": ["Yes by email", "Yes by text", "No thanks"],
    },
    {
        "text": "Have you supported this cause before?",
        "options": [
            "First time",
            "Attended before",
            "Donor",
            "Volunteer",
            "Board or sponsor guest",
        ],
    },
    {
        "text": "Are you involved in supporting or volunteering in any other fundraisers or Non-Profit Organizations?",
        "options": ["Yes", "No", "I'd rather not say"],
    },
    {
        "text": "Are you open to being approached about a leadership or matching gift tonight?",
        "options": ["Yes", "Maybe", "Not tonight"],
    },
]
DEFAULT_DONOR_LABELS: list[tuple[str, str]] = [
    ("Impact Driven", "#2563EB"),
    ("Heart Driven", "#DC2626"),
    ("Community Driven", "#16A34A"),
    ("Participation Driven", "#D97706"),
]
LABEL_CATEGORY_KEYWORDS = {
    "Impact Driven": [
        "measurable impact",
        "fund a proven program",
        "program outcomes",
        "families served",
    ],
    "Heart Driven": [
        "personal connection",
        "faith",
        "values",
        "family",
        "compassion",
        "faith impact",
    ],
    "Community Driven": [
        "community leadership",
        "join others",
        "community",
        "leadership",
        "community outreach",
    ],
    "Participation Driven": [
        "fun event experience",
        "bid",
        "invite friends",
        "volunteer",
    ],
}


@dataclass(slots=True)
class SurveySubmitResult:
    status: str
    discount_cents_applied: int
    suggested_label_ids: list[UUID]


class SurveyService:
    """Service layer for attendee survey CRUD and donor submissions."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    @staticmethod
    def serialize_config(
        config: EventSurveyConfig,
        *,
        donor_only: bool = False,
    ) -> SurveyConfigResponse:
        questions: list[SurveyQuestionResponse] = []
        for question in sorted(config.questions, key=lambda item: item.display_order):
            options = sorted(question.options, key=lambda item: item.display_order)
            if donor_only and (not question.is_active or len(options) < 2):
                continue
            questions.append(
                SurveyQuestionResponse(
                    id=question.id,
                    text=question.text,
                    display_order=question.display_order,
                    is_active=question.is_active,
                    allow_multiple=question.allow_multiple,
                    options=[
                        SurveyQuestionOptionResponse(
                            id=option.id,
                            text=option.text,
                            display_order=option.display_order,
                            is_other=option.is_other,
                        )
                        for option in options
                    ],
                )
            )

        return SurveyConfigResponse(
            id=config.id,
            event_id=config.event_id,
            is_active=config.is_active,
            modal_prompt_title=config.modal_prompt_title,
            modal_prompt_body=config.modal_prompt_body,
            discount_cents=config.discount_cents,
            questions=questions,
        )

    async def get_or_create_survey_config(self, event_id: UUID) -> EventSurveyConfig:
        config = await self._get_config_by_event_id(event_id)
        if config is not None:
            return config

        config = EventSurveyConfig(
            event_id=event_id,
            is_active=False,
            modal_prompt_title=DEFAULT_MODAL_PROMPT_TITLE,
            modal_prompt_body=DEFAULT_MODAL_PROMPT_BODY,
            discount_cents=0,
        )
        self.db.add(config)
        await self.db.flush()
        await self._seed_default_questions(config)
        await self.db.commit()
        config = await self._get_config_by_event_id(event_id, required=True)
        assert config is not None
        return config

    async def get_survey_for_admin(self, event_id: UUID) -> EventSurveyConfig:
        return await self.get_or_create_survey_config(event_id)

    async def update_survey_config(
        self,
        event_id: UUID,
        patch: dict[str, object],
    ) -> EventSurveyConfig:
        config = await self.get_or_create_survey_config(event_id)
        for field, value in patch.items():
            setattr(config, field, value)
        await self.db.commit()
        refreshed = await self._get_config_by_event_id(event_id, required=True)
        assert refreshed is not None
        return refreshed

    async def get_survey_status_for_donor(
        self, registration_id: UUID
    ) -> tuple[bool, EventSurveyConfig | None, bool, int]:
        registration = await self.db.scalar(
            select(EventRegistration).where(EventRegistration.id == registration_id)
        )
        if registration is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found"
            )

        config = await self._get_config_by_event_id(registration.event_id)
        if config is None or not config.is_active:
            return False, None, False, 0

        donor_view = self.serialize_config(config, donor_only=True)
        if not donor_view.questions:
            return False, None, False, 0

        existing_response = await self.db.scalar(
            select(SurveyResponse).where(SurveyResponse.registration_id == registration_id)
        )
        if existing_response is not None:
            is_completed = existing_response.status == "completed"
            discount_earned = existing_response.discount_cents_applied
            return False, config, is_completed, discount_earned

        return True, config, False, 0

    async def submit_survey_response(
        self,
        registration_id: UUID,
        action: str,
        answers: list[dict[str, Any]],
    ) -> SurveySubmitResult:
        registration_row = await self.db.execute(
            select(EventRegistration, Event)
            .join(Event, EventRegistration.event_id == Event.id)
            .where(EventRegistration.id == registration_id)
        )
        row = registration_row.first()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found"
            )
        registration, event = row

        existing = await self.db.scalar(
            select(SurveyResponse)
            .where(SurveyResponse.registration_id == registration_id)
            .options(selectinload(SurveyResponse.answers))
        )

        config = await self._get_config_by_event_id(registration.event_id)
        if config is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Survey configuration not found for this event",
            )

        eligible_questions = [
            question
            for question in sorted(config.questions, key=lambda item: item.display_order)
            if question.is_active and len(question.options) >= 2
        ]
        if action == "complete" and not eligible_questions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Survey has no active questions to answer",
            )

        discount_cents = config.discount_cents if action == "complete" else 0

        if existing is not None:
            # On retake: preserve the already-applied discount so it is never granted twice
            if existing.discount_cents_applied > 0:
                discount_cents = existing.discount_cents_applied
            # Overwrite previous response: delete old answers and update the record
            for old_answer in list(existing.answers):
                await self.db.delete(old_answer)
            await self.db.flush()
            existing.survey_config_id = config.id
            existing.status = "completed" if action == "complete" else "skipped"
            existing.discount_cents_applied = discount_cents
            existing.completed_at = datetime.now(UTC) if action == "complete" else None
            response = existing
        else:
            response = SurveyResponse(
                registration_id=registration_id,
                survey_config_id=config.id,
                status="completed" if action == "complete" else "skipped",
                discount_cents_applied=discount_cents,
                completed_at=datetime.now(UTC) if action == "complete" else None,
            )
            self.db.add(response)
        await self.db.flush()

        created_answers: list[SurveyAnswer] = []
        if action == "complete":
            answer_map = {
                answer["question_id"]: {
                    "option_ids": answer["option_ids"],
                    "other_text": answer.get("other_text"),
                }
                for answer in answers
            }
            expected_question_ids = {question.id for question in eligible_questions}
            if set(answer_map.keys()) != expected_question_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="All active survey questions must be answered exactly once",
                )

            for question in eligible_questions:
                answer_data = answer_map[question.id]
                selected_option_ids: list[UUID] = list(answer_data["option_ids"])

                if not selected_option_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Question '{question.text}' requires at least one selected option",
                    )
                if not question.allow_multiple and len(selected_option_ids) > 1:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Question '{question.text}' only allows a single selection",
                    )

                option_lookup = {option.id: option for option in question.options}
                for option_id in selected_option_ids:
                    selected_option = option_lookup.get(option_id)
                    if selected_option is None:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Selected option does not belong to the requested question",
                        )

                    other_text: str | None = None
                    if selected_option.is_other:
                        raw = str(answer_data.get("other_text") or "")
                        stripped = raw.strip()
                        if not stripped:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Question '{question.text}' requires a typed answer for the 'Other' option",
                            )
                        other_text = stripped

                    # Use the typed text as the readable snapshot when "Other" is chosen
                    option_snapshot = f"Other: {other_text}" if other_text else selected_option.text

                    survey_answer = SurveyAnswer(
                        response_id=response.id,
                        question_id=question.id,
                        selected_option_id=selected_option.id,
                        question_text_snapshot=question.text,
                        option_text_snapshot=option_snapshot,
                        other_text=other_text,
                    )
                    self.db.add(survey_answer)
                    created_answers.append(survey_answer)

        await self.db.flush()

        suggested_label_ids: list[UUID] = []
        if action == "complete" and created_answers:
            suggested_label_ids = await self._compute_suggested_labels(
                created_answers,
                event.npo_id,
                self.db,
            )
            if suggested_label_ids:
                existing_assignments = set(
                    (
                        await self.db.execute(
                            select(DonorLabelAssignment.label_id).where(
                                DonorLabelAssignment.user_id == registration.user_id,
                                DonorLabelAssignment.label_id.in_(suggested_label_ids),
                            )
                        )
                    )
                    .scalars()
                    .all()
                )
                for label_id in suggested_label_ids:
                    if label_id in existing_assignments:
                        continue
                    self.db.add(
                        DonorLabelAssignment(
                            user_id=registration.user_id,
                            label_id=label_id,
                            is_suggested=True,
                            source="survey_auto",
                        )
                    )

        await self.db.commit()
        return SurveySubmitResult(
            status=response.status,
            discount_cents_applied=response.discount_cents_applied,
            suggested_label_ids=suggested_label_ids,
        )

    async def mark_donate_back(self, registration_id: UUID) -> SurveyResponse:
        """Mark the donor's survey response as donate_back=True.

        Raises 404 if no response exists, 400 if the response is not completed
        or has no discount to donate back.
        """
        response = await self.db.scalar(
            select(SurveyResponse).where(SurveyResponse.registration_id == registration_id)
        )
        if response is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Survey response not found"
            )
        if response.status != "completed" or response.discount_cents_applied == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No completed survey discount to donate back",
            )
        response.donate_back = True
        await self.db.flush()
        return response

    async def reset_to_default_questions(self, survey_config_id: UUID) -> EventSurveyConfig:
        config = await self._get_config_by_id(survey_config_id)
        for question in list(config.questions):
            await self.db.delete(question)
        await self.db.flush()
        await self._seed_default_questions(config)
        await self.db.commit()
        return await self._get_config_by_id(survey_config_id)

    async def copy_survey_from_event(
        self,
        target_event_id: UUID,
        source_event_id: UUID,
    ) -> EventSurveyConfig:
        source_event = await self.db.scalar(select(Event).where(Event.id == source_event_id))
        target_event = await self.db.scalar(select(Event).where(Event.id == target_event_id))
        if source_event is None or target_event is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        if source_event.npo_id != target_event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Survey can only be copied from an event in the same NPO",
            )

        source_config = await self.get_or_create_survey_config(source_event_id)
        target_config = await self.get_or_create_survey_config(target_event_id)
        for question in list(target_config.questions):
            await self.db.delete(question)
        await self.db.flush()

        target_config.modal_prompt_title = source_config.modal_prompt_title
        target_config.modal_prompt_body = source_config.modal_prompt_body
        target_config.discount_cents = 0
        target_config.is_active = False

        for question in sorted(source_config.questions, key=lambda item: item.display_order):
            copied_question = SurveyQuestion(
                survey_config_id=target_config.id,
                text=question.text,
                display_order=question.display_order,
                is_active=question.is_active,
                allow_multiple=question.allow_multiple,
            )
            copied_question.options = [
                SurveyQuestionOption(
                    text=option.text,
                    display_order=option.display_order,
                    is_other=option.is_other,
                )
                for option in sorted(question.options, key=lambda item: item.display_order)
            ]
            self.db.add(copied_question)

        await self.db.commit()
        refreshed = await self._get_config_by_event_id(target_event_id, required=True)
        assert refreshed is not None
        return refreshed

    async def add_question(
        self,
        survey_config_id: UUID,
        data: SurveyQuestionCreateRequest,
    ) -> SurveyQuestion:
        config = await self._get_config_by_id(survey_config_id)
        question = SurveyQuestion(
            survey_config_id=config.id,
            text=data.text,
            display_order=data.display_order,
            is_active=data.is_active,
            allow_multiple=data.allow_multiple,
        )
        question.options = [
            SurveyQuestionOption(
                text=option.text,
                display_order=option.display_order,
                is_other=option.is_other,
            )
            for option in data.options
        ]
        self.db.add(question)
        await self.db.commit()
        return await self._get_question_by_id(question.id)

    async def update_question(
        self,
        question_id: UUID,
        data: SurveyQuestionUpdateRequest,
    ) -> SurveyQuestion:
        question = await self._get_question_by_id(question_id)
        if data.text is not None:
            question.text = data.text
        if data.display_order is not None:
            question.display_order = data.display_order
        if data.is_active is not None:
            question.is_active = data.is_active
        if data.allow_multiple is not None:
            question.allow_multiple = data.allow_multiple
        if data.options is not None:
            existing_options = {option.id: option for option in question.options}
            retained_ids: set[UUID] = set()
            new_options: list[SurveyQuestionOption] = []
            for option_data in data.options:
                if option_data.id is not None and option_data.id in existing_options:
                    option = existing_options[option_data.id]
                    option.text = option_data.text
                    option.display_order = option_data.display_order
                    option.is_other = option_data.is_other
                    retained_ids.add(option.id)
                    new_options.append(option)
                else:
                    option = SurveyQuestionOption(
                        question_id=question.id,
                        text=option_data.text,
                        display_order=option_data.display_order,
                        is_other=option_data.is_other,
                    )
                    self.db.add(option)
                    new_options.append(option)
            for existing_option in list(question.options):
                if existing_option.id not in retained_ids and existing_option not in new_options:
                    await self.db.delete(existing_option)
            question.options = new_options

        await self.db.commit()
        return await self._get_question_by_id(question.id)

    async def delete_question(self, question_id: UUID) -> None:
        question = await self._get_question_by_id(question_id)
        await self.db.delete(question)
        await self.db.commit()

    async def get_donor_answers_for_event(
        self,
        event_id: UUID,
        sort_by_question_id: UUID | None = None,
        sort_order: str = "asc",
        filter_question_id: UUID | None = None,
        filter_option_text: str | None = None,
    ) -> SurveyDonorAnswersResponse:
        config = await self._get_config_by_event_id(event_id)
        questions = [
            SurveyDonorAnswerQuestion(id=question.id, text=question.text)
            for question in (config.questions if config else [])
        ]
        registrations = (
            await self.db.execute(
                select(EventRegistration, User)
                .join(User, EventRegistration.user_id == User.id)
                .where(EventRegistration.event_id == event_id)
            )
        ).all()
        donor_rows = {
            registration.id: SurveyDonorAnswerDonor(
                user_id=user.id,
                name=f"{user.first_name} {user.last_name}".strip(),
                answers={},
            )
            for registration, user in registrations
        }

        responses = (
            (
                await self.db.execute(
                    select(SurveyResponse)
                    .join(EventRegistration, SurveyResponse.registration_id == EventRegistration.id)
                    .where(EventRegistration.event_id == event_id)
                    .options(selectinload(SurveyResponse.answers))
                )
            )
            .scalars()
            .all()
        )
        for response in responses:
            donor = donor_rows.get(response.registration_id)
            if donor is None:
                continue
            for answer in response.answers:
                if answer.question_id is None:
                    continue
                donor.answers[str(answer.question_id)] = answer.option_text_snapshot

        donors = list(donor_rows.values())
        if filter_question_id and filter_option_text is not None:
            needle = filter_option_text.lower()
            donors = [
                donor
                for donor in donors
                if needle in donor.answers.get(str(filter_question_id), "").lower()
            ]

        if sort_by_question_id is not None:
            key = str(sort_by_question_id)
            donors.sort(
                key=lambda donor: (donor.answers.get(key, "").lower(), donor.name.lower()),
                reverse=sort_order.lower() == "desc",
            )
        else:
            donors.sort(key=lambda donor: donor.name.lower(), reverse=sort_order.lower() == "desc")

        return SurveyDonorAnswersResponse(questions=questions, donors=donors)

    async def _ensure_default_labels_exist(
        self,
        npo_id: UUID,
        db: AsyncSession,
    ) -> dict[str, DonorLabel]:
        label_names = [name for name, _ in DEFAULT_DONOR_LABELS]
        result = await db.execute(
            select(DonorLabel).where(
                DonorLabel.npo_id == npo_id,
                DonorLabel.name.in_(label_names),
            )
        )
        existing = {label.name: label for label in result.scalars().all()}
        for name, color in DEFAULT_DONOR_LABELS:
            if name in existing:
                continue
            label = DonorLabel(
                npo_id=npo_id,
                name=name,
                color=color,
                is_system_default=True,
            )
            db.add(label)
            existing[name] = label
        await db.flush()
        return existing

    async def _compute_suggested_labels(
        self,
        answers: list[SurveyAnswer],
        npo_id: UUID,
        db: AsyncSession,
    ) -> list[UUID]:
        label_map = await self._ensure_default_labels_exist(npo_id, db)
        answer_text = " ".join(answer.option_text_snapshot.lower() for answer in answers)
        matches: list[UUID] = []
        for label_name, keywords in LABEL_CATEGORY_KEYWORDS.items():
            if any(keyword in answer_text for keyword in keywords):
                label = label_map.get(label_name)
                if label is not None:
                    matches.append(label.id)
        return matches

    async def _seed_default_questions(self, config: EventSurveyConfig) -> None:
        for question_index, payload in enumerate(DEFAULT_SURVEY_QUESTIONS):
            question = SurveyQuestion(
                survey_config_id=config.id,
                text=payload["text"],
                display_order=question_index,
                is_active=True,
            )
            question.options = [
                SurveyQuestionOption(text=option_text, display_order=option_index)
                for option_index, option_text in enumerate(payload["options"])
            ]
            self.db.add(question)
        await self.db.flush()

    async def _get_config_by_event_id(
        self,
        event_id: UUID,
        *,
        required: bool = False,
    ) -> EventSurveyConfig | None:
        result = await self.db.execute(
            select(EventSurveyConfig)
            .where(EventSurveyConfig.event_id == event_id)
            .options(
                selectinload(EventSurveyConfig.questions).selectinload(SurveyQuestion.options),
            )
        )
        config = result.scalar_one_or_none()
        if config is None and required:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Survey config not found"
            )
        return config

    async def _get_config_by_id(self, survey_config_id: UUID) -> EventSurveyConfig:
        result = await self.db.execute(
            select(EventSurveyConfig)
            .where(EventSurveyConfig.id == survey_config_id)
            .options(
                selectinload(EventSurveyConfig.questions).selectinload(SurveyQuestion.options),
            )
        )
        config = result.scalar_one_or_none()
        if config is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Survey config not found"
            )
        return config

    async def _get_question_by_id(self, question_id: UUID) -> SurveyQuestion:
        result = await self.db.execute(
            select(SurveyQuestion)
            .where(SurveyQuestion.id == question_id)
            .options(selectinload(SurveyQuestion.options))
        )
        question = result.scalar_one_or_none()
        if question is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Survey question not found"
            )
        return question
