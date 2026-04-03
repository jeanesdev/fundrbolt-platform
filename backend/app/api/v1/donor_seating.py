"""Donor PWA seating information endpoints."""

import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.auction_bid import AuctionBid
from app.models.auction_item import AuctionItem
from app.models.donation import Donation
from app.models.event_registration import EventRegistration
from app.models.event_table import EventTable
from app.models.registration_guest import RegistrationGuest
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


# ---------------------------------------------------------------------------
# Response schemas for guest directory and donor activity
# ---------------------------------------------------------------------------


class EventGuestItem(BaseModel):
    guest_id: str
    name: str | None
    bidder_number: int | None
    table_number: int | None
    table_name: str | None
    profile_image_url: str | None
    is_table_captain: bool


class EventGuestsResponse(BaseModel):
    guests: list[EventGuestItem]
    total: int


class DonorBidHistoryEntry(BaseModel):
    bid_id: str
    bid_amount: Decimal
    bid_status: str
    placed_at: datetime
    outbid_by_bidder_number: int | None = None


class DonorBidItem(BaseModel):
    auction_item_id: str
    item_number: int
    item_title: str
    latest_bid_amount: Decimal
    latest_bid_status: str
    placed_at: datetime
    primary_image_url: str | None
    bid_history: list[DonorBidHistoryEntry]


class DonorDonationItem(BaseModel):
    donation_id: str
    amount: Decimal
    labels: list[str]
    donated_at: datetime


class DonorActivityResponse(BaseModel):
    bids: list[DonorBidItem]
    donations: list[DonorDonationItem]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/{event_id}/guests",
    response_model=EventGuestsResponse,
    summary="Get all guests registered for an event",
)
async def get_event_guests(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventGuestsResponse:
    """Return all checked-in / registered guests for the event (for donor guest directory)."""
    # Verify caller has a registration for this event (or is super_admin)
    role_name = getattr(current_user, "role_name", None)
    if role_name != "super_admin":
        reg_check = await db.execute(
            select(EventRegistration).where(
                EventRegistration.event_id == event_id,
                EventRegistration.user_id == current_user.id,
            )
        )
        if reg_check.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No registration found for this event",
            )

    # Load all guests for the event, eager-loading linked user for profile pics
    result = await db.execute(
        select(RegistrationGuest)
        .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
        .options(selectinload(RegistrationGuest.user))
        .where(EventRegistration.event_id == event_id)
        .order_by(RegistrationGuest.table_number, RegistrationGuest.bidder_number)
    )
    guests = result.scalars().all()

    # Build a lookup of table_number → table_name for this event
    table_result = await db.execute(select(EventTable).where(EventTable.event_id == event_id))
    table_map: dict[int, str | None] = {
        t.table_number: t.table_name for t in table_result.scalars().all()
    }

    items = [
        EventGuestItem(
            guest_id=str(g.id),
            name=g.name,
            bidder_number=g.bidder_number,
            table_number=g.table_number,
            table_name=table_map.get(g.table_number) if g.table_number is not None else None,
            profile_image_url=g.user.profile_picture_url if g.user else None,
            is_table_captain=bool(g.is_table_captain),
        )
        for g in guests
    ]

    return EventGuestsResponse(guests=items, total=len(items))


@router.get(
    "/{event_id}/my-activity",
    response_model=DonorActivityResponse,
    summary="Get the current donor's bids and donations for an event",
)
async def get_my_activity(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> DonorActivityResponse:
    """Return the authenticated donor's auction bids and donations for an event."""
    # Bids — load with auction_item and its media, ordered by item then time
    bids_result = await db.execute(
        select(AuctionBid)
        .options(selectinload(AuctionBid.auction_item).selectinload(AuctionItem.media))
        .where(
            AuctionBid.event_id == event_id,
            AuctionBid.user_id == current_user.id,
        )
        .order_by(AuctionBid.auction_item_id, AuctionBid.placed_at)
    )
    bids_rows = bids_result.scalars().all()

    # Group bids by auction_item_id
    grouped: dict[uuid.UUID, list[AuctionBid]] = {}
    for b in bids_rows:
        grouped.setdefault(b.auction_item_id, []).append(b)

    # Find outbidders for "outbid" bids (batch query for efficiency)
    outbid_map: dict[uuid.UUID, int | None] = {}  # bid.id -> outbidder bidder_number
    item_ids_with_outbid = [
        item_id
        for item_id, item_bids in grouped.items()
        if any(b.bid_status == "outbid" for b in item_bids)
    ]

    if item_ids_with_outbid:
        # Fetch all competing bids on these items from other users
        competitor_result = await db.execute(
            select(
                AuctionBid.auction_item_id,
                AuctionBid.bidder_number,
                AuctionBid.placed_at,
                AuctionBid.bid_amount,
            )
            .where(
                AuctionBid.auction_item_id.in_(item_ids_with_outbid),
                AuctionBid.user_id != current_user.id,
                AuctionBid.bid_status.in_(["winning", "active", "outbid"]),
            )
            .order_by(AuctionBid.auction_item_id, AuctionBid.placed_at)
        )
        competitor_bids = competitor_result.all()

        # Group competitor bids by item
        competitor_map: dict[uuid.UUID, list[tuple[datetime, int, Decimal]]] = {}
        for cb in competitor_bids:
            competitor_map.setdefault(cb.auction_item_id, []).append(
                (cb.placed_at, cb.bidder_number, cb.bid_amount)
            )

        # For each outbid bid, find the first competing bid placed at/after it with a higher amount
        for item_id, item_bids in grouped.items():
            competitors = competitor_map.get(item_id, [])
            if not competitors:
                continue
            for ub in item_bids:
                if ub.bid_status == "outbid":
                    for cp_at, cp_bidder, cp_amount in competitors:
                        if cp_at >= ub.placed_at and cp_amount > ub.bid_amount:
                            outbid_map[ub.id] = cp_bidder
                            break

    # Build one DonorBidItem per auction item
    bid_items = []
    for item_id, item_bids in grouped.items():
        latest_bid = max(item_bids, key=lambda b: b.placed_at)
        item = latest_bid.auction_item
        primary_image: str | None = None
        if item and item.media:
            primary_image = item.media[0].file_path

        history = [
            DonorBidHistoryEntry(
                bid_id=str(b.id),
                bid_amount=b.bid_amount,
                bid_status=b.bid_status,
                placed_at=b.placed_at,
                outbid_by_bidder_number=outbid_map.get(b.id),
            )
            for b in sorted(item_bids, key=lambda b: b.placed_at, reverse=True)
        ]
        bid_items.append(
            DonorBidItem(
                auction_item_id=str(item_id),
                item_number=item.bid_number if item else 0,
                item_title=item.title if item else "",
                latest_bid_amount=latest_bid.bid_amount,
                latest_bid_status=latest_bid.bid_status,
                placed_at=latest_bid.placed_at,
                primary_image_url=primary_image,
                bid_history=history,
            )
        )

    bid_items.sort(key=lambda x: x.item_number)

    # Donations — load with labels
    donations_result = await db.execute(
        select(Donation)
        .options(selectinload(Donation.labels))
        .where(
            Donation.event_id == event_id,
            Donation.donor_user_id == current_user.id,
        )
        .order_by(Donation.created_at.desc())
    )
    donation_rows = donations_result.scalars().all()

    donation_items = [
        DonorDonationItem(
            donation_id=str(d.id),
            amount=d.amount,
            labels=[lbl.name for lbl in d.labels],
            donated_at=d.created_at,
        )
        for d in donation_rows
    ]

    return DonorActivityResponse(bids=bid_items, donations=donation_items)
