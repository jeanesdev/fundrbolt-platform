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
from app.services.auction_item_service import AuctionItemService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events/{event_id}/auction-items", tags=["Auction Items"])


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
    description="List auction items for an event with optional filtering.",
)
async def list_auction_items(
    event_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    auction_type: Annotated[AuctionType | None, Query(description="Filter by auction type")] = None,
    status: Annotated[ItemStatus | None, Query(description="Filter by status")] = None,
    search: Annotated[
        str | None, Query(description="Search by title or bid number", max_length=200)
    ] = None,
    page: Annotated[int, Query(description="Page number (1-indexed)", ge=1)] = 1,
    limit: Annotated[int, Query(description="Items per page", ge=1, le=100)] = 50,
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
) -> AuctionItemListResponse:
    """List auction items for an event.

    **Permissions**:
    - Public: Returns only published items
    - Authenticated: Returns all items including drafts (if authorized)

    **Filtering**:
    - auction_type: live, silent
    - status: draft, published, sold, withdrawn
    - search: Matches title or bid number

    Args:
        event_id: UUID of the event
        auction_type: Filter by auction type
        status: Filter by status
        search: Search term
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

    # List items
    items, total = await service.list_auction_items(
        event_id=event_id,
        auction_type=auction_type,
        status=status,
        search=search,
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

        if primary_media and primary_media.thumbnail_path:
            # Generate SAS URL for thumbnail
            if primary_media.thumbnail_path.startswith("https://"):
                blob_path = "/".join(
                    primary_media.thumbnail_path.split(f"{settings.azure_storage_container_name}/")[
                        1
                    ]
                    .split("?")[0]
                    .split("/")
                )
                try:
                    item_dict["primary_image_url"] = media_service._generate_blob_sas_url(
                        blob_path, expiry_hours=24
                    )
                except ValueError:
                    item_dict["primary_image_url"] = primary_media.thumbnail_path
            else:
                item_dict["primary_image_url"] = primary_media.thumbnail_path
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
