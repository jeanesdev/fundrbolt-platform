"""Admin endpoints for registration bulk import."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.event import Event
from app.models.user import User
from app.schemas.registration_import import ImportReport
from app.services.audit_service import AuditService
from app.services.registration_import_service import (
    RegistrationImportError,
    RegistrationImportService,
)

router = APIRouter(prefix="/admin/events", tags=["admin-registrations-import"])


def _require_event_admin(current_user: User, event: Event) -> None:
    """Require event admin permissions."""
    if current_user.role_name not in ["super_admin", "npo_admin", "npo_staff"]:  # type: ignore[attr-defined]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to import registrations.",
        )

    if current_user.role_name != "super_admin":  # type: ignore[attr-defined]
        if hasattr(current_user, "npo_id") and current_user.npo_id != event.npo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event.",
            )


@router.post(
    "/{event_id}/registrations/import/preflight",
    response_model=ImportReport,
    status_code=status.HTTP_200_OK,
)
async def preflight_import(
    event_id: UUID,
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ImportReport:
    """Run preflight validation for registration import.

    This endpoint validates the uploaded file without creating any records.
    It checks for:
    - Required fields presence
    - Valid data types and formats
    - Duplicate external registration IDs within the file
    - Existing registrations in the database (warnings)
    - Ticket package existence
    - Row limit enforcement (5,000 rows max)

    The response includes validation results with errors and warnings.
    """
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    _require_event_admin(current_user, event)

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is required"
        )

    try:
        file_bytes = await file.read()
        service = RegistrationImportService(db)
        report = await service.preflight(event_id, file_bytes, file.filename)

        await AuditService.log_registration_import(
            db=db,
            event_id=event_id,
            initiated_by_user_id=current_user.id,
            stage="preflight",
            total_rows=report.total_rows,
            created_count=0,
            error_count=report.error_rows,
        )

        return report
    except RegistrationImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/{event_id}/registrations/import/commit",
    response_model=ImportReport,
    status_code=status.HTTP_200_OK,
)
async def commit_import(
    event_id: UUID,
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ImportReport:
    """Execute registration import and create records.

    This endpoint performs the actual import after successful preflight.
    It creates:
    - Event registration records
    - Registration guest records
    - Links to ticket packages

    Rows with errors are skipped. Rows with existing external_registration_id
    are also skipped with warnings.

    The response includes counts of created, skipped, and failed records.
    """
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    _require_event_admin(current_user, event)

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is required"
        )

    try:
        file_bytes = await file.read()
        service = RegistrationImportService(db)
        report = await service.commit(event_id, file_bytes, file.filename, current_user.id)

        await AuditService.log_registration_import(
            db=db,
            event_id=event_id,
            initiated_by_user_id=current_user.id,
            stage="commit",
            total_rows=report.total_rows,
            created_count=report.created_count,
            error_count=report.error_rows,
        )

        return report
    except RegistrationImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
