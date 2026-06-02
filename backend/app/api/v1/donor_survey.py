"""Donor attendee survey endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.event_registration import EventRegistration
from app.models.user import User
from app.schemas.survey import (
    DonorSurveyStatusResponse,
    DonorSurveySubmitRequest,
    DonorSurveySubmitResponse,
)
from app.services.survey_service import SurveyService

router = APIRouter(prefix="/donor/events", tags=["donor-survey"])


async def _get_registration_for_current_user(
    event_id: UUID,
    current_user: User,
    db: AsyncSession,
) -> EventRegistration:
    registration = await db.scalar(
        select(EventRegistration).where(
            EventRegistration.event_id == event_id,
            EventRegistration.user_id == current_user.id,
        )
    )
    if registration is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registration found for this event",
        )
    return registration


@router.get("/{event_id}/survey/status", response_model=DonorSurveyStatusResponse)
async def get_donor_survey_status(
    event_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DonorSurveyStatusResponse:
    registration = await _get_registration_for_current_user(event_id, current_user, db)
    service = SurveyService(db)
    should_show, config = await service.get_survey_status_for_donor(registration.id)
    return DonorSurveyStatusResponse(
        should_show=should_show,
        survey=service.serialize_config(config, donor_only=True)
        if should_show and config
        else None,
    )


@router.post("/{event_id}/survey/response", response_model=DonorSurveySubmitResponse)
async def submit_donor_survey_response(
    event_id: UUID,
    body: DonorSurveySubmitRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DonorSurveySubmitResponse:
    registration = await _get_registration_for_current_user(event_id, current_user, db)
    service = SurveyService(db)
    result = await service.submit_survey_response(
        registration.id,
        body.action,
        [answer.model_dump() for answer in body.answers],
    )
    return DonorSurveySubmitResponse(
        status=result.status,
        discount_cents_applied=result.discount_cents_applied,
        suggested_label_ids=result.suggested_label_ids,
    )
