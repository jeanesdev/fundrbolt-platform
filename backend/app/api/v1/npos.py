"""
NPO Management API Endpoints

Provides REST API for NPO creation, listing, and management.
Access control enforced via permissions service.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.request_id import get_request_id
from app.models.npo import NPOStatus
from app.models.user import User
from app.schemas.npo import (
    NPOCreateRequest,
    NPOCreateResponse,
    NPODetailResponse,
    NPOListRequest,
    NPOListResponse,
    NPOResponse,
    NPOStatusUpdateRequest,
    NPOUpdateRequest,
)
from app.services.audit_service import AuditService
from app.services.npo_permission_service import NPOPermissionService
from app.services.npo_service import NPOService

router = APIRouter(prefix="/npos", tags=["NPOs"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=NPOCreateResponse,
)
async def create_npo(
    npo_data: NPOCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
) -> NPOCreateResponse:
    """
    Create a new NPO in DRAFT status.

    **Access Control:**
    - Any authenticated user can create an NPO
    - User automatically becomes NPO Admin (primary owner)

    **Business Rules:**
    - NPO name must be globally unique
    - NPO starts in DRAFT status
    - Creator becomes first NPO member with 'admin' role
    - Email format validated
    - Tax ID format validated (optional field)

    **Args:**
        npo_data: NPO creation data
        current_user: Authenticated user (auto-becomes admin)
        db: Database session
        request_id: Request tracing ID

    **Returns:**
        Created NPO with ID and status

    **Raises:**
        400: Invalid data or duplicate name
        401: User not authenticated
    """
    # Create NPO
    npo = await NPOService.create_npo(db, npo_data, current_user.id)

    # Log audit event
    await AuditService.log_npo_created(
        db=db,
        npo_id=npo.id,
        npo_name=npo.name,
        created_by_user_id=current_user.id,
        created_by_email=current_user.email,
        ip_address=None,  # TODO: Extract from request
    )

    return NPOCreateResponse(
        npo=NPOResponse.model_validate(npo),
        message="NPO created successfully in DRAFT status. Complete details and submit for approval.",
    )


@router.get("", response_model=NPOListResponse)
async def list_npos(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    npo_status: Annotated[str | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query()] = None,
    created_by_user_id: Annotated[uuid.UUID | None, Query()] = None,
) -> NPOListResponse:
    """
    List NPOs with filtering and pagination.

    **Access Control:**
    - Super Admin: See all NPOs
    - NPO Admin/Staff: See only NPOs they're members of
    - Other roles: See only their own created NPOs

    **Query Parameters:**
    - page: Page number (default: 1)
    - page_size: Items per page (default: 20, max: 100)
    - status: Filter by status (DRAFT, PENDING_APPROVAL, APPROVED, SUSPENDED, REJECTED)
    - search: Search in name, description, mission_statement
    - created_by_user_id: Filter by creator (SuperAdmin only)

    **Returns:**
        Paginated list of NPOs

    **Raises:**
        401: User not authenticated
    """
    # Convert status string to enum if provided
    status_enum = None
    if npo_status:
        try:
            status_enum = NPOStatus(npo_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {npo_status}. Valid options: {[s.value for s in NPOStatus]}",
            )

    # Build filter parameters
    list_params = NPOListRequest(
        page=page,
        page_size=page_size,
        status=status_enum if status_enum else None,
        search=search,
        created_by_user_id=created_by_user_id,
    )

    # Get filtered NPOs based on user permissions
    npos, total = await NPOService.list_npos(db, current_user, list_params)

    return NPOListResponse(
        items=[NPOResponse.model_validate(npo) for npo in npos],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{npo_id}", response_model=NPODetailResponse)
async def get_npo(
    npo_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> NPODetailResponse:
    """
    Get detailed NPO information including branding and members.

    **Access Control:**
    - Super Admin: View any NPO
    - NPO Member: View their NPO
    - Creator: View NPOs they created
    - Others: Denied

    **Args:**
        npo_id: NPO UUID
        current_user: Authenticated user
        db: Database session

    **Returns:**
        Detailed NPO information with relationships

    **Raises:**
        401: User not authenticated
        403: User doesn't have permission to view this NPO
        404: NPO not found
    """
    # Check permission
    permission_service = NPOPermissionService()
    can_view = await permission_service.can_view_npo(db, current_user, npo_id)

    if not can_view:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this NPO",
        )

    # Get NPO with relationships
    npo = await NPOService.get_npo_by_id(db, npo_id)

    if not npo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NPO with ID {npo_id} not found",
        )

    # Calculate member counts
    member_count = len(npo.members) if npo.members else 0
    active_member_count = sum(1 for m in npo.members if m.status == "active") if npo.members else 0

    # Create response with member counts
    response_data = NPODetailResponse.model_validate(npo)
    response_data.member_count = member_count
    response_data.active_member_count = active_member_count

    return response_data


@router.patch("/{npo_id}", response_model=NPOResponse)
async def update_npo(
    npo_id: uuid.UUID,
    npo_data: NPOUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
) -> NPOResponse:
    """
    Update NPO details (admin only).

    **Access Control:**
    - Super Admin: Update any NPO
    - NPO Admin: Update their NPO
    - Others: Denied

    **Business Rules:**
    - Only DRAFT and APPROVED NPOs can be edited
    - PENDING_APPROVAL NPOs cannot be edited (must be rejected first)
    - Name changes must maintain global uniqueness
    - Cannot change created_by_user_id

    **Args:**
        npo_id: NPO UUID
        npo_data: Partial update data
        current_user: Authenticated user
        db: Database session
        request_id: Request tracing ID

    **Returns:**
        Updated NPO

    **Raises:**
        401: User not authenticated
        403: User doesn't have permission to update this NPO
        404: NPO not found
        409: Name conflict or invalid status for editing
    """
    # Check permission
    permission_service = NPOPermissionService()
    can_manage = await permission_service.can_manage_npo(db, current_user, npo_id)

    if not can_manage:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this NPO",
        )

    # Update NPO
    npo = await NPOService.update_npo(db, npo_id, npo_data, current_user.id)

    # Log audit event
    await AuditService.log_npo_updated(
        db=db,
        npo_id=npo.id,
        npo_name=npo.name,
        updated_by_user_id=current_user.id,
        updated_by_email=current_user.email,
        changes=npo_data.model_dump(exclude_unset=True),
        ip_address=None,
    )

    return NPOResponse.model_validate(npo)


@router.patch("/{npo_id}/status", response_model=NPOResponse)
async def update_npo_status(
    npo_id: uuid.UUID,
    status_data: NPOStatusUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
) -> NPOResponse:
    """
    Update NPO status (SuperAdmin only).

    **Access Control:**
    - Super Admin only

    **Valid Transitions:**
    - DRAFT → PENDING_APPROVAL (submission)
    - PENDING_APPROVAL → APPROVED (approval)
    - PENDING_APPROVAL → REJECTED (rejection)
    - APPROVED → SUSPENDED (suspension)
    - SUSPENDED → APPROVED (reactivation)

    **Args:**
        npo_id: NPO UUID
        status_data: New status and optional notes
        current_user: Authenticated SuperAdmin
        db: Database session
        request_id: Request tracing ID

    **Returns:**
        Updated NPO

    **Raises:**
        401: User not authenticated
        403: User is not SuperAdmin
        404: NPO not found
        409: Invalid status transition
    """
    # Check permission (SuperAdmin only)
    if current_user.role_name != "super_admin":  # type: ignore[attr-defined]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SuperAdmins can update NPO status",
        )

    # Update status
    npo = await NPOService.update_npo_status(db, npo_id, status_data.status, status_data.notes)

    # Log audit event
    await AuditService.log_npo_status_changed(
        db=db,
        npo_id=npo.id,
        npo_name=npo.name,
        old_status=None,  # TODO: Pass from service
        new_status=npo.status.value,
        changed_by_user_id=current_user.id,
        changed_by_email=current_user.email,
        notes=status_data.notes,
        ip_address=None,
    )

    return NPOResponse.model_validate(npo)


@router.post(
    "/{npo_id}/submit",
    response_model=NPOResponse,
    summary="Submit NPO application for review",
    description="Submit NPO application for SuperAdmin review (changes status from DRAFT to PENDING_APPROVAL)",
)
async def submit_npo_application(
    npo_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> NPOResponse:
    """
    Submit NPO application for SuperAdmin review.

    **Access Control:**
    - NPO creator only

    **Business Rules:**
    - NPO must be in DRAFT status
    - All required fields must be complete
    - State transition: DRAFT → PENDING_APPROVAL
    - Email notification sent to applicant

    **Args:**
        npo_id: NPO UUID
        current_user: Authenticated NPO creator
        db: Database session

    **Returns:**
        Updated NPO with PENDING_APPROVAL status

    **Raises:**
        401: User not authenticated
        403: User is not NPO creator
        404: NPO not found
        400: Validation failed or invalid state
    """
    from app.services.application_service import ApplicationService
    from app.services.email_service import get_email_service

    # Submit application
    npo = await ApplicationService.submit_application(
        db=db,
        npo_id=npo_id,
        submitted_by_user_id=current_user.id,
    )

    # Send confirmation email
    email_service = get_email_service()
    creator_name = current_user.first_name if current_user.first_name else None

    try:
        # Send confirmation to NPO creator
        await email_service.send_application_submitted_email(
            to_email=current_user.email,
            npo_name=npo.name,
            applicant_name=creator_name,
        )

        # Send notification to admins
        await email_service.send_admin_application_notification_email(
            npo_name=npo.name,
            npo_email=npo.email,
            applicant_name=creator_name,
        )
    except Exception as e:
        # Log error but don't fail the request - application was already submitted
        from app.core.logging import get_logger

        logger = get_logger(__name__)
        logger.error(
            "Failed to send application submitted email",
            extra={
                "npo_id": str(npo_id),
                "error": str(e),
            },
        )

    return NPOResponse.model_validate(npo)


@router.delete("/{npo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_npo(
    npo_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request_id: Annotated[str, Depends(get_request_id)],
) -> None:
    """
    Soft delete NPO (SuperAdmin only).

    **Access Control:**
    - Super Admin only

    **Business Rules:**
    - Only DRAFT or REJECTED NPOs can be deleted
    - APPROVED or SUSPENDED NPOs must be suspended first
    - Soft delete: Sets deleted_at timestamp, keeps data for audit

    **Args:**
        npo_id: NPO UUID
        current_user: Authenticated SuperAdmin
        db: Database session
        request_id: Request tracing ID

    **Raises:**
        401: User not authenticated
        403: User is not SuperAdmin
        404: NPO not found
        409: NPO status doesn't allow deletion
    """
    # Check permission (SuperAdmin only)
    if current_user.role_name != "super_admin":  # type: ignore[attr-defined]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SuperAdmins can delete NPOs",
        )

    # Delete NPO
    await NPOService.delete_npo(db, npo_id, current_user.id)

    # Note: Audit logging handled in service layer
