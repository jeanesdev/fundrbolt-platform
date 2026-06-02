"""Donor attendee survey endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_active_user
from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.notification import Notification, NotificationPriorityEnum, NotificationTypeEnum
from app.models.user import User
from app.schemas.survey import (
    DonorSurveyStatusResponse,
    DonorSurveySubmitRequest,
    DonorSurveySubmitResponse,
)
from app.services.notification_service import NotificationService
from app.services.survey_service import SurveyService

logger = get_logger(__name__)

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


async def _maybe_send_survey_invitation(
    db: AsyncSession,
    event_id: UUID,
    user_id: UUID,
    config_title: str,
    config_body: str,
    discount_cents: int,
) -> None:
    """Create a survey_invitation notification if one has not already been sent."""
    already_sent = await db.scalar(
        select(func.count(Notification.id)).where(
            Notification.event_id == event_id,
            Notification.user_id == user_id,
            Notification.notification_type == NotificationTypeEnum.SURVEY_INVITATION,
        )
    )
    if already_sent:
        return

    event = await db.scalar(select(Event).where(Event.id == event_id))
    if event is None:
        return
    event_slug = event.custom_slug or event.slug

    discount_label = ""
    if discount_cents > 0:
        dollars = discount_cents / 100
        discount_label = f" Earn ${dollars:g} off your checkout."

    await NotificationService.create_notification(
        db=db,
        event_id=event_id,
        user_id=user_id,
        notification_type=NotificationTypeEnum.SURVEY_INVITATION,
        title=config_title,
        body=f"{config_body}{discount_label}",
        priority=NotificationPriorityEnum.NORMAL,
        data={
            "deep_link": f"/events/{event_slug}/survey",
            "link_label": "Take the survey",
        },
        override_channels=None,
        dispatch_tasks=False,
    )
    await db.commit()


@router.get("/{event_id}/survey/status", response_model=DonorSurveyStatusResponse)
async def get_donor_survey_status(
    event_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DonorSurveyStatusResponse:
    registration = await _get_registration_for_current_user(event_id, current_user, db)
    service = SurveyService(db)
    should_show, config = await service.get_survey_status_for_donor(registration.id)

    if should_show and config:
        try:
            await _maybe_send_survey_invitation(
                db=db,
                event_id=event_id,
                user_id=current_user.id,
                config_title=config.modal_prompt_title,
                config_body=config.modal_prompt_body,
                discount_cents=config.discount_cents,
            )
        except Exception:
            logger.exception("Failed to send survey invitation notification")

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
