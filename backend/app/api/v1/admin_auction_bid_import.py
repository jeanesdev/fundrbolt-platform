"""Admin endpoints for auction bid import and dashboard."""

import asyncio
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_user
from app.models.event import Event
from app.models.user import User
from app.schemas.auction_bid_import import (
    AuctionBidDashboardResponse,
    AuctionBidImportSummary,
    AuctionBidPreflightResult,
)
from app.services.auction_bid_import_service import (
    AuctionBidImportError,
    AuctionBidImportService,
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/admin/events", tags=["admin-auction-bids-import"])
logger = get_logger(__name__)


def _require_event_admin(current_user: User, event: Event) -> None:
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
    "/{event_id}/auction-bids/dashboard",
    response_model=AuctionBidDashboardResponse,
    status_code=status.HTTP_200_OK,
)
async def get_auction_bid_dashboard(
    event_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuctionBidDashboardResponse:
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    _require_event_admin(current_user, event)

    service = AuctionBidImportService(db)
    return await service.get_dashboard(event_id)


@router.post(
    "/{event_id}/auction-bids/import/preflight",
    response_model=AuctionBidPreflightResult,
    status_code=status.HTTP_200_OK,
)
async def preflight_auction_bid_import(
    event_id: UUID,
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuctionBidPreflightResult:
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    _require_event_admin(current_user, event)

    try:
        file_bytes = await file.read()
        filename = file.filename or "upload"
        service = AuctionBidImportService(db)
        result = await service.preflight(event_id, file_bytes, filename, current_user.id)

        await AuditService.log_auction_bid_import(
            db=db,
            event_id=event_id,
            initiated_by_user_id=current_user.id,
            stage="preflight",
            total_rows=result.total_rows,
            error_count=result.invalid_rows,
            commit=False,
        )
        await db.commit()
        logger.info(
            "Auction bid preflight response ready",
            extra={"event_id": str(event_id), "import_batch_id": result.import_batch_id},
        )

        return result
    except asyncio.CancelledError:
        logger.warning(
            "Auction bid preflight cancelled",
            extra={"event_id": str(event_id), "upload_filename": file.filename if file else None},
        )
        raise
    except AuctionBidImportError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        await db.rollback()
        logger.exception(
            "Auction bid import preflight failed",
            extra={"event_id": str(event_id), "upload_filename": file.filename if file else None},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during preflight: {str(exc)}",
        ) from exc


@router.post(
    "/{event_id}/auction-bids/import/confirm",
    response_model=AuctionBidImportSummary,
    status_code=status.HTTP_200_OK,
)
async def confirm_auction_bid_import(
    event_id: UUID,
    import_batch_id: Annotated[UUID, Form(...)],
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuctionBidImportSummary:
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    _require_event_admin(current_user, event)

    try:
        file_bytes = await file.read()
        service = AuctionBidImportService(db)
        result = await service.confirm_import(
            event_id=event_id,
            import_batch_id=import_batch_id,
            file_bytes=file_bytes,
            user_id=current_user.id,
        )

        await AuditService.log_auction_bid_import(
            db=db,
            event_id=event_id,
            initiated_by_user_id=current_user.id,
            stage="confirm",
            total_rows=result.created_bids,
            error_count=0,
            commit=False,
        )
        await db.commit()
        logger.info(
            "Auction bid confirm response ready",
            extra={"event_id": str(event_id), "import_batch_id": result.import_batch_id},
        )

        return result
    except asyncio.CancelledError:
        logger.warning(
            "Auction bid confirm cancelled",
            extra={"event_id": str(event_id), "import_batch_id": str(import_batch_id)},
        )
        raise
    except AuctionBidImportError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        await db.rollback()
        logger.exception(
            "Auction bid import confirm failed",
            extra={"event_id": str(event_id)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during import: {str(exc)}",
        ) from exc
