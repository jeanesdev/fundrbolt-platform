"""Admin endpoints for user import."""

from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.npo_member import MemberStatus, NPOMember
from app.models.user import User
from app.schemas.user_import import (
    ErrorReportRequest,
    ErrorReportResponse,
    ImportResult,
    PreflightResult,
)
from app.services.audit_service import AuditService
from app.services.npo_permission_service import NPOPermissionService
from app.services.user_import_service import UserImportError, UserImportService

router = APIRouter(prefix="/admin/users/import", tags=["admin-user-import"])


def _get_user_id(current_user: User) -> UUID:
    """Get user id without triggering lazy loads."""
    user_id = current_user.__dict__.get("id")
    if isinstance(user_id, UUID):
        return user_id
    identity = getattr(current_user, "_sa_instance_state", None)
    if identity and identity.identity:
        identity_id = identity.identity[0]
        if isinstance(identity_id, UUID):
            return identity_id
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unable to resolve current user id",
    )


async def _resolve_npo_id(
    db: AsyncSession, current_user: User, requested_npo_id: UUID | None
) -> UUID | None:
    """Resolve target NPO id for imports based on user permissions."""
    role_name = getattr(current_user, "role_name", "unknown")
    if role_name == "super_admin":
        return requested_npo_id

    if requested_npo_id is None:
        member_stmt = select(NPOMember.npo_id).where(
            NPOMember.user_id == current_user.id,
            NPOMember.status == MemberStatus.ACTIVE,
        )
        member_result = await db.execute(member_stmt)
        npo_ids = list({cast(UUID, row[0]) for row in member_result.all()})
        if len(npo_ids) == 1:
            return npo_ids[0]

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="NPO context is required for user import",
        )

    permission_service = NPOPermissionService()
    if not await permission_service.is_npo_member(db, current_user, requested_npo_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this NPO",
        )

    return requested_npo_id


@router.post("/preflight", response_model=PreflightResult, status_code=status.HTTP_200_OK)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def preflight_user_import(
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    npo_id: UUID | None = Query(default=None),
) -> PreflightResult:
    """Preflight user import file without creating records.

    Validates JSON/CSV rows and returns counts with row-level issues, including:
    - Required fields (full_name, email, role)
    - Duplicate emails within the file
    - NPO-scoped role enforcement (no super_admin)
    - NPO identifier mismatch warnings
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is required")

    target_npo_id = await _resolve_npo_id(db, current_user, npo_id)

    try:
        file_bytes = await file.read()
        service = UserImportService(db)
        report = await service.preflight(
            npo_id=target_npo_id,
            file_bytes=file_bytes,
            filename=file.filename,
            initiated_by_user_id=_get_user_id(current_user),
        )
        await AuditService.log_user_import(
            db=db,
            npo_id=target_npo_id,
            initiated_by_user_id=_get_user_id(current_user),
            stage="preflight",
            total_rows=report.total_rows,
            created_count=0,
            skipped_count=0,
            membership_added_count=0,
            error_count=report.error_rows,
        )
        return report
    except UserImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/commit", response_model=ImportResult, status_code=status.HTTP_200_OK)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def commit_user_import(
    file: Annotated[UploadFile, File(...)],
    preflight_id: Annotated[str, Form(...)],
    confirm: Annotated[bool, Form(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    npo_id: UUID | None = Query(default=None),
) -> ImportResult:
    """Commit user import after successful preflight.

    Requires the same file checksum and a preflight with zero errors.
    Creates new users, adds memberships for existing users in other NPOs,
    and skips users already in the selected NPO.
    """
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Import must be confirmed with confirm=true",
        )

    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is required")

    target_npo_id = await _resolve_npo_id(db, current_user, npo_id)

    try:
        file_bytes = await file.read()
        service = UserImportService(db)
        report = await service.commit(
            npo_id=target_npo_id,
            preflight_id=preflight_id,
            file_bytes=file_bytes,
            initiated_by_user_id=_get_user_id(current_user),
        )
        await AuditService.log_user_import(
            db=db,
            npo_id=target_npo_id,
            initiated_by_user_id=_get_user_id(current_user),
            stage="commit",
            total_rows=report.created_rows
            + report.skipped_rows
            + report.membership_added_rows
            + report.failed_rows,
            created_count=report.created_rows,
            skipped_count=report.skipped_rows,
            membership_added_count=report.membership_added_rows,
            error_count=report.failed_rows,
        )
        return report
    except UserImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/error-report", response_model=ErrorReportResponse, status_code=status.HTTP_200_OK)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def build_error_report(
    request: ErrorReportRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ErrorReportResponse:
    """Generate downloadable error report for user import results."""
    _ = current_user
    _ = db
    service = UserImportService(db)
    return service.build_error_report(request)
