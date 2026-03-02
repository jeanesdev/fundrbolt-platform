"""Admin API endpoints for promo code management."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_active_user
from app.models.event import Event
from app.models.ticket_management import PromoCode
from app.models.user import User
from app.schemas.ticket_management import PromoCodeCreate, PromoCodeRead, PromoCodeUpdate
from app.services.permission_service import PermissionService

logger = get_logger(__name__)
router = APIRouter()


async def _require_event_access(
    db: AsyncSession,
    current_user: User,
    event_id: uuid.UUID,
) -> Event:
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    permission_service = PermissionService()
    has_access = await permission_service.can_view_event(current_user, event.npo_id, db=db)
    if not has_access:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    return event


@router.post(
    "/admin/events/{event_id}/promo-codes",
    response_model=PromoCodeRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create promo code",
)
async def create_promo_code(
    event_id: uuid.UUID,
    promo_data: PromoCodeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Create a new promo code for an event.

    Business Rules:
    - Event must belong to user's NPO
    - Code must be unique per event (case-insensitive)
    - start_date must be before end_date
    - Percentage discount: 0-100
    - Fixed discount: Must be positive
    - Usage limit optional (unlimited if None)
    """
    # Verify event access
    await _require_event_access(db, current_user, event_id)

    # Check duplicate code (case-insensitive)
    dup_result = await db.execute(
        select(func.count(PromoCode.id)).where(
            and_(
                PromoCode.event_id == event_id,
                func.lower(PromoCode.code) == promo_data.code.lower(),
            )
        )
    )
    if dup_result.scalar_one() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Promo code '{promo_data.code}' already exists",
        )

    # Validate date range
    if promo_data.valid_from and promo_data.valid_until:
        if promo_data.valid_from >= promo_data.valid_until:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="valid_from must be before valid_until",
            )

    # Create promo code
    new_promo = PromoCode(
        event_id=event_id,
        code=promo_data.code.upper(),  # Store as uppercase for consistency
        discount_type=promo_data.discount_type,
        discount_value=promo_data.discount_value,
        valid_from=promo_data.valid_from,
        valid_until=promo_data.valid_until,
        max_uses=promo_data.max_uses,
        used_count=0,
        is_active=promo_data.is_active,
        created_by=current_user.id,
    )

    db.add(new_promo)
    await db.commit()
    await db.refresh(new_promo)

    logger.info(f"Promo code created: {new_promo.code} for event {event_id}")
    return new_promo


