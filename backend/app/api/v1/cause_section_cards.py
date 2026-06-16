"""API endpoints for configurable cause page cards."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.event import Event
from app.models.user import User
from app.schemas.cause_section_card import (
    CausePageConfigResponse,
    CauseSectionCardResponse,
    CreateCardRequest,
    CreateSlideRequest,
    PublicCauseSectionCardResponse,
    PublishRequest,
    ReorderRequest,
    RevisionResponse,
    SlideItemResponse,
    SlideReorderRequest,
    UpdateCardRequest,
    UpdateSlideRequest,
)
from app.services import cause_section_card_service
from app.services.permission_service import PermissionService

admin_router = APIRouter(
    prefix="/admin/events/{event_id}/cause-page",
    tags=["cause-section-cards-admin"],
)
public_router = APIRouter(
    prefix="/events/{event_id}/cause-page",
    tags=["cause-section-cards-public"],
)


async def _require_event_access(
    db: AsyncSession,
    current_user: User,
    event_id: uuid.UUID,
) -> None:
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if current_user.role_name == "super_admin":  # type: ignore[attr-defined]
        return

    permission_service = PermissionService()
    if not await permission_service.can_view_event(current_user, event.npo_id, db=db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


@admin_router.get("/config", response_model=CausePageConfigResponse)
async def get_cause_page_config(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CausePageConfigResponse:
    await _require_event_access(db, current_user, event_id)
    config = await cause_section_card_service.get_or_create_config(db, event_id)
    return cause_section_card_service.config_to_response(config)


@admin_router.get("/cards", response_model=list[CauseSectionCardResponse])
async def list_cause_page_cards(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CauseSectionCardResponse]:
    await _require_event_access(db, current_user, event_id)
    cards = await cause_section_card_service.list_draft_cards(db, event_id)
    return [cause_section_card_service.card_to_response(card) for card in cards]


@admin_router.post(
    "/cards",
    response_model=CauseSectionCardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_cause_page_card(
    event_id: uuid.UUID,
    data: CreateCardRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CauseSectionCardResponse:
    await _require_event_access(db, current_user, event_id)
    card = await cause_section_card_service.create_card(db, event_id, data, current_user.id)
    return cause_section_card_service.card_to_response(card)


@admin_router.patch("/cards/reorder", response_model=list[CauseSectionCardResponse])
async def reorder_cause_page_cards(
    event_id: uuid.UUID,
    data: ReorderRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CauseSectionCardResponse]:
    await _require_event_access(db, current_user, event_id)
    cards = await cause_section_card_service.reorder_cards(db, event_id, data, current_user.id)
    return [cause_section_card_service.card_to_response(card) for card in cards]


@admin_router.patch("/cards/{card_id}", response_model=CauseSectionCardResponse)
async def update_cause_page_card(
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    data: UpdateCardRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CauseSectionCardResponse:
    await _require_event_access(db, current_user, event_id)
    card = await cause_section_card_service.update_card(
        db,
        event_id,
        card_id,
        data,
        current_user.id,
    )
    return cause_section_card_service.card_to_response(card)


@admin_router.delete("/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cause_page_card(
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    data: PublishRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await _require_event_access(db, current_user, event_id)
    await cause_section_card_service.delete_card(
        db,
        event_id,
        card_id,
        data.draft_version,
        current_user.id,
    )


@admin_router.post("/publish", response_model=CausePageConfigResponse)
async def publish_cause_page(
    event_id: uuid.UUID,
    data: PublishRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CausePageConfigResponse:
    await _require_event_access(db, current_user, event_id)
    config = await cause_section_card_service.publish(db, event_id, data, current_user.id)
    return cause_section_card_service.config_to_response(config)


@admin_router.get("/revisions", response_model=list[RevisionResponse])
async def list_cause_page_revisions(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[RevisionResponse]:
    await _require_event_access(db, current_user, event_id)
    revisions = await cause_section_card_service.list_revisions(db, event_id)
    return [cause_section_card_service.revision_to_response(revision) for revision in revisions]


@admin_router.get("/cards/{card_id}/slides", response_model=list[SlideItemResponse])
async def list_card_slides(
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[SlideItemResponse]:
    await _require_event_access(db, current_user, event_id)
    slides = await cause_section_card_service.get_card_slides(db, event_id, card_id)
    return [cause_section_card_service.slide_to_response(slide) for slide in slides]


@admin_router.post(
    "/cards/{card_id}/slides",
    response_model=SlideItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_card_slide(
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    data: CreateSlideRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SlideItemResponse:
    await _require_event_access(db, current_user, event_id)
    slide = await cause_section_card_service.add_slide(
        db,
        event_id,
        card_id,
        data,
        current_user.id,
    )
    return cause_section_card_service.slide_to_response(slide)


@admin_router.patch(
    "/cards/{card_id}/slides/reorder",
    response_model=list[SlideItemResponse],
)
async def reorder_card_slides(
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    data: SlideReorderRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[SlideItemResponse]:
    await _require_event_access(db, current_user, event_id)
    slides = await cause_section_card_service.reorder_slides(
        db,
        event_id,
        card_id,
        data,
        current_user.id,
    )
    return [cause_section_card_service.slide_to_response(slide) for slide in slides]


@admin_router.patch(
    "/cards/{card_id}/slides/{slide_id}",
    response_model=SlideItemResponse,
)
async def update_card_slide(
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    slide_id: uuid.UUID,
    data: UpdateSlideRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SlideItemResponse:
    await _require_event_access(db, current_user, event_id)
    slide = await cause_section_card_service.update_slide(
        db,
        event_id,
        card_id,
        slide_id,
        data,
        current_user.id,
    )
    return cause_section_card_service.slide_to_response(slide)


@admin_router.delete(
    "/cards/{card_id}/slides/{slide_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_card_slide(
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    slide_id: uuid.UUID,
    data: PublishRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await _require_event_access(db, current_user, event_id)
    await cause_section_card_service.delete_slide(
        db,
        event_id,
        card_id,
        slide_id,
        data.draft_version,
        current_user.id,
    )


@public_router.get("/cards", response_model=list[PublicCauseSectionCardResponse])
async def list_public_cause_page_cards(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PublicCauseSectionCardResponse]:
    cards = await cause_section_card_service.get_public_cards(db, event_id)
    return [cause_section_card_service.public_card_to_response(card) for card in cards]
