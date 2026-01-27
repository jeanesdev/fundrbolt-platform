"""Admin endpoints for auction item bulk import."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.event import Event
from app.models.user import User
from app.schemas.auction_item_import import ImportReport
from app.services.auction_item_import_service import AuctionItemImportService
from app.services.auction_item_import_zip import ImportZipValidationError
from app.services.audit_service import AuditService

router = APIRouter(prefix="/admin/events", tags=["admin-auction-items-import"])


def _require_event_admin(current_user: User, event: Event) -> None:
    if current_user.role_name not in ["super_admin", "npo_admin", "npo_staff"]:  # type: ignore[attr-defined]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to import auction items.",
        )

    if current_user.role_name != "super_admin":  # type: ignore[attr-defined]
        if hasattr(current_user, "npo_id") and current_user.npo_id != event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event.",
            )


def _require_import_allowed() -> None:
    settings = get_settings()
    if settings.environment == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bulk import is disabled in production environments.",
        )


@router.post(
    "/{event_id}/auction-items/import/preflight",
    response_model=ImportReport,
    status_code=status.HTTP_200_OK,
)
async def preflight_import(
    event_id: UUID,
    zip_file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ImportReport:
    _require_import_allowed()

    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    _require_event_admin(current_user, event)

    try:
        zip_bytes = await zip_file.read()
        service = AuctionItemImportService(db)
        report = await service.preflight(event_id, zip_bytes)
        await AuditService.log_auction_item_import(
            db=db,
            event_id=event_id,
            initiated_by_user_id=current_user.id,
            stage="preflight",
            total_rows=report.total_rows,
            created_count=report.created_count,
            updated_count=report.updated_count,
            error_count=report.error_count,
        )
        return report
    except ImportZipValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/{event_id}/auction-items/import/commit",
    response_model=ImportReport,
    status_code=status.HTTP_200_OK,
)
async def commit_import(
    event_id: UUID,
    zip_file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ImportReport:
    _require_import_allowed()

    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    _require_event_admin(current_user, event)

    try:
        zip_bytes = await zip_file.read()
        service = AuctionItemImportService(db)
        report = await service.commit(event_id, zip_bytes, current_user.id)
        await AuditService.log_auction_item_import(
            db=db,
            event_id=event_id,
            initiated_by_user_id=current_user.id,
            stage="commit",
            total_rows=report.total_rows,
            created_count=report.created_count,
            updated_count=report.updated_count,
            error_count=report.error_count,
        )
        return report
    except ImportZipValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
