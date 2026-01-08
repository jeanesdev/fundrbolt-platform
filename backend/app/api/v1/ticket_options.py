"""Admin API endpoints for custom ticket option management."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_active_user
from app.models.ticket_management import CustomTicketOption, TicketPackage
from app.models.user import User
from app.schemas.ticket_management import (
    CustomTicketOptionCreate,
    CustomTicketOptionRead,
    CustomTicketOptionUpdate,
)

logger = get_logger(__name__)
router = APIRouter()


@router.post(
    "/admin/packages/{package_id}/options",
    response_model=CustomTicketOptionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create custom option",
)
async def create_custom_option(
    package_id: uuid.UUID,
    option_data: CustomTicketOptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Create a new custom option for a ticket package.

    Business Rules:
    - Maximum 4 options per package
    - Package must belong to user's NPO
    - display_order is auto-assigned if not provided
    """
    # Verify package access
    result = await db.execute(
        select(TicketPackage)
        .join(TicketPackage.event)
        .where(
            and_(
                TicketPackage.id == package_id,
                TicketPackage.event.has(npo_id=current_user.npo_id),
            )
        )
    )
    package = result.scalar_one_or_none()
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    # Check 4-option limit
    count_result = await db.execute(
        select(func.count(CustomTicketOption.id)).where(
            CustomTicketOption.ticket_package_id == package_id
        )
    )
    if count_result.scalar_one() >= 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 4 custom options per package",
        )

    # Create option
    new_option = CustomTicketOption(
        ticket_package_id=package_id,
        option_label=option_data.option_label,
        option_type=option_data.option_type,
        choices={"choices": option_data.choices} if option_data.choices else None,
        is_required=option_data.is_required,
        display_order=option_data.display_order,
    )

    db.add(new_option)
    await db.commit()
    await db.refresh(new_option)

    logger.info(
        f"Custom option created: {new_option.id} for package {package_id} by user {current_user.id}"
    )

    return new_option


@router.get("/admin/packages/{package_id}/options", response_model=list[CustomTicketOptionRead])
async def list_custom_options(
    package_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """List all custom options for a package."""
    # Verify package access
    result = await db.execute(
        select(TicketPackage)
        .join(TicketPackage.event)
        .where(
            and_(
                TicketPackage.id == package_id,
                TicketPackage.event.has(npo_id=current_user.npo_id),
            )
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    # Fetch options
    options_result = await db.execute(
        select(CustomTicketOption)
        .where(CustomTicketOption.ticket_package_id == package_id)
        .order_by(CustomTicketOption.display_order, CustomTicketOption.created_at)
    )
    options = options_result.scalars().all()

    return list(options)


@router.get(
    "/admin/packages/{package_id}/options/{option_id}", response_model=CustomTicketOptionRead
)
async def get_custom_option(
    package_id: uuid.UUID,
    option_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get a single custom option."""
    result = await db.execute(
        select(CustomTicketOption)
        .join(CustomTicketOption.ticket_package)
        .join(CustomTicketOption.ticket_package.event)
        .where(
            and_(
                CustomTicketOption.id == option_id,
                CustomTicketOption.ticket_package_id == package_id,
                CustomTicketOption.ticket_package.has(
                    TicketPackage.event.has(npo_id=current_user.npo_id)
                ),
            )
        )
    )
    option = result.scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found")

    return option


@router.patch(
    "/admin/packages/{package_id}/options/{option_id}", response_model=CustomTicketOptionRead
)
async def update_custom_option(
    package_id: uuid.UUID,
    option_id: uuid.UUID,
    option_data: CustomTicketOptionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update a custom option.

    Note: Cannot update if option has responses from donors.
    """
    # Fetch option
    result = await db.execute(
        select(CustomTicketOption)
        .join(CustomTicketOption.ticket_package)
        .join(CustomTicketOption.ticket_package.event)
        .where(
            and_(
                CustomTicketOption.id == option_id,
                CustomTicketOption.ticket_package_id == package_id,
                CustomTicketOption.ticket_package.has(
                    TicketPackage.event.has(npo_id=current_user.npo_id)
                ),
            )
        )
    )
    option = result.scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found")

    # Check if option has responses (prevent breaking existing data)
    responses_count = await db.execute(
        select(func.count()).where(
            and_(
                CustomTicketOption.id == option_id,
                CustomTicketOption.responses.any(),
            )
        )
    )
    if responses_count.scalar_one() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot modify option with existing responses",
        )

    # Update fields
    if option_data.option_label is not None:
        option.option_label = option_data.option_label
    if option_data.option_type is not None:
        option.option_type = option_data.option_type
    if option_data.choices is not None:
        option.choices = {"choices": option_data.choices}
    if option_data.is_required is not None:
        option.is_required = option_data.is_required
    if option_data.display_order is not None:
        option.display_order = option_data.display_order

    await db.commit()
    await db.refresh(option)

    logger.info(f"Custom option updated: {option.id} by user {current_user.id}")

    return option


@router.delete(
    "/admin/packages/{package_id}/options/{option_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_custom_option(
    package_id: uuid.UUID,
    option_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Delete a custom option.

    Note: Cannot delete if option has responses from donors.
    """
    # Fetch option
    result = await db.execute(
        select(CustomTicketOption)
        .join(CustomTicketOption.ticket_package)
        .join(CustomTicketOption.ticket_package.event)
        .where(
            and_(
                CustomTicketOption.id == option_id,
                CustomTicketOption.ticket_package_id == package_id,
                CustomTicketOption.ticket_package.has(
                    TicketPackage.event.has(npo_id=current_user.npo_id)
                ),
            )
        )
    )
    option = result.scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found")

    # Check if option has responses
    responses_count = await db.execute(
        select(func.count()).where(
            and_(
                CustomTicketOption.id == option_id,
                CustomTicketOption.responses.any(),
            )
        )
    )
    if responses_count.scalar_one() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete option with existing responses",
        )

    await db.delete(option)
    await db.commit()

    logger.info(f"Custom option deleted: {option_id} by user {current_user.id}")
