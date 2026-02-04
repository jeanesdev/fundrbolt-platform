"""API routes for auction bidding and reporting."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user, require_role
from app.models.auction_bid import TransactionStatus
from app.models.auction_item import AuctionType
from app.models.user import User
from app.schemas.auction_bid import (
    AdjustBidRequest,
    AdminActionRequest,
    BidCreateRequest,
    BidderAnalyticsReportItem,
    BidderAnalyticsReportResponse,
    BiddingWarReportItem,
    BiddingWarsReportResponse,
    BidHistoryResponse,
    BidResponse,
    HighValueDonorReportItem,
    HighValueDonorReportResponse,
    ItemPerformanceReportItem,
    ItemPerformanceReportResponse,
    MarkWinningRequest,
    PaddleRaiseRequest,
    PaddleRaiseResponse,
    TransactionStatusRequest,
    UnprocessedTransactionReportItem,
    UnprocessedTransactionsReportResponse,
    WinningBidReportItem,
    WinningBidsReportResponse,
)
from app.services.auction_bid_service import AuctionBidService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auction", tags=["auction-bids"])


@router.post(
    "/bids",
    response_model=BidResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Place a bid",
)
async def place_bid(
    bid_data: BidCreateRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BidResponse:
    """Place a bid on an auction item."""
    try:
        service = AuctionBidService(db)
        bid = await service.place_bid(
            user_id=current_user.id,
            event_id=bid_data.event_id,
            auction_item_id=bid_data.auction_item_id,
            bid_amount=bid_data.bid_amount,
            bid_type=bid_data.bid_type,
            max_bid=bid_data.max_bid,
        )
        return BidResponse.model_validate(bid)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


@router.get(
    "/items/{item_id}/bids",
    response_model=BidHistoryResponse,
    summary="Get bid history for an auction item",
)
async def get_item_bid_history(
    item_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 25,
) -> BidHistoryResponse:
    service = AuctionBidService(db)
    bids, total = await service.list_item_bids(item_id, page, per_page)
    return BidHistoryResponse(
        page=page,
        per_page=per_page,
        total=total,
        items=[BidResponse.model_validate(bid) for bid in bids],
    )


@router.get(
    "/bidders/{bidder_number}/bids",
    response_model=BidHistoryResponse,
    summary="Get bid history for a bidder",
)
async def get_bidder_bid_history(
    bidder_number: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 25,
) -> BidHistoryResponse:
    service = AuctionBidService(db)
    bids, total = await service.list_bidder_bids(bidder_number, page, per_page)
    return BidHistoryResponse(
        page=page,
        per_page=per_page,
        total=total,
        items=[BidResponse.model_validate(bid) for bid in bids],
    )


@router.post(
    "/bids/{bid_id}/mark-winning",
    response_model=BidResponse,
    summary="Mark a bid as winning",
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def mark_winning_bid(
    bid_id: UUID,
    payload: Annotated[MarkWinningRequest, Body(...)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BidResponse:
    try:
        service = AuctionBidService(db)
        bid = await service.mark_winning(bid_id, current_user.id, payload.reason)
        return BidResponse.model_validate(bid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/bids/{bid_id}/adjust",
    response_model=BidResponse,
    summary="Adjust bid amount",
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def adjust_bid_amount(
    bid_id: UUID,
    payload: AdjustBidRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BidResponse:
    try:
        service = AuctionBidService(db)
        bid = await service.adjust_bid_amount(
            bid_id=bid_id,
            actor_user_id=current_user.id,
            new_amount=payload.new_amount,
            reason=payload.reason,
        )
        return BidResponse.model_validate(bid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/bids/{bid_id}/cancel",
    response_model=BidResponse,
    summary="Cancel bid",
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def cancel_bid(
    bid_id: UUID,
    payload: AdminActionRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BidResponse:
    try:
        service = AuctionBidService(db)
        bid = await service.cancel_bid(bid_id, current_user.id, payload.reason)
        return BidResponse.model_validate(bid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/bids/{bid_id}/transaction-status",
    response_model=BidResponse,
    summary="Override transaction status",
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def override_transaction_status(
    bid_id: UUID,
    payload: TransactionStatusRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BidResponse:
    try:
        service = AuctionBidService(db)
        bid = await service.override_transaction_status(
            bid_id=bid_id,
            actor_user_id=current_user.id,
            new_status=payload.transaction_status,
            reason=payload.reason,
        )
        return BidResponse.model_validate(bid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/paddle-raise",
    response_model=PaddleRaiseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record paddle raise contribution",
)
async def record_paddle_raise(
    payload: PaddleRaiseRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PaddleRaiseResponse:
    service = AuctionBidService(db)
    contribution = await service.record_paddle_raise(
        user_id=current_user.id,
        event_id=payload.event_id,
        amount=payload.amount,
        tier_name=payload.tier_name,
    )
    return PaddleRaiseResponse.model_validate(contribution)


@router.get(
    "/reports/winning-bids",
    response_model=WinningBidsReportResponse,
    summary="Winning bids report",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def winning_bids_report(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    transaction_status: TransactionStatus | None = Query(default=None),
    auction_type: AuctionType | None = Query(default=None),
) -> WinningBidsReportResponse:
    service = AuctionBidService(db)
    rows = await service.report_winning_bids(transaction_status, auction_type)
    items = [WinningBidReportItem(**row) for row in rows]
    return WinningBidsReportResponse(generated_at=datetime.now(UTC), items=items)


@router.get(
    "/reports/unprocessed-transactions",
    response_model=UnprocessedTransactionsReportResponse,
    summary="Unprocessed transactions report",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def unprocessed_transactions_report(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UnprocessedTransactionsReportResponse:
    service = AuctionBidService(db)
    rows = await service.report_unprocessed_transactions()
    items = [UnprocessedTransactionReportItem(**row) for row in rows]
    return UnprocessedTransactionsReportResponse(generated_at=datetime.now(UTC), items=items)


@router.get(
    "/reports/bidder-analytics",
    response_model=BidderAnalyticsReportResponse,
    summary="Bidder analytics report",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def bidder_analytics_report(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    bidder_number: int | None = Query(default=None),
    auction_type: AuctionType | None = Query(default=None),
) -> BidderAnalyticsReportResponse:
    service = AuctionBidService(db)
    rows = await service.report_bidder_analytics(bidder_number, auction_type)
    items = [BidderAnalyticsReportItem(**row) for row in rows]
    return BidderAnalyticsReportResponse(generated_at=datetime.now(UTC), items=items)


@router.get(
    "/reports/item-performance",
    response_model=ItemPerformanceReportResponse,
    summary="Item performance report",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def item_performance_report(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ItemPerformanceReportResponse:
    service = AuctionBidService(db)
    rows = await service.report_item_performance()
    items = [ItemPerformanceReportItem(**row) for row in rows]
    return ItemPerformanceReportResponse(generated_at=datetime.now(UTC), items=items)


@router.get(
    "/reports/bidding-wars",
    response_model=BiddingWarsReportResponse,
    summary="Bidding wars report",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def bidding_wars_report(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BiddingWarsReportResponse:
    service = AuctionBidService(db)
    rows = await service.report_bidding_wars()
    items = [BiddingWarReportItem(**row) for row in rows]
    return BiddingWarsReportResponse(generated_at=datetime.now(UTC), items=items)


@router.get(
    "/reports/high-value-donors",
    response_model=HighValueDonorReportResponse,
    summary="High value donor report",
)
@require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
async def high_value_donors_report(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> HighValueDonorReportResponse:
    service = AuctionBidService(db)
    rows = await service.report_high_value_donors()
    items = [HighValueDonorReportItem(**row) for row in rows]
    return HighValueDonorReportResponse(generated_at=datetime.now(UTC), items=items)
