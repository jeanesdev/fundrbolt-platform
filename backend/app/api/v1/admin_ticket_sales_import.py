"""Admin endpoints for ticket sales bulk import."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_user
from app.models.event import Event
from app.models.user import User
from app.schemas.ticket_sales_import import ImportResult, PreflightResult
from app.services.audit_service import AuditService
from app.services.ticket_sales_import_service import (
    TicketSalesImportError,
    TicketSalesImportService,
)

router = APIRouter(prefix="/admin/events", tags=["admin-ticket-sales-import"])
logger = get_logger(__name__)


def _safe_user_id(user: User) -> str | None:
    user_dict = getattr(user, "__dict__", {})
    if isinstance(user_dict, dict) and user_dict.get("id"):
        return str(user_dict["id"])
    return None


class ImportConfirmRequest(BaseModel):
    """Request body for confirming import."""

    preflight_id: str
    confirm: bool


def _require_event_admin(current_user: User, event: Event) -> None:
    """Check if user has admin permissions for the event."""
    if current_user.role_name not in ["super_admin", "npo_admin", "npo_staff"]:  # type: ignore[attr-defined]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to import ticket sales.",
        )

    if current_user.role_name != "super_admin":  # type: ignore[attr-defined]
        if hasattr(current_user, "npo_id") and current_user.npo_id != event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event.",
            )


@router.post(
    "/{event_id}/ticket-sales/import/preflight",
    response_model=PreflightResult,
    status_code=status.HTTP_200_OK,
)
async def preflight_import(
    event_id: UUID,
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PreflightResult:
    """Preflight ticket sales import.

    Validates an uploaded ticket sales file and returns row-level issues.
    """
    # Fetch event
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Check permissions
    _require_event_admin(current_user, event)

    try:
        # Read file
        file_bytes = await file.read()
        filename = file.filename or "upload"

        # Run preflight
        service = TicketSalesImportService(db)
        result = await service.preflight(event_id, file_bytes, filename, created_by=current_user.id)

        await db.commit()

        # Log audit
        await AuditService.log_ticket_sales_import(
            db=db,
            event_id=event_id,
            initiated_by_user_id=current_user.id,
            stage="preflight",
            total_rows=result.total_rows,
            error_count=result.error_rows,
        )

        return result
    except TicketSalesImportError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        await db.rollback()
        logger.exception(
            "Ticket sales import preflight failed",
            extra={
                "event_id": str(event_id),
                "user_id": _safe_user_id(current_user),
                "upload_filename": file.filename if file else None,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during preflight: {str(exc)}",
        ) from exc


@router.post(
    "/{event_id}/ticket-sales/import",
    response_model=ImportResult,
    status_code=status.HTTP_200_OK,
)
async def commit_import(
    event_id: UUID,
    preflight_id: str,
    confirm: bool,
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ImportResult:
    """Import ticket sales from a preflighted file.

    Executes the import using a preflight identifier.
    """
    # Fetch event
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Check permissions
    _require_event_admin(current_user, event)

    # Validate confirmation
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Import must be confirmed with confirm=true",
        )

    try:
        # Read file
        file_bytes = await file.read()

        # Run import
        service = TicketSalesImportService(db)
        result = await service.commit_import(
            event_id=event_id,
            preflight_id=UUID(preflight_id),
            file_bytes=file_bytes,
            user_id=current_user.id,
        )

        await db.commit()

        # Log audit
        await AuditService.log_ticket_sales_import(
            db=db,
            event_id=event_id,
            initiated_by_user_id=current_user.id,
            stage="commit",
            total_rows=result.created_rows + result.skipped_rows + result.failed_rows,
            error_count=result.failed_rows,
        )

        return result
    except TicketSalesImportError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during import: {str(exc)}",
        ) from exc
