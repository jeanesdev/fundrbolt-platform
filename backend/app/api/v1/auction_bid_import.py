"""Admin endpoints for auction bid import."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.event import Event
from app.models.user import User
from app.schemas.auction_bid_import import BidsDashboard, ImportSummary, PreflightResult
from app.services.auction_bid_import_service import (
    AuctionBidImportService,
    ImportValidationError,
)

router = APIRouter(prefix="/api/v1/events", tags=["auction-bid-import"])


def _require_event_admin(current_user: User, event: Event) -> None:
    """Verify user has admin access to event."""
    if current_user.role_name not in ["super_admin", "npo_admin", "npo_staff"]:  # type: ignore[attr-defined]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to import auction bids.",
        )

    if current_user.role_name != "super_admin":  # type: ignore[attr-defined]
        if hasattr(current_user, "npo_id") and current_user.npo_id != event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event.",
            )


@router.get(
    "/{event_id}/auction/bids/dashboard",
    response_model=BidsDashboard,
    status_code=status.HTTP_200_OK,
)
async def get_bids_dashboard(
    event_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BidsDashboard:
    """Get auction bids dashboard summary for an event."""
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    _require_event_admin(current_user, event)

    service = AuctionBidImportService(db)
    return await service.get_dashboard(event_id)


@router.post(
    "/{event_id}/auction/bids/import/preflight",
    response_model=PreflightResult,
    status_code=status.HTTP_200_OK,
)
async def preflight_import(
    event_id: UUID,
    file: Annotated[UploadFile, File(...)],
    file_type: Annotated[str, Form(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PreflightResult:
    """Run preflight validation on auction bid import file."""
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    _require_event_admin(current_user, event)

    # Validate file type
    if file_type not in ["json", "csv", "xlsx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file_type. Must be json, csv, or xlsx.",
        )

    try:
        file_bytes = await file.read()
        service = AuctionBidImportService(db)
        return await service.preflight(event_id, file_bytes, file_type, current_user.id)
    except ImportValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/{event_id}/auction/bids/import/confirm",
    response_model=ImportSummary,
    status_code=status.HTTP_200_OK,
)
async def confirm_import(
    event_id: UUID,
    import_batch_id: Annotated[str, Form(...)],
    file: Annotated[UploadFile, File(...)],
    file_type: Annotated[str, Form(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ImportSummary:
    """Confirm and execute a preflighted auction bid import."""
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    _require_event_admin(current_user, event)

    # Validate file type
    if file_type not in ["json", "csv", "xlsx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file_type. Must be json, csv, or xlsx.",
        )

    try:
        file_bytes = await file.read()
        service = AuctionBidImportService(db)
        return await service.confirm(event_id, import_batch_id, file_bytes, file_type)
    except ImportValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
