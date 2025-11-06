"""Admin API endpoints for SuperAdmin operations."""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.npo import NPOResponse
from app.services.application_service import ApplicationService
from app.services.email_service import get_email_service

router = APIRouter(prefix="/admin", tags=["admin"])


class ApplicationReviewRequest(BaseModel):
    """Request schema for reviewing an NPO application."""

    decision: str  # "approve" or "reject"
    notes: str | None = None


def require_superadmin(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    """
    Dependency to ensure current user is a SuperAdmin.

    Args:
        current_user: Current authenticated user

    Returns:
        User object if SuperAdmin

    Raises:
        HTTPException: 403 if user is not SuperAdmin
    """
    # Check if user has SuperAdmin role
    # Note: role_name is attached by get_current_user middleware
    if getattr(current_user, "role_name", None) != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SuperAdmin privileges required for this operation",
        )
    return current_user


@router.get(
    "/npos/applications",
    response_model=dict,
    summary="Get pending NPO applications",
    description="Retrieve list of NPO applications with PENDING_APPROVAL status (SuperAdmin only)",
)
async def get_pending_applications(
    page: int = 1,
    page_size: int = 50,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> dict[str, Any]:
    """
    Get all pending NPO applications.

    **SuperAdmin only**

    Returns paginated list of NPOs awaiting approval.

    Args:
        page: Page number (1-indexed)
        page_size: Number of items per page
        status: Filter by status (optional, currently ignored - always returns pending)
        db: Database session
        current_user: Current SuperAdmin user

    Returns:
        Dictionary with applications list and pagination metadata
    """
    # Calculate skip from page number
    skip = (page - 1) * page_size

    npos, total = await ApplicationService.get_pending_applications(
        db=db,
        skip=skip,
        limit=page_size,
    )

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    # Transform NPOs into application format expected by frontend
    applications = []
    for npo in npos:
        applications.append(
            {
                "id": str(npo.id),
                "npo_id": str(npo.id),
                "status": "submitted"
                if npo.status.value == "pending_approval"
                else npo.status.value,
                "review_notes": None,
                "reviewed_by_user_id": None,
                "submitted_at": npo.created_at.isoformat(),
                "reviewed_at": None,
                "created_at": npo.created_at.isoformat(),
                "updated_at": npo.updated_at.isoformat(),
                "npo_name": npo.name,
                "npo_email": npo.email,
            }
        )

    return {
        "items": applications,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.post(
    "/npos/{npo_id}/review",
    response_model=NPOResponse,
    summary="Review NPO application",
    description="Approve or reject an NPO application (SuperAdmin only)",
    status_code=status.HTTP_200_OK,
)
async def review_application(
    npo_id: UUID,
    review_request: ApplicationReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> NPOResponse:
    """
    Review and approve/reject an NPO application.

    **SuperAdmin only**

    Updates NPO status:
    - PENDING_APPROVAL → APPROVED (on approval)
    - PENDING_APPROVAL → REJECTED (on rejection)

    Sends email notification to NPO creator.

    Args:
        npo_id: NPO ID to review
        review_request: Review decision and optional notes
        db: Database session
        current_user: Current SuperAdmin user

    Returns:
        Updated NPO with new status

    Raises:
        HTTPException: If validation fails or NPO not found
    """
    # Debug logging
    import logging

    logger = logging.getLogger(__name__)
    logger.error(
        f"DEBUG: Received review request - npo_id: {npo_id}, decision: {review_request.decision}, notes: {review_request.notes}"
    )
    logger.error(
        f"DEBUG: Request type: decision={type(review_request.decision)}, notes={type(review_request.notes)}"
    )

    # Validate decision
    if review_request.decision not in ("approve", "reject"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision must be 'approve' or 'reject'",
        )

    # Review application
    npo = await ApplicationService.review_application(
        db=db,
        npo_id=npo_id,
        reviewer_id=current_user.id,
        decision=review_request.decision,
        notes=review_request.notes,
    )

    # Send email notification
    email_service = get_email_service()
    creator_name = npo.creator.first_name if npo.creator else None

    try:
        if review_request.decision == "approve":
            await email_service.send_application_approved_email(
                to_email=npo.creator.email if npo.creator else npo.email,
                npo_name=npo.name,
                applicant_name=creator_name,
            )
        else:  # reject
            await email_service.send_application_rejected_email(
                to_email=npo.creator.email if npo.creator else npo.email,
                npo_name=npo.name,
                reason=review_request.notes,
                applicant_name=creator_name,
            )
    except Exception as e:
        # Log error but don't fail the request - application was already updated
        from app.core.logging import get_logger

        logger = get_logger(__name__)
        logger.error(
            f"Failed to send application {review_request.decision} email",
            extra={
                "npo_id": str(npo_id),
                "decision": review_request.decision,
                "error": str(e),
            },
        )

    return NPOResponse.model_validate(npo)
