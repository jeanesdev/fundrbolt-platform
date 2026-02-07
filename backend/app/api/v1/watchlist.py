"""API routes for watch list management."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.auction_item import AuctionItem
from app.models.user import User
from app.models.watch_list_entry import WatchListEntry
from app.schemas.auction_gallery import AuctionGalleryResponse, AuctionItemSummary
from app.schemas.watch_list import WatchListEntryCreate, WatchListEntryResponse
from app.services.watch_list_service import WatchListService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


@router.get(
    "",
    response_model=AuctionGalleryResponse,
    summary="Get donor watch list",
    description="Get all items in the authenticated user's watch list.",
)
async def get_watch_list(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuctionGalleryResponse:
    """Get user's watch list.

    **Permissions**: Authenticated users

    Returns all auction items in the user's watch list across all events,
    with full item details including bidding state and promotions.

    Args:
        current_user: Authenticated user
        db: Database session

    Returns:
        List of auction items in watch list with metadata

    Raises:
        HTTPException 401: Not authenticated
    """
    service = WatchListService(db)

    # Get watch list entries
    entries = await service.get_user_watch_list(user_id=current_user.id)

    if not entries:
        logger.info(f"User {current_user.id} has empty watch list")
        return AuctionGalleryResponse(items=[], total=0)

    # Get item IDs
    item_ids = [entry.item_id for entry in entries]

    # Fetch auction items with all needed fields
    stmt = (
        select(AuctionItem)
        .where(AuctionItem.id.in_(item_ids))
        .order_by(AuctionItem.created_at.desc())
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    # Convert to summary format
    summaries = []
    for item in items:
        summaries.append(
            AuctionItemSummary(
                id=item.id,
                title=item.title,
                current_bid_amount=item.current_bid_amount,
                min_next_bid_amount=item.min_next_bid_amount,
                bid_count=item.bid_count,
                bidding_open=item.bidding_open,
                watcher_count=item.watcher_count,
                buy_now_enabled=item.buy_now_enabled,
                buy_now_price=item.buy_now_price,
                quantity_available=item.quantity_available,
                promotion_badge=item.promotion_badge,
                promotion_notice=item.promotion_notice,
                primary_image_url=None,  # Will be enriched by frontend if needed
            )
        )

    logger.info(f"User {current_user.id} watch list has {len(summaries)} items")
    return AuctionGalleryResponse(items=summaries, total=len(summaries))


@router.post(
    "",
    response_model=WatchListEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add item to watch list",
    description="Add an auction item to the authenticated user's watch list.",
)
async def add_to_watch_list(
    entry_data: WatchListEntryCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WatchListEntryResponse:
    """Add item to user's watch list.

    **Permissions**: Authenticated users

    Adds an auction item to the user's watch list. If the item is already
    in the watch list, returns the existing entry without error.

    Args:
        entry_data: Watch list entry data (item_id)
        current_user: Authenticated user
        db: Database session

    Returns:
        Created (or existing) watch list entry

    Raises:
        HTTPException 401: Not authenticated
        HTTPException 404: Item not found
    """
    service = WatchListService(db)

    # Get item to retrieve event_id
    stmt = select(AuctionItem).where(AuctionItem.id == entry_data.item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Auction item {entry_data.item_id} not found",
        )

    try:
        entry = await service.add_to_watch_list(
            item_id=entry_data.item_id,
            event_id=item.event_id,
            user_id=current_user.id,
        )

        logger.info(
            f"User {current_user.id} added item {entry_data.item_id} to watch list"
        )
        return WatchListEntryResponse.model_validate(entry)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove item from watch list",
    description="Remove an auction item from the authenticated user's watch list.",
)
async def remove_from_watch_list(
    item_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove item from user's watch list.

    **Permissions**: Authenticated users

    Removes an auction item from the user's watch list. Returns 204 even
    if the item was not in the watch list (idempotent operation).

    Args:
        item_id: UUID of auction item to remove
        current_user: Authenticated user
        db: Database session

    Raises:
        HTTPException 401: Not authenticated
    """
    service = WatchListService(db)

    removed = await service.remove_from_watch_list(
        item_id=item_id,
        user_id=current_user.id,
    )

    if removed:
        logger.info(f"User {current_user.id} removed item {item_id} from watch list")
    else:
        logger.info(
            f"User {current_user.id} attempted to remove item {item_id} "
            "from watch list (not in list)"
        )
