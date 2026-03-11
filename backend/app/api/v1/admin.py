"""Admin API endpoints for SuperAdmin operations."""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1 import admin_donations
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest
from app.models.user import User
from app.schemas.event_registration import EventRegistrationCancelRequest
from app.schemas.npo import NPOResponse
from app.services.admin_guest_service import AdminGuestService
from app.services.application_service import ApplicationService
from app.services.email_service import get_email_service
from app.services.event_registration_service import EventRegistrationService
from app.services.permission_service import PermissionService

router = APIRouter(prefix="/admin", tags=["admin"])


class ApplicationReviewRequest(BaseModel):
    """Request schema for reviewing an NPO application."""

    decision: str  # "approve" or "reject"
    notes: str | None = None


class AdminRegistrationDetailsUpdateRequest(BaseModel):
    """Request schema for event-admin registration detail updates."""

    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)


class AdminGuestDetailsUpdateRequest(BaseModel):
    """Request schema for event-admin guest detail updates."""

    name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)


class AdminGuestReplaceUserRequest(BaseModel):
    """Request schema for replacing a guest ticket with an existing user."""

    email: EmailStr


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


async def _require_event_admin(db: AsyncSession, current_user: User, event: Event) -> None:
    allowed_roles = {
        "super_admin",
        "npo_admin",
        "npo_staff",
        "event_coordinator",
        "staff",
    }
    user_role = getattr(current_user, "role_name", None)
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to manage this event.",
        )

    if user_role != "super_admin":
        permission_service = PermissionService()
        if not await permission_service.can_view_event(current_user, event.npo_id, db=db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage this event.",
            )


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
            "under_revision": "reopened",  # US4: admin reopened for revision
        }
        app_status = status_map.get(npo.status.value, "submitted")

        # Compute is_overdue: pending > 5 business days
        from datetime import date as _date
        from datetime import timedelta as _timedelta

        _is_overdue = False
        if npo.status.value == "pending_approval":
            start = npo.created_at.date()
            today = _date.today()
            bdays = 0
            cur = start
            while cur < today:
                cur += _timedelta(days=1)
                if cur.weekday() < 5:
                    bdays += 1
            _is_overdue = bdays > 5

        applications.append(
            {
                "id": str(npo.id),
                "npo_id": str(npo.id),
                "status": app_status,
                "is_overdue": _is_overdue,
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


class ApplicationReopenRequest(BaseModel):
    """Request schema for reopening a rejected NPO application."""

    revision_notes: str | None = Field(
        None,
        max_length=1000,
        description="Optional guidance for the applicant explaining what needs revision",
    )


@router.post(
    "/npos/{npo_id}/reopen",
    response_model=NPOResponse,
    summary="Reopen rejected NPO application for revision",
    description=(
        "Re-open a rejected NPO application so the applicant can revise and resubmit. "
        "Transitions NPO from REJECTED → UNDER_REVISION. SuperAdmin only."
    ),
    status_code=status.HTTP_200_OK,
)
async def reopen_npo_application(
    npo_id: UUID,
    reopen_request: ApplicationReopenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> NPOResponse:
    """
    Reopen a rejected NPO application for applicant revision.

    **SuperAdmin only**

    State transition: REJECTED → UNDER_REVISION (NPO status)
    Latest NPOApplication record: REJECTED → REOPENED

    Sends email notification to NPO creator with any revision guidance.

    Args:
        npo_id: NPO ID to reopen
        reopen_request: Optional revision notes for the applicant
        db: Database session
        current_user: Current SuperAdmin user

    Returns:
        Updated NPO with UNDER_REVISION status

    Raises:
        HTTPException: If validation fails or NPO not found
    """
    npo = await ApplicationService.reopen_application(
        db=db,
        npo_id=npo_id,
        reopened_by_user_id=current_user.id,
        revision_notes=reopen_request.revision_notes,
    )

    # Send email notification to applicant
    email_service = get_email_service()
    creator_name = npo.creator.first_name if npo.creator else None

    try:
        await email_service.send_npo_application_reopened_email(
            to_email=npo.creator.email if npo.creator else npo.email,
            user_name=creator_name or "Applicant",
            npo_name=npo.name,
            revision_notes=reopen_request.revision_notes,
        )
    except Exception as e:
        from app.core.logging import get_logger

        _logger = get_logger(__name__)
        _logger.error(
            "Failed to send application reopened email",
            extra={"npo_id": str(npo_id), "error": str(e)},
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
    current_user: User = Depends(get_current_user),
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

    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    await _require_event_admin(db, current_user, event)

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


@router.patch(
    "/events/{event_id}/registrations/{registration_id}/details",
    status_code=status.HTTP_200_OK,
    summary="Update registrant contact details",
)
async def update_registration_details_admin(
    event_id: UUID,
    registration_id: UUID,
    details: AdminRegistrationDetailsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Update registrant contact details from the admin check-in page."""
    registration_result = await db.execute(
        select(EventRegistration)
        .options(
            selectinload(EventRegistration.user),
            selectinload(EventRegistration.guests),
            selectinload(EventRegistration.event),
        )
        .where(
            EventRegistration.id == registration_id,
            EventRegistration.event_id == event_id,
        )
    )
    registration = registration_result.scalar_one_or_none()
    if not registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration not found for event",
        )

    await _require_event_admin(db, current_user, registration.event)

    user = registration.user
    if details.first_name is not None:
        user.first_name = details.first_name.strip() or user.first_name
    if details.last_name is not None:
        user.last_name = details.last_name.strip() or user.last_name
    if details.email is not None:
        user.email = details.email.lower()
    if details.phone is not None:
        user.phone = details.phone.strip() or None

    primary_guest = next((guest for guest in registration.guests if guest.is_primary), None)
    if primary_guest:
        primary_guest.name = f"{user.first_name} {user.last_name}".strip()
        primary_guest.email = user.email
        primary_guest.phone = user.phone

    await db.commit()
    await db.refresh(user)

    return {
        "registration_id": str(registration.id),
        "user_id": str(user.id),
        "name": f"{user.first_name} {user.last_name}".strip(),
        "email": user.email,
        "phone": user.phone,
    }


@router.patch(
    "/events/{event_id}/guests/{guest_id}/details",
    status_code=status.HTTP_200_OK,
    summary="Update guest details",
)
async def update_guest_details_admin(
    event_id: UUID,
    guest_id: UUID,
    details: AdminGuestDetailsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Update guest contact details from the admin check-in page."""
    guest_result = await db.execute(
        select(RegistrationGuest)
        .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
        .options(selectinload(RegistrationGuest.registration).selectinload(EventRegistration.event))
        .where(
            RegistrationGuest.id == guest_id,
            EventRegistration.event_id == event_id,
        )
    )
    guest = guest_result.scalar_one_or_none()
    if not guest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest not found for event",
        )

    await _require_event_admin(db, current_user, guest.registration.event)

    if details.name is not None:
        guest.name = details.name.strip() or None
    if details.email is not None:
        guest.email = details.email.lower()
    if details.phone is not None:
        guest.phone = details.phone.strip() or None

    await db.commit()
    await db.refresh(guest)

    return {
        "guest_id": str(guest.id),
        "user_id": str(guest.user_id) if guest.user_id else None,
        "name": guest.name,
        "email": guest.email,
        "phone": guest.phone,
    }


@router.post(
    "/events/{event_id}/guests/{guest_id}/replace-user",
    status_code=status.HTTP_200_OK,
    summary="Replace guest ticket with existing user",
)
async def replace_guest_user_admin(
    event_id: UUID,
    guest_id: UUID,
    payload: AdminGuestReplaceUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Replace a guest ticket by linking it to an existing user account."""
    guest_result = await db.execute(
        select(RegistrationGuest)
        .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
        .options(selectinload(RegistrationGuest.registration).selectinload(EventRegistration.event))
        .where(
            RegistrationGuest.id == guest_id,
            EventRegistration.event_id == event_id,
        )
    )
    guest = guest_result.scalar_one_or_none()
    if not guest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest not found for event",
        )

    await _require_event_admin(db, current_user, guest.registration.event)

    user_result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user account found for that email",
        )

    existing_registration_result = await db.execute(
        select(EventRegistration).where(
            EventRegistration.event_id == event_id,
            EventRegistration.user_id == user.id,
        )
    )
    existing_registration = existing_registration_result.scalar_one_or_none()
    if existing_registration and existing_registration.id != guest.registration_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already registered for this event",
        )

    existing_guest_result = await db.execute(
        select(RegistrationGuest)
        .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
        .where(
            EventRegistration.event_id == event_id,
            RegistrationGuest.user_id == user.id,
            RegistrationGuest.id != guest.id,
        )
    )
    existing_guest = existing_guest_result.scalar_one_or_none()
    if existing_guest:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already linked to another guest ticket for this event",
        )

    guest.user_id = user.id
    guest.name = f"{user.first_name} {user.last_name}".strip()
    guest.email = user.email
    guest.phone = user.phone

    await db.commit()
    await db.refresh(guest)

    return {
        "guest_id": str(guest.id),
        "user_id": str(user.id),
        "name": guest.name,
        "email": guest.email,
        "phone": guest.phone,
        "message": "Guest ticket successfully replaced with user",
    }


@router.delete(
    "/registrations/{registration_id}/cancel",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel event registration",
    description="Cancel a registration with reason/note (event admin)",
)
async def cancel_registration_admin(
    registration_id: UUID,
    cancel_data: EventRegistrationCancelRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    registration = await EventRegistrationService.get_registration_by_id(db, registration_id)
    if not registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Registration with ID {registration_id} not found",
        )

    await _require_event_admin(db, current_user, registration.event)

    await EventRegistrationService.cancel_registration_admin(
        db,
        registration_id,
        current_user,
        cancellation_reason=cancel_data.cancellation_reason,
        cancellation_note=cancel_data.cancellation_note,
    )


@router.get(
    "/events/{event_id}/meal-summary",
    summary="Get event meal summary",
    description="Get meal selection summary with counts for each meal option",
)
async def get_meal_summary(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    await _require_event_admin(db, current_user, event)

    return await AdminGuestService.get_meal_summary(db=db, event_id=event_id)


@router.post(
    "/events/{event_id}/invite-guest",
    status_code=status.HTTP_201_CREATED,
    summary="Invite new guest to event",
    description="Create a guest invitation for an event (admin creates registration and guest)",
)
async def invite_guest_to_event(
    event_id: UUID,
    guest_data: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Invite a new guest to an event by creating a registration and sending invitation.

    **SuperAdmin only**

    Creates an admin-initiated registration and guest record, then sends invitation email.

    Args:
        event_id: Event UUID
        guest_data: Guest information (name, email, phone)
        db: Database session
        current_user: Current SuperAdmin user

    Returns:
        Guest record with invitation status

    Raises:
        HTTPException: If event not found or email fails
    """
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    await _require_event_admin(db, current_user, event)

    email_service = get_email_service()
    guest, email_sent = await AdminGuestService.invite_guest_to_event(
        db=db,
        event_id=event_id,
        guest_data=guest_data,
        invited_by_user=current_user,
        email_service=email_service,
    )

    message = (
        "Invitation sent successfully" if email_sent else "Guest created but email failed to send"
    )

    return {
        "guest_id": str(guest.id),
        "name": guest.name,
        "email": guest.email,
        "email_sent": email_sent,
        "message": message,
    }


@router.delete(
    "/guests/{guest_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel a guest",
    description="Cancel a guest and remove their meal selections",
)
async def delete_guest(
    guest_id: UUID,
    cancel_data: EventRegistrationCancelRequest | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a guest from an event.

    **SuperAdmin only**

    Removes the guest record and cascades to delete their meal selections.

    Args:
        guest_id: Guest UUID
        db: Database session
        current_user: Current SuperAdmin user

    Raises:
        HTTPException: If guest not found
    """
    event_result = await db.execute(
        select(Event)
        .join(EventRegistration, EventRegistration.event_id == Event.id)
        .join(RegistrationGuest, RegistrationGuest.registration_id == EventRegistration.id)
        .where(RegistrationGuest.id == guest_id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")

    await _require_event_admin(db, current_user, event)

    await AdminGuestService.delete_guest(
        db=db,
        guest_id=guest_id,
        cancellation_reason=cancel_data.cancellation_reason if cancel_data else None,
        cancellation_note=cancel_data.cancellation_note if cancel_data else None,
    )


@router.post(
    "/guests/{guest_id}/send-invitation",
    status_code=status.HTTP_200_OK,
    summary="Send guest invitation",
    description="Send event invitation email to a guest",
)
async def send_guest_invitation(
    guest_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    event_result = await db.execute(
        select(Event)
        .join(EventRegistration, EventRegistration.event_id == Event.id)
        .join(RegistrationGuest, RegistrationGuest.registration_id == EventRegistration.id)
        .where(RegistrationGuest.id == guest_id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")

    await _require_event_admin(db, current_user, event)

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


router.include_router(admin_donations.router)
