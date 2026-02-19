"""API routes for auction item management."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.middleware.auth import get_current_active_user, get_current_user_optional
from app.models.auction_item import AuctionType, ItemStatus
from app.models.user import User
from app.schemas.auction_item import (
    AuctionItemCreate,
    AuctionItemDetail,
    AuctionItemListResponse,
    AuctionItemResponse,
    AuctionItemUpdate,
    PaginationInfo,
)
from app.schemas.item_view import ItemViewCreate, ItemViewResponse
from app.services.auction_item_service import AuctionItemService
from app.services.item_view_service import ItemViewService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events/{event_id}/auction-items", tags=["Auction Items"])
donor_router = APIRouter(prefix="/auction/items", tags=["Auction Items"])


@router.post(
    "",
    response_model=AuctionItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create auction item",
    description="Create a new auction item with auto-assigned bid number (100-999). Requires authentication.",
)
async def create_auction_item(
    event_id: UUID,
    item_data: AuctionItemCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuctionItemResponse:
    """Create a new auction item.

    **Permissions**: Authenticated users (permissions checked in service layer)

    **Auto-assigned**:
    - bid_number: Sequential 3-digit number (100-999)
    - status: Always starts as 'draft'
    - created_by: Current user ID

    Args:
        event_id: UUID of the event
        item_data: Auction item creation data
        current_user: Authenticated user
        db: Database session

    Returns:
        Created auction item

    Raises:
        HTTPException 403: User lacks permission
        HTTPException 404: Event not found
        HTTPException 409: Bid number sequence exhausted (999 items)
        HTTPException 422: Validation error
    """
    try:
        service = AuctionItemService(db)
        auction_item = await service.create_auction_item(
            event_id=event_id,
            item_data=item_data,
            created_by=current_user.id,
        )

        logger.info(
            f"User {current_user.id} created auction item {auction_item.id} for event {event_id}"
        )
        return AuctionItemResponse.model_validate(auction_item)

    except ValueError as e:
        if "999" in str(e) or "maximum" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e),
            )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.get(
    "",
    response_model=AuctionItemListResponse,
    summary="List auction items",
    description="List auction items for an event with optional filtering and sorting.",
)
async def list_auction_items(
    event_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    auction_type: Annotated[
        str | None,
        Query(description="Filter by auction type (silent, live, or 'all' for both)"),
    ] = None,
    item_status: Annotated[
        ItemStatus | None, Query(description="Filter by status", alias="status")
    ] = None,
    search: Annotated[
        str | None, Query(description="Search by title or bid number", max_length=200)
    ] = None,
    sort_by: Annotated[
        str,
        Query(
            description="Sort field: 'newest' (created_at DESC) or 'highest_bid' (current_bid DESC)"
        ),
    ] = "highest_bid",
    page: Annotated[int, Query(description="Page number (1-indexed)", ge=1)] = 1,
    limit: Annotated[int, Query(description="Items per page", ge=1, le=100)] = 50,
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
) -> AuctionItemListResponse:
    """List auction items for an event.

    **Permissions**:
    - Public: Returns only published items
    - Authenticated: Returns all items including drafts (if authorized)

    **Filtering**:
    - auction_type: silent, live, or 'all' (returns both types)
    - status: draft, published, sold, withdrawn
    - search: Matches title or bid number

    **Sorting**:
    - highest_bid (default): Items with highest current bid first
    - newest: Most recently created items first

    Args:
        event_id: UUID of the event
        auction_type: Filter by auction type (or 'all')
        item_status: Filter by status
        search: Search term
        sort_by: Sort field (highest_bid or newest)
        page: Page number
        limit: Items per page
        current_user: Optional authenticated user
        db: Database session

    Returns:
        Paginated list of auction items
    """
    service = AuctionItemService(db)

    # Determine if user can see drafts (service will handle authorization)
    include_drafts = current_user is not None

    # Handle 'all' auction_type - pass None to service to get both types
    actual_auction_type: AuctionType | None = None
    if auction_type and auction_type.lower() != "all":
        try:
            actual_auction_type = AuctionType(auction_type.lower())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid auction_type: {auction_type}. Must be 'silent', 'live', or 'all'.",
            )

    # Validate sort_by parameter
    if sort_by not in ("newest", "highest_bid"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid sort_by: {sort_by}. Must be 'newest' or 'highest_bid'.",
        )

    # List items
    items, total = await service.list_auction_items(
        event_id=event_id,
        auction_type=actual_auction_type,
        status=item_status,
        search=search,
        sort_by=sort_by,
        page=page,
        limit=limit,
        include_drafts=include_drafts,
    )

    # Calculate pagination
    total_pages = (total + limit - 1) // limit if total > 0 else 0

    # Enrich items with primary image URLs
    from sqlalchemy import select

    from app.models.auction_item import AuctionItemMedia
    from app.services.auction_item_media_service import AuctionItemMediaService

    settings = get_settings()
    media_service = AuctionItemMediaService(settings, db)

    enriched_items = []
    for item in items:
        item_dict = AuctionItemResponse.model_validate(item).model_dump()

        # Fetch primary image (first image by display_order)
        media_stmt = (
            select(AuctionItemMedia)
            .where(
                AuctionItemMedia.auction_item_id == item.id,
                AuctionItemMedia.media_type == "image",
            )
            .order_by(AuctionItemMedia.display_order)
            .limit(1)
        )
        media_result = await db.execute(media_stmt)
        primary_media = media_result.scalar_one_or_none()

        if primary_media and primary_media.file_path:
            # Generate SAS URL for full-resolution image (not thumbnail)
            if primary_media.file_path.startswith("https://"):
                try:
                    container_path = f"{settings.azure_storage_container_name}/"
                    if container_path in primary_media.file_path:
                        blob_path = primary_media.file_path.split(container_path, 1)[1]
                        blob_path = blob_path.split("?", 1)[0]
                        item_dict["primary_image_url"] = media_service._generate_blob_sas_url(
                            blob_path, expiry_hours=24
                        )
                    else:
                        item_dict["primary_image_url"] = primary_media.file_path
                except (ValueError, IndexError):
                    item_dict["primary_image_url"] = primary_media.file_path
            else:
                item_dict["primary_image_url"] = primary_media.file_path
        else:
            item_dict["primary_image_url"] = None

        enriched_items.append(AuctionItemResponse(**item_dict))

    return AuctionItemListResponse(
        items=enriched_items,
        pagination=PaginationInfo(
            page=page,
            limit=limit,
            total=total,
            pages=total_pages,
        ),
    )


@router.get(
    "/{item_id}",
    response_model=AuctionItemDetail,
    summary="Get auction item details",
    description="Get full details for a specific auction item including media and sponsor.",
)
async def get_auction_item(
    event_id: UUID,
    item_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> AuctionItemDetail:
    """Get auction item details.

    **Permissions**:
    - Authenticated users can view all items (permissions can be extended later)

    Args:
        event_id: UUID of the event
        item_id: UUID of the auction item
        current_user: Authenticated user (required)
        db: Database session

    Returns:
        Auction item with media and sponsor details

    Raises:
        HTTPException 404: Item not found or doesn't belong to event
    """
    service = AuctionItemService(db)

    # Get item with relationships
    item = await service.get_auction_item_by_id(
        item_id=item_id,
        include_media=True,
        include_sponsor=True,
    )

    if not item or item.event_id != event_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction item not found",
        )

    # Authenticated users can view all items
    # Future: Add NPO-specific permissions here if needed

    # Fetch media with SAS URLs
    from sqlalchemy import select

    from app.models.auction_item import AuctionItemMedia
    from app.schemas.auction_item_media import MediaResponse
    from app.services.auction_item_media_service import AuctionItemMediaService

    settings = get_settings()
    media_service = AuctionItemMediaService(settings, db)

    # Fetch media items
    media_stmt = (
        select(AuctionItemMedia)
        .where(AuctionItemMedia.auction_item_id == item_id)
        .order_by(AuctionItemMedia.display_order)
    )
    media_result = await db.execute(media_stmt)
    media_items = media_result.scalars().all()

    # Convert media URLs to SAS URLs
    media_responses = []
    for media in media_items:
        media_dict = MediaResponse.model_validate(media).model_dump()

        # Generate SAS URLs for file_path and thumbnail_path if using Azure Blob Storage
        if media.file_path and media.file_path.startswith("https://"):
            blob_path = "/".join(
                media.file_path.split(f"{settings.azure_storage_container_name}/")[1]
                .split("?")[0]
                .split("/")
            )
            try:
                media_dict["file_path"] = media_service._generate_blob_sas_url(
                    blob_path, expiry_hours=24
                )
            except ValueError:
                pass

        if media.thumbnail_path and media.thumbnail_path.startswith("https://"):
            thumb_blob_path = "/".join(
                media.thumbnail_path.split(f"{settings.azure_storage_container_name}/")[1]
                .split("?")[0]
                .split("/")
            )
            try:
                media_dict["thumbnail_path"] = media_service._generate_blob_sas_url(
                    thumb_blob_path, expiry_hours=24
                )
            except ValueError:
                pass

        media_responses.append(media_dict)

    # Build response dictionary with all fields
    response_dict = {
        **AuctionItemResponse.model_validate(item).model_dump(),
        "media": media_responses,
    }

    return AuctionItemDetail(**response_dict)


@router.patch(
    "/{item_id}",
    response_model=AuctionItemResponse,
    summary="Update auction item",
    description="Update auction item fields. Requires authentication.",
)
async def update_auction_item(
    event_id: UUID,
    item_id: UUID,
    update_data: AuctionItemUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuctionItemResponse:
    """Update an auction item.

    **Permissions**: Authenticated users (permissions checked in service layer)

    **Note**: bid_number cannot be changed after creation.

    Args:
        event_id: UUID of the event
        item_id: UUID of the auction item
        update_data: Fields to update
        current_user: Authenticated user
        db: Database session

    Returns:
        Updated auction item

    Raises:
        HTTPException 403: User lacks permission
        HTTPException 404: Item not found
        HTTPException 422: Validation error
    """
    # Verify item exists and belongs to event
    service = AuctionItemService(db)
    existing_item = await service.get_auction_item_by_id(item_id)

    if not existing_item or existing_item.event_id != event_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction item not found",
        )

    # Update item
    try:
        updated_item = await service.update_auction_item(
            item_id=item_id,
            update_data=update_data,
        )

        logger.info(f"User {current_user.id} updated auction item {item_id}")
        return AuctionItemResponse.model_validate(updated_item)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete auction item",
    description="Delete auction item. Requires authentication.",
)
async def delete_auction_item(
    event_id: UUID,
    item_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete an auction item.

    **Permissions**: Authenticated users (permissions checked in service layer)

    **Delete Strategy**:
    - Soft delete: Published, sold, or withdrawn items (preserves audit trail)
    - Hard delete: Draft items with no bids

    Args:
        event_id: UUID of the event
        item_id: UUID of the auction item
        current_user: Authenticated user
        db: Database session

    Raises:
        HTTPException 403: User lacks permission
        HTTPException 404: Item not found
    """
    # Verify item exists and belongs to event
    service = AuctionItemService(db)
    existing_item = await service.get_auction_item_by_id(item_id)

    if not existing_item or existing_item.event_id != event_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction item not found",
        )

    # Delete item
    try:
        await service.delete_auction_item(item_id=item_id)
        logger.info(f"User {current_user.id} deleted auction item {item_id}")

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