@router.get(
    "/admin/events/{event_id}/promo-codes",
    response_model=list[PromoCodeRead],
    summary="List promo codes",
)
async def list_promo_codes(
    event_id: uuid.UUID,
    include_inactive: bool = Query(False, description="Include inactive codes"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """List all promo codes for an event.

    Filters:
    - include_inactive: Show inactive codes (default: false)
    """
    # Verify event access
    await _require_event_access(db, current_user, event_id)

    # Build query
    query = select(PromoCode).where(PromoCode.event_id == event_id)
    if not include_inactive:
        query = query.where(PromoCode.is_active == True)  # noqa: E712

    query = query.order_by(PromoCode.created_at.desc())

    result = await db.execute(query)
    promo_codes = result.scalars().all()

    return promo_codes


@router.get(
    "/admin/events/{event_id}/promo-codes/{promo_id}",
    response_model=PromoCodeRead,
    summary="Get promo code",
)
async def get_promo_code(
    event_id: uuid.UUID,
    promo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get a single promo code by ID."""
    # Verify event access and get promo code
    await _require_event_access(db, current_user, event_id)
    result = await db.execute(
        select(PromoCode).where(
            and_(
                PromoCode.id == promo_id,
                PromoCode.event_id == event_id,
            )
        )
    )
    promo_code = result.scalar_one_or_none()

    if not promo_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promo code not found")

    return promo_code


@router.patch(
    "/admin/events/{event_id}/promo-codes/{promo_id}",
    response_model=PromoCodeRead,
    summary="Update promo code",
)
async def update_promo_code(
    event_id: uuid.UUID,
    promo_id: uuid.UUID,
    promo_data: PromoCodeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update an existing promo code.

    Business Rules:
    - Cannot change code, discount_type, or discount_value if already used
    - Can update dates, usage_limit, and is_active at any time
    """
    # Get promo code
    await _require_event_access(db, current_user, event_id)
    result = await db.execute(
        select(PromoCode).where(
            and_(
                PromoCode.id == promo_id,
                PromoCode.event_id == event_id,
            )
        )
    )
    promo_code = result.scalar_one_or_none()

    if not promo_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promo code not found")

    # Check if promo has been used
    has_usage = promo_code.used_count > 0

    # Update fields
    update_data = promo_data.model_dump(exclude_unset=True)

    # Prevent changing critical fields if used
    if has_usage:
        restricted_fields = ["code", "discount_type", "discount_value"]
        for field in restricted_fields:
            if field in update_data:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot update {field} - promo code has been used",
                )

    # Validate date range if both dates provided
    new_start = update_data.get("valid_from", promo_code.valid_from)
    new_end = update_data.get("valid_until", promo_code.valid_until)
    if new_start and new_end and new_start >= new_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="valid_from must be before valid_until",
        )

    # Validate max_uses not below current usage
    if "max_uses" in update_data and update_data["max_uses"] is not None:
        if update_data["max_uses"] < promo_code.used_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"max_uses cannot be below current usage ({promo_code.used_count})",
            )

    # Apply updates
    for field, value in update_data.items():
        setattr(promo_code, field, value)

    await db.commit()
    await db.refresh(promo_code)

    logger.info(f"Promo code updated: {promo_code.code} (ID: {promo_id})")
    return promo_code


@router.delete(
    "/admin/events/{event_id}/promo-codes/{promo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete promo code",
)
async def delete_promo_code(
    event_id: uuid.UUID,
    promo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Delete a promo code.

    Business Rules:
    - Cannot delete if already used
    """
    # Get promo code
    await _require_event_access(db, current_user, event_id)
    result = await db.execute(
        select(PromoCode).where(
            and_(
                PromoCode.id == promo_id,
                PromoCode.event_id == event_id,
            )
        )
    )
    promo_code = result.scalar_one_or_none()

    if not promo_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promo code not found")

    # Check if used
    if promo_code.used_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete - promo code has {promo_code.used_count} uses",
        )

    await db.delete(promo_code)
    await db.commit()

    logger.info(f"Promo code deleted: {promo_code.code} (ID: {promo_id})")


@router.post(
    "/admin/events/{event_id}/promo-codes/validate/{code}",
    response_model=PromoCodeRead,
    summary="Validate promo code",
)
async def validate_promo_code(
    event_id: uuid.UUID,
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Validate a promo code without incrementing usage.

    Checks:
    - Code exists and is active
    - Within date range (if specified)
    - Under usage limit (if specified)

    Returns the promo code if valid, raises 404/400 if invalid.
    """
    # Verify event access
    await _require_event_access(db, current_user, event_id)

    # Find promo code (case-insensitive)
    promo_result = await db.execute(
        select(PromoCode).where(
            and_(
                PromoCode.event_id == event_id,
                func.lower(PromoCode.code) == code.lower(),
            )
        )
    )
    promo_code: PromoCode | None = promo_result.scalar_one_or_none()

    if not promo_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid promo code")

    # Check if active
    if not promo_code.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Promo code is inactive"
        )

    # Check date range
    now = datetime.utcnow()
    if promo_code.valid_from and now < promo_code.valid_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Promo code not yet valid",
        )
    if promo_code.valid_until and now > promo_code.valid_until:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Promo code expired")

    # Check usage limit
    if promo_code.max_uses and promo_code.used_count >= promo_code.max_uses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Promo code usage limit reached",
        )

    return promo_code
