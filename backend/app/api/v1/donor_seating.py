"""Donor PWA seating information endpoints."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.user import User
from app.schemas.seating import SeatingInfoResponse
from app.services.seating_service import SeatingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/donor/events", tags=["donor-seating"])


def _is_super_admin_session(user: User) -> bool:
    role_name = getattr(user, "role_name", None)
    if role_name == "super_admin":
        return True
    return getattr(user, "spoofed_by_role", None) == "super_admin"


def _parse_reference_now(debug_now: str | None, user: User) -> datetime | None:
    if debug_now is None or not _is_super_admin_session(user):
        return None

    try:
        parsed = datetime.fromisoformat(debug_now.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Debug-Now header format. Use ISO-8601 timestamp.",
        ) from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)

    return parsed.astimezone(UTC)


@router.get(
    "/{event_id}/my-seating",
    response_model=SeatingInfoResponse,
    summary="Get donor's seating assignment and table details",
    description="""
    Retrieve the authenticated donor's seating information for a specific event.

    **Feature 014: Donor View of Table Assignment**

    This endpoint provides comprehensive seating details for the donor PWA home page:
    - Table assignment (number and name)
    - Table captain designation
    - Bidder number (if checked in)
    - Tablemates with check-in status
    - Table capacity and availability

    **User Story 4 (US4):**
    After event starts, donors see their table assignment including:
    - Table number and custom name ("VIP Sponsors")
    - Table captain ("Jane Doe is your table captain" or "You are the table captain")
    - Current tablemates

    **Visibility Rules:**
    - Table assignment: Only shown after event.event_datetime <= now
    - Bidder numbers: Only visible after guest checks in (check_in_time is set)
    - Applies to both the donor's own bidder number and tablemates'

    **Polling Behavior:**
    - Frontend polls every 10 seconds for real-time updates
    - Captures table reassignments, captain changes, and new tablemates

    **Response Fields:**
    - `table_assignment`: Table details (number, name, captain, capacity) or null if not assigned/event not started
    - `bidder_number`: Donor's bidder number or null if not checked in
    - `tablemates`: List of guests at same table (excluding current user)
    - `message`: User-friendly explanation ("Table not assigned yet", "Event has not started")

    **Example Response (Assigned, Event Started):**
    ```json
    {
        "registration_id": "abc123...",
        "event_id": "10adb96b...",
        "guest_name": "John Smith",
        "table_assignment": {
            "table_number": 5,
            "table_name": "VIP Sponsors",
            "table_captain_name": "Jane Doe",
            "you_are_captain": false,
            "current_occupancy": 6,
            "effective_capacity": 8
        },
        "bidder_number": 42,
        "tablemates": [
            {
                "name": "Jane Doe",
                "bidder_number": 41,
                "checked_in": true
            },
            {
                "name": "Bob Wilson",
                "bidder_number": null,
                "checked_in": false
            }
        ],
        "message": null
    }
    ```

    **Example Response (Event Not Started):**
    ```json
    {
        "registration_id": "abc123...",
        "event_id": "10adb96b...",
        "guest_name": "John Smith",
        "table_assignment": null,
        "bidder_number": null,
        "tablemates": [],
        "message": "Event has not started yet. Table assignments will be visible on January 15, 2026 at 6:00 PM."
    }
    ```
    """,
    responses={
        200: {
            "description": "Seating information retrieved successfully",
            "content": {
                "application/json": {
                    "examples": {
                        "assigned": {
                            "summary": "Guest assigned to table with captain",
                            "value": {
                                "registration_id": "abc123-def456-ghi789",
                                "event_id": "10adb96b-75b8-4a43-8a44-c593cb853e3c",
                                "guest_name": "John Smith",
                                "table_assignment": {
                                    "table_number": 5,
                                    "table_name": "VIP Sponsors",
                                    "table_captain_name": "Jane Doe",
                                    "you_are_captain": False,
                                    "current_occupancy": 6,
                                    "effective_capacity": 8,
                                },
                                "bidder_number": 42,
                                "tablemates": [
                                    {"name": "Jane Doe", "bidder_number": 41, "checked_in": True}
                                ],
                                "message": None,
                            },
                        },
                        "not_started": {
                            "summary": "Event has not started yet",
                            "value": {
                                "registration_id": "abc123-def456-ghi789",
                                "event_id": "10adb96b-75b8-4a43-8a44-c593cb853e3c",
                                "guest_name": "John Smith",
                                "table_assignment": None,
                                "bidder_number": None,
                                "tablemates": [],
                                "message": "Event has not started yet. Table assignments will be visible on January 15, 2026 at 6:00 PM.",
                            },
                        },
                        "not_assigned": {
                            "summary": "Table not assigned yet",
                            "value": {
                                "registration_id": "abc123-def456-ghi789",
                                "event_id": "10adb96b-75b8-4a43-8a44-c593cb853e3c",
                                "guest_name": "John Smith",
                                "table_assignment": None,
                                "bidder_number": 42,
                                "tablemates": [],
                                "message": "Table not assigned yet. Please check back later or contact event staff.",
                            },
                        },
                    }
                }
            },
        },
        404: {
            "description": "User has no registration for this event",
            "content": {
                "application/json": {"example": {"detail": "No registration found for this event"}}
            },
        },
    },
)
async def get_my_seating_info(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    debug_now: str | None = Header(default=None, alias="X-Debug-Now"),
) -> SeatingInfoResponse:
    """
    Get current user's seating information for an event.

    Returns:
    - User's table assignment and bidder number (if checked in)
    - List of tablemates (with bidder numbers only if they're checked in)
    - Table capacity information
    - Message if table not assigned or not checked in

    Gating Rules:
    - Bidder numbers are only visible after check-in (check_in_time is set)
    - This applies to both user's own bidder number and tablemates'

    Raises:
    - 404: User has no registration for this event
    """
    try:
        include_unchecked_in_bidder_numbers = (
            getattr(current_user, "spoofed_by_user_id", None) is not None
        )
        reference_now = _parse_reference_now(debug_now, current_user)
        seating_info = await SeatingService.get_donor_seating_info(
            db,
            current_user.id,
            event_id,
            include_unchecked_in_bidder_numbers=include_unchecked_in_bidder_numbers,
            reference_now=reference_now,
        )
        return SeatingInfoResponse(**seating_info)
    except ValueError as e:
        logger.warning(
            f"Failed to get seating info for user {current_user.id} at event {event_id}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