# Donor-facing endpoints (no event_id in path)
@donor_router.post(
    "/{item_id}/views",
    response_model=ItemViewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record item view",
    description="Record that a user viewed an auction item with duration tracking.",
)
async def record_item_view(
    item_id: UUID,
    view_data: ItemViewCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ItemViewResponse:
    """Record an item view.

    **Permissions**: Authenticated users

    Records that a user viewed an auction item, including when they started
    viewing and for how long. This data is used for engagement analytics.

    Args:
        item_id: UUID of auction item
        view_data: View data (view_started_at, view_duration_seconds)
        current_user: Authenticated user
        db: Database session

    Returns:
        Created item view record

    Raises:
        HTTPException 401: Not authenticated
        HTTPException 404: Item not found
        HTTPException 422: Validation error (negative duration, etc.)
    """
    # Verify item exists and get event_id
    service = AuctionItemService(db)
    item = await service.get_auction_item_by_id(item_id)

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Auction item {item_id} not found",
        )

    # Validate that item_id in path matches body
    if view_data.item_id != item_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Item ID in path must match item ID in request body",
        )

    view_service = ItemViewService(db)

    try:
        view = await view_service.record_view(
            item_id=item_id,
            event_id=item.event_id,
            user_id=current_user.id,
            view_started_at=view_data.view_started_at,
            view_duration_seconds=view_data.view_duration_seconds,
        )

        logger.info(
            f"User {current_user.id} viewed item {item_id} for "
            f"{view_data.view_duration_seconds} seconds"
        )
        return ItemViewResponse.model_validate(view)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
