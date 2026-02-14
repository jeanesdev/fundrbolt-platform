"""API routes for admin auction item engagement and promotion management."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user, require_role
from app.models.auction_bid import AuctionBid
from app.models.auction_item import AuctionItem
from app.models.item_view import ItemView
from app.models.user import User
from app.models.watch_list_entry import WatchListEntry
from app.schemas.auction_engagement import (
    AdminEngagementResponse,
    BidSummary,
    WatcherSummary,
)
from app.schemas.buy_now_availability import (
    BuyNowAvailabilityResponse,
    BuyNowAvailabilityUpdate,
)
from app.schemas.item_promotion import ItemPromotionResponse, ItemPromotionUpdate
from app.schemas.item_view import ItemViewSummary
from app.services.buy_now_availability_service import BuyNowAvailabilityService
from app.services.item_promotion_service import ItemPromotionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/auction", tags=["admin-auction-engagement"])


@router.get(
    "/items/{item_id}/engagement",
    response_model=AdminEngagementResponse,
    summary="Get item engagement and bid history (admin)",
    description="Get engagement data including watchers, views, and bids for an auction item.",
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def get_item_engagement(
    item_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminEngagementResponse:
    """Get engagement data for an auction item.

    **Permissions**: Admin roles (super_admin, npo_admin, event_coordinator)

    Returns comprehensive engagement metrics including:
    - List of users watching the item
    - View history with duration data
    - Bid history with user details

    Args:
        item_id: UUID of auction item
        current_user: Authenticated admin user
        db: Database session

    Returns:
        Engagement summary with watchers, views, and bids

    Raises:
        HTTPException 403: User lacks admin permission
        HTTPException 404: Item not found
    """
    # Verify item exists
    stmt = select(AuctionItem).where(AuctionItem.id == item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Auction item {item_id} not found",
        )

    # Get watchers with user details
    watchers_stmt = (
        select(WatchListEntry, User)
        .join(User, WatchListEntry.user_id == User.id)
        .where(WatchListEntry.item_id == item_id)
        .order_by(WatchListEntry.created_at.desc())
    )
    watchers_result = await db.execute(watchers_stmt)
    watchers_data = watchers_result.all()

    watchers = [
        WatcherSummary(
            user_id=entry.user_id,
            user_name=f"{user.first_name} {user.last_name}".strip() or user.email,
            email=user.email,
            watching_since=entry.created_at,
        )
        for entry, user in watchers_data
    ]

    # Get view summaries (aggregated by user)
    views_stmt = (
        select(
            ItemView.user_id,
            User.first_name,
            User.last_name,
            User.email,
            func.sum(ItemView.view_duration_seconds).label("total_duration"),
            func.max(ItemView.view_started_at).label("last_viewed"),
        )
        .join(User, ItemView.user_id == User.id)
        .where(ItemView.item_id == item_id)
        .group_by(ItemView.user_id, User.first_name, User.last_name, User.email)
        .order_by(func.max(ItemView.view_started_at).desc())
    )
    views_result = await db.execute(views_stmt)
    views_data = views_result.all()

    views = [
        ItemViewSummary(
            user_id=row.user_id,
            user_name=f"{row.first_name} {row.last_name}".strip() or row.email,
            view_duration_seconds=int(row.total_duration or 0),
            last_viewed_at=row.last_viewed,
        )
        for row in views_data
    ]

    # Get bid history with user details
    bids_stmt = (
        select(AuctionBid, User)
        .join(User, AuctionBid.user_id == User.id)
        .where(AuctionBid.auction_item_id == item_id)
        .order_by(AuctionBid.created_at.desc())
    )
    bids_result = await db.execute(bids_stmt)
    bids_data = bids_result.all()

    bids = [
        BidSummary(
            bid_id=bid.id,
            user_id=bid.user_id,
            user_name=f"{user.first_name} {user.last_name}".strip() or user.email,
            bidder_number=bid.bidder_number,
            amount=bid.bid_amount,
            is_max_bid=(bid.bid_type == "max"),
            created_at=bid.created_at,
        )
        for bid, user in bids_data
    ]

    # Calculate view statistics
    total_views_stmt = select(func.count(ItemView.id)).where(ItemView.item_id == item_id)
    total_views_result = await db.execute(total_views_stmt)
    total_views = total_views_result.scalar() or 0

    total_duration_stmt = select(func.sum(ItemView.view_duration_seconds)).where(
        ItemView.item_id == item_id
    )
    total_duration_result = await db.execute(total_duration_stmt)
    total_duration = int(total_duration_result.scalar() or 0)

    unique_viewers_stmt = select(func.count(func.distinct(ItemView.user_id))).where(
        ItemView.item_id == item_id
    )
    unique_viewers_result = await db.execute(unique_viewers_stmt)
    unique_viewers = unique_viewers_result.scalar() or 0

    logger.info(
        f"Admin {current_user.id} retrieved engagement for item {item_id}: "
        f"{len(watchers)} watchers, {total_views} views, {len(bids)} bids"
    )

    return AdminEngagementResponse(
        watchers=watchers,
        views=views,
        bids=bids,
        total_views=total_views,
        total_view_duration_seconds=total_duration,
        unique_viewers=unique_viewers,
    )


@router.patch(
    "/items/{item_id}/promotion",
    response_model=ItemPromotionResponse,
    summary="Update item promotion badge/notice (admin)",
    description="Update or remove promotional badge and notice for an auction item.",
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def update_item_promotion(
    item_id: UUID,
    promotion_data: ItemPromotionUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ItemPromotionResponse:
    """Update item promotion.

    **Permissions**: Admin roles (super_admin, npo_admin, event_coordinator)

    Updates the promotional badge and notice for an auction item. Set fields
    to null to remove them. This also updates the denormalized fields on the
    auction_items table for fast reads.

    Args:
        item_id: UUID of auction item
        promotion_data: Promotion update data (badge_label, notice_message)
        current_user: Authenticated admin user
        db: Database session

    Returns:
        Updated item promotion record

    Raises:
        HTTPException 403: User lacks admin permission
        HTTPException 404: Item not found
    """
    # Get item to retrieve event_id
    stmt = select(AuctionItem).where(AuctionItem.id == item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Auction item {item_id} not found",
        )

    service = ItemPromotionService(db)

    try:
        promotion = await service.update_promotion(
            item_id=item_id,
            event_id=item.event_id,
            updated_by_user_id=current_user.id,
            badge_label=promotion_data.badge_label,
            notice_message=promotion_data.notice_message,
        )

        logger.info(
            f"Admin {current_user.id} updated promotion for item {item_id}: "
            f"badge={promotion_data.badge_label}, notice={promotion_data.notice_message}"
        )
        return ItemPromotionResponse.model_validate(promotion)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.patch(
    "/items/{item_id}/buy-now",
    response_model=BuyNowAvailabilityResponse,
    summary="Update buy-now availability (admin)",
    description="Update buy-now settings including enabled status and remaining quantity.",
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def update_buy_now_availability(
    item_id: UUID,
    buy_now_data: BuyNowAvailabilityUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BuyNowAvailabilityResponse:
    """Update buy-now availability.

    **Permissions**: Admin roles (super_admin, npo_admin, event_coordinator)

    Updates the buy-now settings for an auction item, including whether it's
    enabled and the remaining quantity. This also updates the denormalized
    fields on the auction_items table for fast reads.

    Args:
        item_id: UUID of auction item
        buy_now_data: Buy-now update data (enabled, remaining_quantity, override_reason)
        current_user: Authenticated admin user
        db: Database session

    Returns:
        Updated buy-now availability record

    Raises:
        HTTPException 403: User lacks admin permission
        HTTPException 404: Item not found
        HTTPException 422: Validation error
    """
    # Get item to retrieve event_id
    stmt = select(AuctionItem).where(AuctionItem.id == item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Auction item {item_id} not found",
        )

    service = BuyNowAvailabilityService(db)

    try:
        availability = await service.update_availability(
            item_id=item_id,
            event_id=item.event_id,
            updated_by_user_id=current_user.id,
            enabled=buy_now_data.enabled,
            remaining_quantity=buy_now_data.remaining_quantity,
            override_reason=buy_now_data.override_reason,
        )

        logger.info(
            f"Admin {current_user.id} updated buy-now for item {item_id}: "
            f"enabled={buy_now_data.enabled}, qty={buy_now_data.remaining_quantity}"
        )
        return BuyNowAvailabilityResponse.model_validate(availability)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
