"""Event Food Options API endpoints."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.event import FoodOption
from app.models.user import User
from app.schemas.event import FoodOptionCreateRequest, FoodOptionResponse, FoodOptionUpdateRequest
from app.services.event_service import EventService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events/{event_id}/food-options", tags=["events", "food-options"])


@router.post("", response_model=FoodOptionResponse, status_code=status.HTTP_201_CREATED)
async def create_food_option(
    event_id: uuid.UUID,
    request: FoodOptionCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> FoodOptionResponse:
    """
    Add a new food option to an event.

    Food options can include dietary restrictions, meal types, or specific offerings.
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Create new food option
    food_option = FoodOption(
        event_id=event_id,
        name=request.name,
        description=request.description,
        display_order=request.display_order or 0,
    )

    db.add(food_option)
    await db.flush()  # Flush to get the ID without committing
    await db.refresh(food_option)

    logger.info(
        f"Created food option {food_option.id} for event {event_id} by user {current_user.id}"
    )

    return FoodOptionResponse(
        id=food_option.id,
        event_id=food_option.event_id,
        name=food_option.name,
        description=food_option.description,
        display_order=food_option.display_order,
        created_at=food_option.created_at,
    )


@router.patch("/{option_id}", response_model=FoodOptionResponse, status_code=status.HTTP_200_OK)
async def update_food_option(
    event_id: uuid.UUID,
    option_id: uuid.UUID,
    request: FoodOptionUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> FoodOptionResponse:
    """
    Update an existing food option.

    Can update name, description, or display order.
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Find the food option
    query = select(FoodOption).where(FoodOption.id == option_id, FoodOption.event_id == event_id)
    result = await db.execute(query)
    food_option = result.scalar_one_or_none()

    if not food_option:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Food option with ID {option_id} not found for event {event_id}",
        )

    # Update fields
    if request.name is not None:
        food_option.name = request.name
    if request.description is not None:
        food_option.description = request.description
    if request.display_order is not None:
        food_option.display_order = request.display_order

    await db.flush()
    await db.refresh(food_option)

    logger.info(f"Updated food option {option_id} for event {event_id} by user {current_user.id}")

    return FoodOptionResponse(
        id=food_option.id,
        event_id=food_option.event_id,
        name=food_option.name,
        description=food_option.description,
        display_order=food_option.display_order,
        created_at=food_option.created_at,
    )


@router.delete("/{option_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_food_option(
    event_id: uuid.UUID,
    option_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> None:
    """
    Delete a food option.

    Removes the food option from the event.
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Find the food option
    query = select(FoodOption).where(FoodOption.id == option_id, FoodOption.event_id == event_id)
    result = await db.execute(query)
    food_option = result.scalar_one_or_none()

    if not food_option:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Food option with ID {option_id} not found for event {event_id}",
        )

    # Delete the food option
    await db.delete(food_option)
    # No need to commit - get_db() handles it automatically

    logger.info(f"Deleted food option {option_id} from event {event_id} by user {current_user.id}")
