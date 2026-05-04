"""Auctioneer run-of-show endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.run_of_show import RunOfShowItemResponse, RunOfShowResponse
from app.services.run_of_show_service import RunOfShowService

router = APIRouter(prefix="/auctioneer/events", tags=["auctioneer-run-of-show"])


@router.get(
    "/{event_id}/run-of-show",
    response_model=RunOfShowResponse,
    summary="Get auctioneer-visible run-of-show for an event",
)
async def get_auctioneer_run_of_show(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RunOfShowResponse:
    """Get run-of-show items visible to the auctioneer."""
    return await RunOfShowService.get_event_ros(db, event_id, visibility_filter="auctioneer")


@router.post(
    "/{event_id}/run-of-show/complete/{item_id}",
    response_model=RunOfShowItemResponse,
    summary="Mark a run-of-show item complete (auctioneer)",
)
async def complete_run_of_show_item(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RunOfShowItemResponse:
    """Mark a run-of-show item as complete."""
    item = await RunOfShowService.mark_complete(db, event_id, item_id)
    return RunOfShowService.item_to_response(item)


@router.post(
    "/{event_id}/run-of-show/incomplete/{item_id}",
    response_model=RunOfShowItemResponse,
    summary="Mark a run-of-show item incomplete (auctioneer)",
)
async def incomplete_run_of_show_item(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RunOfShowItemResponse:
    """Mark a run-of-show item as incomplete."""
    item = await RunOfShowService.mark_incomplete(db, event_id, item_id)
    return RunOfShowService.item_to_response(item)
