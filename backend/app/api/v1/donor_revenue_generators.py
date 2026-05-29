"""Donor PWA API endpoints for Revenue Generator items."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.user import User
from app.schemas.revenue_generator import (
    EntryPurchaseRequest,
    EntryPurchaseResponse,
    RevenueGeneratorDonorListResponse,
)
from app.services.revenue_generator_service import RevenueGeneratorService

router = APIRouter(prefix="/donor/events", tags=["donor-revenue-generators"])


@router.get(
    "/{event_id}/revenue-generators",
    response_model=RevenueGeneratorDonorListResponse,
    summary="List visible revenue generator items for a donor",
)
async def list_revenue_generator_items_donor(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RevenueGeneratorDonorListResponse:
    """Return all visible revenue generator items for the event with donor-specific data."""
    return await RevenueGeneratorService.list_items_donor(db, event_id, current_user.id)


@router.post(
    "/{event_id}/revenue-generators/{item_id}/entries",
    response_model=EntryPurchaseResponse,
    summary="Purchase a revenue generator entry",
    status_code=201,
)
async def purchase_revenue_generator_entry(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    purchase_request: EntryPurchaseRequest | None = None,
) -> EntryPurchaseResponse:
    """Record a revenue generator entry for the authenticated donor."""
    from fastapi import HTTPException

    try:
        quantity = purchase_request.quantity if purchase_request else 1
        result = await RevenueGeneratorService.create_donor_entry(
            db, event_id, item_id, current_user.id, quantity=quantity
        )
        await db.commit()
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
