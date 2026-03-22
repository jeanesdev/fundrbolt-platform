"""Admin API endpoints for event-level (universal) custom option management.

These options apply to every registration for an event regardless of
which ticket package was purchased.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_active_user
from app.models.event import Event
from app.models.ticket_management import CustomTicketOption
from app.models.user import User
from app.schemas.ticket_management import (
    CustomTicketOptionCreate,
    CustomTicketOptionRead,
    CustomTicketOptionUpdate,
)
from app.services.permission_service import PermissionService

logger = get_logger(__name__)
router = APIRouter()

MAX_EVENT_OPTIONS = 8


async def _get_event_with_access(
    db: AsyncSession,
    current_user: User,
    event_id: uuid.UUID,
) -> Event:
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    permission_service = PermissionService()
    has_access = await permission_service.can_view_event(current_user, event.npo_id, db=db)
    if not has_access:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    return event


@router.post(
    "/admin/events/{event_id}/options",
    response_model=CustomTicketOptionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create event-level custom option",
)
async def create_event_custom_option(
    event_id: uuid.UUID,
    option_data: CustomTicketOptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Create a universal custom option that applies to all registrations.

    Business Rules:
    - Maximum 8 event-level options
    - Event must belong to user's NPO
    """
    await _get_event_with_access(db, current_user, event_id)

    count_result = await db.execute(
        select(func.count(CustomTicketOption.id)).where(
            and_(
                CustomTicketOption.event_id == event_id,
                CustomTicketOption.ticket_package_id.is_(None),
            )
        )
    )
    if count_result.scalar_one() >= MAX_EVENT_OPTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_EVENT_OPTIONS} event-level custom options",
        )

    new_option = CustomTicketOption(
        event_id=event_id,
        ticket_package_id=None,
        option_label=option_data.option_label,
        option_type=option_data.option_type,
        choices=option_data.choices,
        is_required=option_data.is_required,
        display_order=option_data.display_order,
    )

    db.add(new_option)
    await db.commit()
    await db.refresh(new_option)

    logger.info(
        "Event custom option created: %s for event %s by user %s",
        new_option.id,
        event_id,
        current_user.id,
    )

    return new_option


@router.get(
    "/admin/events/{event_id}/options",
    response_model=list[CustomTicketOptionRead],
)
async def list_event_custom_options(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """List all event-level custom options."""
    await _get_event_with_access(db, current_user, event_id)

    options_result = await db.execute(
        select(CustomTicketOption)
        .where(
            and_(
                CustomTicketOption.event_id == event_id,
                CustomTicketOption.ticket_package_id.is_(None),
            )
        )
        .order_by(CustomTicketOption.display_order, CustomTicketOption.created_at)
    )
    return list(options_result.scalars().all())


@router.get(
    "/admin/events/{event_id}/options/{option_id}",
    response_model=CustomTicketOptionRead,
)
async def get_event_custom_option(
    event_id: uuid.UUID,
    option_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get a single event-level custom option."""
    await _get_event_with_access(db, current_user, event_id)

    result = await db.execute(
        select(CustomTicketOption).where(
            and_(
                CustomTicketOption.id == option_id,
                CustomTicketOption.event_id == event_id,
                CustomTicketOption.ticket_package_id.is_(None),
            )
        )
    )
    option = result.scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found")

    return option


@router.patch(
    "/admin/events/{event_id}/options/{option_id}",
    response_model=CustomTicketOptionRead,
)
async def update_event_custom_option(
    event_id: uuid.UUID,
    option_id: uuid.UUID,
    option_data: CustomTicketOptionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update an event-level custom option.

    Cannot update if the option has existing responses from donors.
    """
    await _get_event_with_access(db, current_user, event_id)

    result = await db.execute(
        select(CustomTicketOption).where(
            and_(
                CustomTicketOption.id == option_id,
                CustomTicketOption.event_id == event_id,
                CustomTicketOption.ticket_package_id.is_(None),
            )
        )
    )
    option = result.scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found")

    # Check for existing responses
    from app.models.ticket_management import OptionResponse

    responses_count = await db.execute(
        select(func.count(OptionResponse.id)).where(OptionResponse.custom_option_id == option_id)
    )
    if responses_count.scalar_one() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot modify option with existing responses",
        )

    if option_data.option_label is not None:
        option.option_label = option_data.option_label
    if option_data.option_type is not None:
        option.option_type = option_data.option_type
    if option_data.choices is not None:
        option.choices = option_data.choices
    if option_data.is_required is not None:
        option.is_required = option_data.is_required
    if option_data.display_order is not None:
        option.display_order = option_data.display_order

    await db.commit()
    await db.refresh(option)

    logger.info("Event custom option updated: %s by user %s", option.id, current_user.id)

    return option


@router.delete(
    "/admin/events/{event_id}/options/{option_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_event_custom_option(
    event_id: uuid.UUID,
    option_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Delete an event-level custom option.

    Cannot delete if the option has existing responses from donors.
    """
    await _get_event_with_access(db, current_user, event_id)

    result = await db.execute(
        select(CustomTicketOption).where(
            and_(
                CustomTicketOption.id == option_id,
                CustomTicketOption.event_id == event_id,
                CustomTicketOption.ticket_package_id.is_(None),
            )
        )
    )
    option = result.scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found")

    from app.models.ticket_management import OptionResponse

    responses_count = await db.execute(
        select(func.count(OptionResponse.id)).where(OptionResponse.custom_option_id == option_id)
    )
    if responses_count.scalar_one() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete option with existing responses",
        )

    await db.delete(option)
    await db.commit()

    logger.info("Event custom option deleted: %s by user %s", option_id, current_user.id)
