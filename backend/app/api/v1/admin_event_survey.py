"""Admin event survey configuration endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.event import Event
from app.models.user import User
from app.schemas.survey import (
    SurveyConfigResponse,
    SurveyConfigUpdateRequest,
    SurveyDonorAnswersResponse,
    SurveyQuestionCreateRequest,
    SurveyQuestionResponse,
    SurveyQuestionUpdateRequest,
)
from app.services.permission_service import PermissionService
from app.services.survey_service import SurveyService

router = APIRouter(prefix="/admin/events", tags=["admin-event-survey"])


async def _require_event_access(
    db: AsyncSession,
    current_user: User,
    event: Event,
    detail: str = "You do not have permission to manage this event",
) -> None:
    if current_user.role_name == "super_admin":  # type: ignore[attr-defined]
        return

    permission_service = PermissionService()
    if not await permission_service.can_view_event(current_user, event.npo_id, db=db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


async def _get_event_or_404(event_id: UUID, db: AsyncSession) -> Event:
    event = await db.scalar(select(Event).where(Event.id == event_id))
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.get("/{event_id}/survey", response_model=SurveyConfigResponse)
async def get_event_survey(
    event_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SurveyConfigResponse:
    event = await _get_event_or_404(event_id, db)
    await _require_event_access(db, current_user, event)
    service = SurveyService(db)
    config = await service.get_survey_for_admin(event_id)
    return service.serialize_config(config)


@router.patch("/{event_id}/survey", response_model=SurveyConfigResponse)
async def update_event_survey(
    event_id: UUID,
    body: SurveyConfigUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SurveyConfigResponse:
    event = await _get_event_or_404(event_id, db)
    await _require_event_access(db, current_user, event)
    service = SurveyService(db)
    config = await service.update_survey_config(event_id, body.model_dump(exclude_unset=True))
    return service.serialize_config(config)


@router.post("/{event_id}/survey/reset-defaults", response_model=SurveyConfigResponse)
async def reset_event_survey_defaults(
    event_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SurveyConfigResponse:
    event = await _get_event_or_404(event_id, db)
    await _require_event_access(db, current_user, event)
    service = SurveyService(db)
    config = await service.get_or_create_survey_config(event_id)
    updated = await service.reset_to_default_questions(config.id)
    return service.serialize_config(updated)


@router.post("/{event_id}/survey/copy-from/{source_event_id}", response_model=SurveyConfigResponse)
async def copy_event_survey(
    event_id: UUID,
    source_event_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SurveyConfigResponse:
    target_event = await _get_event_or_404(event_id, db)
    source_event = await _get_event_or_404(source_event_id, db)
    await _require_event_access(db, current_user, target_event)
    await _require_event_access(db, current_user, source_event)
    service = SurveyService(db)
    config = await service.copy_survey_from_event(event_id, source_event_id)
    return service.serialize_config(config)


@router.post(
    "/{event_id}/survey/questions",
    response_model=SurveyQuestionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_event_survey_question(
    event_id: UUID,
    body: SurveyQuestionCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SurveyQuestionResponse:
    event = await _get_event_or_404(event_id, db)
    await _require_event_access(db, current_user, event)
    service = SurveyService(db)
    config = await service.get_or_create_survey_config(event_id)
    question = await service.add_question(config.id, body)
    return SurveyQuestionResponse.model_validate(question)


@router.patch("/{event_id}/survey/questions/{question_id}", response_model=SurveyQuestionResponse)
async def update_event_survey_question(
    event_id: UUID,
    question_id: UUID,
    body: SurveyQuestionUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SurveyQuestionResponse:
    event = await _get_event_or_404(event_id, db)
    await _require_event_access(db, current_user, event)
    service = SurveyService(db)
    question = await service.update_question(question_id, body)
    return SurveyQuestionResponse.model_validate(question)


@router.delete("/{event_id}/survey/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event_survey_question(
    event_id: UUID,
    question_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    event = await _get_event_or_404(event_id, db)
    await _require_event_access(db, current_user, event)
    service = SurveyService(db)
    await service.delete_question(question_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{event_id}/survey/donor-answers", response_model=SurveyDonorAnswersResponse)
async def get_event_survey_donor_answers(
    event_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    sort_by_question_id: UUID | None = Query(default=None),
    sort_order: str = Query(default="asc"),
    filter_question_id: UUID | None = Query(default=None),
    filter_option_text: str | None = Query(default=None),
) -> SurveyDonorAnswersResponse:
    event = await _get_event_or_404(event_id, db)
    await _require_event_access(db, current_user, event)
    service = SurveyService(db)
    return await service.get_donor_answers_for_event(
        event_id,
        sort_by_question_id=sort_by_question_id,
        sort_order=sort_order,
        filter_question_id=filter_question_id,
        filter_option_text=filter_option_text,
    )
