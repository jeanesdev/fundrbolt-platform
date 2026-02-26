"""Admin quick-entry API endpoints for live bids and paddle raise donations."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.event import Event
from app.models.user import User
from app.schemas.quick_entry.schemas import (
    AssignWinnerRequest,
    QuickEntryBidCreateRequest,
    QuickEntryBidLogItem,
    QuickEntryBidResponse,
    QuickEntryDonationLabelListResponse,
    QuickEntryDonationLabelResponse,
    QuickEntryLiveSummaryResponse,
    QuickEntryPaddleAmountLevel,
    QuickEntryPaddleDonationCreateRequest,
    QuickEntryPaddleDonationLabel,
    QuickEntryPaddleDonationResponse,
    QuickEntryPaddleSummaryResponse,
    QuickEntryWinnerAssignmentResponse,
)
from app.services.permission_service import PermissionService
from app.services.quick_entry.live_auction_service import LiveAuctionService
from app.services.quick_entry.paddle_raise_service import PaddleRaiseService

router = APIRouter(prefix="/admin/events/{event_id}/quick-entry", tags=["quick-entry"])


@router.get("/status")
async def quick_entry_status(
    event_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    """Temporary status endpoint to validate router wiring during implementation phases."""
    event = await _get_event_or_404(db, event_id)
    await _require_quick_entry_access(db, current_user, event)
    return {"status": "quick-entry-router-ready", "event_id": str(event_id)}


@router.post(
    "/live-auction/bids",
    response_model=QuickEntryBidResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_live_auction_bid(
    event_id: UUID,
    payload: QuickEntryBidCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> QuickEntryBidResponse:
    """Create a live auction quick-entry bid."""
    event = await _get_event_or_404(db, event_id)
    await _require_quick_entry_access(db, current_user, event)

    bid, donor_name, table_number = await LiveAuctionService.create_live_bid(
        db,
        event_id=event_id,
        item_id=payload.item_id,
        amount=payload.amount,
        bidder_number=payload.bidder_number,
        entered_by_user_id=current_user.id,
    )

    return QuickEntryBidResponse(
        id=bid.id,
        event_id=bid.event_id,
        item_id=bid.item_id,
        amount=bid.amount,
        bidder_number=bid.bidder_number,
        donor_name=donor_name,
        table_number=str(table_number) if table_number is not None else None,
        accepted_at=bid.accepted_at,
    )


@router.get("/summary")
async def get_quick_entry_summary(
    event_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    mode: str = Query(..., pattern="^(LIVE_AUCTION|PADDLE_RAISE)$"),
    item_id: UUID | None = Query(default=None),
) -> QuickEntryLiveSummaryResponse | QuickEntryPaddleSummaryResponse:
    """Get mode-specific quick-entry summary metrics."""
    event = await _get_event_or_404(db, event_id)
    await _require_quick_entry_access(db, current_user, event)

    if mode == "LIVE_AUCTION":
        if item_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="item_id is required for LIVE_AUCTION summary",
            )

        (
            highest_bid,
            bid_count,
            unique_count,
            updated_at,
            bids,
            bidder_context,
        ) = await LiveAuctionService.get_live_summary(
            db,
            event_id=event_id,
            item_id=item_id,
        )
        return QuickEntryLiveSummaryResponse(
            item_id=item_id,
            current_highest_bid=highest_bid,
            bid_count=bid_count,
            unique_bidder_count=unique_count,
            bids=[
                QuickEntryBidLogItem(
                    id=bid.id,
                    amount=bid.amount,
                    bidder_number=bid.bidder_number,
                    donor_name=bidder_context.get(bid.bidder_number, (None, None))[0],
                    table_number=(
                        str(bidder_context.get(bid.bidder_number, (None, None))[1])
                        if bidder_context.get(bid.bidder_number, (None, None))[1] is not None
                        else None
                    ),
                    accepted_at=bid.accepted_at,
                    status=bid.status.value,
                )
                for bid in bids
            ],
            updated_at=updated_at,
        )

    (
        total_pledged,
        donation_count,
        unique_donor_count,
        participation_percent,
        by_level,
        updated_at,
    ) = await PaddleRaiseService.get_paddle_summary(
        db,
        event_id=event_id,
    )
    return QuickEntryPaddleSummaryResponse(
        total_pledged=total_pledged,
        donation_count=donation_count,
        unique_donor_count=unique_donor_count,
        participation_percent=round(participation_percent, 2),
        by_amount_level=[
            QuickEntryPaddleAmountLevel(amount=amount, count=count) for amount, count in by_level
        ],
        updated_at=updated_at,
    )


@router.delete("/live-auction/bids/{bid_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_live_auction_bid(
    event_id: UUID,
    bid_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete one quick-entry live auction bid log row."""
    event = await _get_event_or_404(db, event_id)
    await _require_quick_entry_access(db, current_user, event)
    await LiveAuctionService.delete_live_bid(
        db,
        event_id=event_id,
        bid_id=bid_id,
        deleted_by_user_id=current_user.id,
    )


