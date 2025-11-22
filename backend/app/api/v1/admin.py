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
from app.services.admin_guest_service import AdminGuestService
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
    summary="Get NPO applications",
    description="Retrieve list of NPO applications with optional status filter (SuperAdmin only)",
)
async def get_applications(
    skip: int = 0,
    limit: int = 50,
    page: int | None = None,
    page_size: int | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> dict[str, Any]:
    """
    Get NPO applications with optional status filter.

    **SuperAdmin only**

    Returns paginated list of NPO applications.

    Args:
        skip: Number of items to skip (offset-based pagination)
        limit: Number of items to return
        page: Page number (1-indexed, alternative to skip/limit)
        page_size: Number of items per page (alternative to limit)
        status: Filter by application status (submitted, under_review, approved, rejected)
        db: Database session
        current_user: Current SuperAdmin user

    Returns:
        Dictionary with applications list and pagination metadata
    """
    # Support both skip/limit and page/page_size pagination
    if page is not None and page_size is not None:
        skip = (page - 1) * page_size
        limit = page_size

    npos, total = await ApplicationService.get_applications(
        db=db,
        skip=skip,
        limit=limit,
        status=status,
    )

    # Calculate total pages based on limit
    total_pages = (total + limit - 1) // limit

    # Transform NPOs into application format expected by frontend
    applications = []
    for npo in npos:
        # Map NPO status to application status
        status_map = {
            "draft": "submitted",
            "pending_approval": "under_review",
            "approved": "approved",
            "rejected": "rejected",
        }
        app_status = status_map.get(npo.status.value, "submitted")

        applications.append(
            {
                "id": str(npo.id),
                "npo_id": str(npo.id),
                "status": app_status,
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

    # Calculate page number from skip/limit
    current_page = (skip // limit) + 1 if limit > 0 else 1

    return {
        "items": applications,
        "total": total,
        "page": current_page,
        "page_size": limit,
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


@router.get(
    "/events/{event_id}/attendees",
    summary="Get event attendees",
    description="Get all attendees (registrants + guests) for an event with optional CSV export",
)
async def get_event_attendees(
    event_id: UUID,
    include_meal_selections: bool = False,
    format: str = "json",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> Any:
    """
    Get all attendees for an event.

    **SuperAdmin only**

    Returns list of all registrants and their guests with optional meal selection data.
    Can export as CSV for event planning.

    Args:
        event_id: Event UUID
        include_meal_selections: Include meal selection data in response
        format: Response format ("json" or "csv")
        db: Database session
        current_user: Current SuperAdmin user

    Returns:
        List of attendees (JSON) or CSV string
    """
    from fastapi.responses import Response

    result = await AdminGuestService.get_event_attendees(
        db=db,
        event_id=event_id,
        include_meal_selections=include_meal_selections,
        format_csv=(format == "csv"),
    )

    if format == "csv":
        # Return CSV as downloadable file
        return Response(
            content=result,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=attendees_{event_id}.csv"},
        )

    return {"attendees": result, "total": len(result)}


@router.get(
    "/events/{event_id}/meal-summary",
    summary="Get event meal summary",
    description="Get meal selection summary with counts for each meal option",
)
async def get_meal_summary(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> dict[str, Any]:
    """
    Get meal selection summary for an event.

    **SuperAdmin only**

    Returns count of each meal option selected, total attendees, and selection stats.

    Args:
        event_id: Event UUID
        db: Database session
        current_user: Current SuperAdmin user

    Returns:
        Meal summary with counts per option
    """
    return await AdminGuestService.get_meal_summary(db=db, event_id=event_id)


@router.post(
    "/guests/{guest_id}/send-invitation",
    status_code=status.HTTP_200_OK,
    summary="Send guest invitation",
    description="Send event invitation email to a guest",
)
async def send_guest_invitation(
    guest_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> dict[str, str]:
    """
    Send invitation email to a guest.

    **SuperAdmin only**

    Sends event details and registration information to the guest's email address.

    Args:
        guest_id: Guest UUID
        db: Database session
        current_user: Current SuperAdmin user

    Returns:
        Success message

    Raises:
        HTTPException: If guest not found or email fails
    """
    email_service = get_email_service()
    success = await AdminGuestService.send_guest_invitation(
        db=db, guest_id=guest_id, email_service=email_service
    )

    if success:
        return {"message": "Invitation sent successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send invitation",
        )