@router.post(
    "/live-auction/items/{item_id}/winner",
    response_model=QuickEntryWinnerAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
async def assign_live_auction_winner(
    event_id: UUID,
    item_id: UUID,
    payload: AssignWinnerRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> QuickEntryWinnerAssignmentResponse:
    """Assign winner to highest valid bid after explicit confirmation."""
    event = await _get_event_or_404(db, event_id)
    await _require_quick_entry_access(db, current_user, event)

    if not payload.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Winner assignment confirmation is required",
        )

    winner = await LiveAuctionService.assign_winner_to_highest_bid(
        db,
        event_id=event_id,
        item_id=item_id,
        assigned_by_user_id=current_user.id,
    )
    return QuickEntryWinnerAssignmentResponse(
        item_id=item_id,
        winner_bid_id=winner.id,
        winning_amount=winner.amount,
        winner_bidder_number=winner.bidder_number,
        assigned_at=winner.updated_at,
    )


@router.post(
    "/paddle-raise/donations",
    response_model=QuickEntryPaddleDonationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_paddle_raise_donation(
    event_id: UUID,
    payload: QuickEntryPaddleDonationCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> QuickEntryPaddleDonationResponse:
    """Create paddle raise quick-entry donation."""
    event = await _get_event_or_404(db, event_id)
    await _require_quick_entry_access(db, current_user, event)

    donation, donor_name, labels = await PaddleRaiseService.create_donation(
        db,
        event_id=event_id,
        amount=payload.amount,
        bidder_number=payload.bidder_number,
        label_ids=payload.label_ids,
        custom_label=payload.custom_label,
        entered_by_user_id=current_user.id,
    )
    return QuickEntryPaddleDonationResponse(
        id=donation.id,
        event_id=donation.event_id,
        amount=donation.amount,
        bidder_number=donation.bidder_number,
        donor_name=donor_name,
        entered_at=donation.entered_at,
        entered_by=donation.entered_by_user_id,
        labels=[QuickEntryPaddleDonationLabel(label=name) for name in labels],
    )


@router.get(
    "/donation-labels",
    response_model=QuickEntryDonationLabelListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_quick_entry_donation_labels(
    event_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> QuickEntryDonationLabelListResponse:
    """List active event donation labels for paddle raise quick-entry."""
    event = await _get_event_or_404(db, event_id)
    await _require_quick_entry_access(db, current_user, event)
    labels = await PaddleRaiseService.list_available_labels(db, event_id=event_id)
    return QuickEntryDonationLabelListResponse(
        items=[QuickEntryDonationLabelResponse(id=label.id, name=label.name) for label in labels]
    )


async def _get_event_or_404(db: AsyncSession, event_id: UUID) -> Event:
    stmt = select(Event).where(Event.id == event_id)
    result = await db.execute(stmt)
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


async def _require_quick_entry_access(db: AsyncSession, current_user: User, event: Event) -> None:
    permission_service = PermissionService()
    can_view_event = await permission_service.can_view_event(current_user, event.npo_id, db=db)
    if not can_view_event or not permission_service.can_use_quick_entry(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
