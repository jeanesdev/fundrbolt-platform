"""Service for auction item operations."""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.event import Event
from app.schemas.auction_item import AuctionItemCreate, AuctionItemUpdate
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class AuctionItemService:
    """Service for auction item operations."""

    def __init__(self, db: AsyncSession):
        """Initialize the service with a database session.

        Args:
            db: SQLAlchemy async session
        """
        self.db = db

    async def _ensure_bid_number_sequence(self, event_id: UUID) -> None:
        """Ensure PostgreSQL sequence exists for event bid numbers.

        Creates a sequence named 'event_{event_id}_bid_number_seq' starting at 100.
        This sequence handles concurrent bid number assignment atomically.

        Args:
            event_id: UUID of the event

        Raises:
            ValueError: If sequence cannot be created
        """
        sequence_name = f"event_{str(event_id).replace('-', '_')}_bid_number_seq"

        try:
            # Check if sequence exists
            check_query = text(
                "SELECT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = :seq_name)"
            )
            result = await self.db.execute(check_query, {"seq_name": sequence_name})
            exists = result.scalar()

            if not exists:
                # Create sequence starting at 100 (3-digit bid numbers: 100-999)
                create_query = text(
                    f"CREATE SEQUENCE {sequence_name} START 100 MINVALUE 100 MAXVALUE 999"
                )
                await self.db.execute(create_query)
                await self.db.commit()
                logger.info(f"Created bid number sequence {sequence_name} for event {event_id}")

        except Exception as e:
            logger.error(f"Failed to create bid number sequence: {e}")
            await self.db.rollback()
            raise ValueError(f"Failed to ensure bid number sequence: {e}") from e

    async def _get_next_bid_number(self, event_id: UUID) -> int:
        """Get next available bid number for an event.

        Uses PostgreSQL sequence to atomically assign bid numbers.
        Handles concurrency automatically via database-level locking.

        Args:
            event_id: UUID of the event

        Returns:
            Next bid number (100-999)

        Raises:
            ValueError: If max bid numbers (999) reached for event
        """
        # Ensure sequence exists
        await self._ensure_bid_number_sequence(event_id)

        sequence_name = f"event_{str(event_id).replace('-', '_')}_bid_number_seq"

        try:
            # Get next value from sequence (atomic operation)
            query = text(f"SELECT nextval('{sequence_name}')")
            result = await self.db.execute(query)
            bid_number = result.scalar()

            # Ensure bid_number is valid
            if bid_number is None:
                raise ValueError("Failed to get bid number from sequence")

            bid_number = int(bid_number)  # Convert to int for type safety

            if bid_number > 999:
                logger.error(f"Event {event_id} has exceeded maximum bid numbers (999)")
                raise ValueError("Event has reached maximum auction items (900 items limit)")

            return bid_number

        except Exception as e:
            logger.error(f"Failed to get next bid number: {e}")
            raise ValueError(f"Failed to assign bid number: {e}") from e

    async def create_auction_item(
        self,
        event_id: UUID,
        item_data: AuctionItemCreate,
        created_by: UUID,
    ) -> AuctionItem:
        """Create a new auction item with auto-assigned bid number.

        Args:
            event_id: UUID of the event
            item_data: Auction item creation data
            created_by: UUID of the user creating the item

        Returns:
            Created AuctionItem instance

        Raises:
            ValueError: If validation fails or event doesn't exist
        """
        # Verify event exists
        event_query = select(Event).where(Event.id == event_id)
        result = await self.db.execute(event_query)
        event = result.scalar_one_or_none()

        if not event:
            raise ValueError(f"Event {event_id} not found")

        # Cross-field validation (deferred from Pydantic schema)
        if item_data.buy_now_price is not None:
            if item_data.buy_now_price < item_data.starting_bid:
                raise ValueError(
                    f"Buy now price (${item_data.buy_now_price}) must be >= starting bid (${item_data.starting_bid})"
                )

            if not item_data.buy_now_enabled:
                raise ValueError("buy_now_enabled must be True when buy_now_price is set")

        # Get next bid number (atomic)
        bid_number = await self._get_next_bid_number(event_id)

        # Create auction item
        auction_item = AuctionItem(
            event_id=event_id,
            bid_number=bid_number,
            title=item_data.title,
            description=item_data.description,
            auction_type=item_data.auction_type,
            starting_bid=item_data.starting_bid,
            donor_value=item_data.donor_value,
            cost=item_data.cost,
            buy_now_price=item_data.buy_now_price,
            buy_now_enabled=item_data.buy_now_enabled,
            quantity_available=item_data.quantity_available,
            donated_by=item_data.donated_by,
            sponsor_id=item_data.sponsor_id,
            item_webpage=item_data.item_webpage,
            display_priority=item_data.display_priority,
            status=ItemStatus.DRAFT,  # New items start as draft
            created_by=created_by,
        )

        self.db.add(auction_item)

        try:
            await self.db.commit()
            await self.db.refresh(auction_item)

            # Audit logging (T025)
            await AuditService.log_auction_item_created(
                db=self.db,
                item_id=auction_item.id,
                event_id=event_id,
                bid_number=bid_number,
                title=item_data.title,
                created_by_user_id=created_by,
            )

            logger.info(
                f"Created auction item {auction_item.id} with bid number {bid_number} for event {event_id}"
            )
            return auction_item

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create auction item: {e}")
            raise ValueError(f"Failed to create auction item: {e}") from e

    async def get_auction_item_by_id(
        self,
        item_id: UUID,
        include_media: bool = False,
        include_sponsor: bool = False,
    ) -> AuctionItem | None:
        """Get auction item by ID with optional eager loading.

        Args:
            item_id: UUID of the auction item
            include_media: Whether to eagerly load media files
            include_sponsor: Whether to eagerly load sponsor details

        Returns:
            AuctionItem instance or None if not found
        """
        query = select(AuctionItem).where(
            AuctionItem.id == item_id,
            AuctionItem.deleted_at.is_(None),
        )

        # Eager load relationships if requested
        if include_media:
            query = query.options(joinedload(AuctionItem.media))
        if include_sponsor:
            query = query.options(joinedload(AuctionItem.sponsor))

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_auction_items(
        self,
        event_id: UUID,
        auction_type: AuctionType | None = None,
        status: ItemStatus | None = None,
        search: str | None = None,
        page: int = 1,
        limit: int = 50,
        include_drafts: bool = False,
    ) -> tuple[list[AuctionItem], int]:
        """List auction items for an event with filtering and pagination.

        Args:
            event_id: UUID of the event
            auction_type: Filter by auction type (live/silent)
            status: Filter by status
            search: Search by title or bid number
            page: Page number (1-indexed)
            limit: Items per page (max 100)
            include_drafts: Whether to include draft items (requires auth)

        Returns:
            Tuple of (list of items, total count)
        """
        # Validate pagination
        if page < 1:
            page = 1
        if limit < 1 or limit > 100:
            limit = 50

        # Base query
        query = select(AuctionItem).where(
            AuctionItem.event_id == event_id,
            AuctionItem.deleted_at.is_(None),
        )

        # Filter by status (default: published only)
        if not include_drafts:
            query = query.where(AuctionItem.status == ItemStatus.PUBLISHED)
        elif status:
            query = query.where(AuctionItem.status == status)

        # Filter by auction type
        if auction_type:
            query = query.where(AuctionItem.auction_type == auction_type)

        # Search by title or bid number
        if search:
            search_term = f"%{search}%"
            query = query.where(
                (AuctionItem.title.ilike(search_term))
                | (AuctionItem.bid_number.cast(text("TEXT")).like(search_term))
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination and ordering
        query = query.order_by(AuctionItem.bid_number.asc())
        query = query.offset((page - 1) * limit).limit(limit)

        # Execute query
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total

    async def update_auction_item(
        self,
        item_id: UUID,
        update_data: AuctionItemUpdate,
    ) -> AuctionItem:
        """Update an auction item.

        Args:
            item_id: UUID of the auction item
            update_data: Fields to update (partial)

        Returns:
            Updated AuctionItem instance

        Raises:
            ValueError: If item not found or validation fails
        """
        # Get existing item
        item = await self.get_auction_item_by_id(item_id)
        if not item:
            raise ValueError(f"Auction item {item_id} not found")

        # Track changes for logging
        changes: dict[str, Any] = {}

        # Update fields (only if provided)
        update_dict = update_data.model_dump(exclude_unset=True)

        for field, value in update_dict.items():
            if hasattr(item, field):
                old_value = getattr(item, field)
                if old_value != value:
                    setattr(item, field, value)
                    changes[field] = {"old": old_value, "new": value}

        # Cross-field validation
        if item.buy_now_price is not None and item.buy_now_price < item.starting_bid:
            raise ValueError(f"Buy now price must be >= starting bid (${item.starting_bid})")

        if item.buy_now_enabled and item.buy_now_price is None:
            raise ValueError("buy_now_price is required when buy_now_enabled is True")

        # Update timestamp
        item.updated_at = datetime.now(UTC)

        try:
            await self.db.commit()
            await self.db.refresh(item)

            # Audit logging (T025) - only if changes were made
            if changes:
                # Convert changes dict to simple key-value pairs for logging
                simplified_changes = {k: v["new"] for k, v in changes.items()}
                await AuditService.log_auction_item_updated(
                    db=self.db,
                    item_id=item_id,
                    event_id=item.event_id,
                    bid_number=item.bid_number,
                    title=item.title,
                    updated_fields=simplified_changes,
                    updated_by_user_id=item.created_by,  # Note: user_id should be passed in, for now using created_by
                )

            logger.info(f"Updated auction item {item_id}: {changes}")
            return item

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to update auction item: {e}")
            raise ValueError(f"Failed to update auction item: {e}") from e

    async def delete_auction_item(
        self,
        item_id: UUID,
        force_hard_delete: bool = False,
    ) -> bool:
        """Delete auction item (soft or hard delete based on status).

        Soft delete if:
        - Item is published, sold, or withdrawn
        - Item has bids (Phase 2: bidding feature)

        Hard delete if:
        - Item is draft with no bids
        - force_hard_delete is True

        Args:
            item_id: UUID of the auction item
            force_hard_delete: Force permanent deletion

        Returns:
            True if deleted successfully

        Raises:
            ValueError: If item not found
        """
        item = await self.get_auction_item_by_id(item_id, include_media=True)
        if not item:
            raise ValueError(f"Auction item {item_id} not found")

        # Determine delete strategy
        should_soft_delete = (
            item.status in [ItemStatus.PUBLISHED, ItemStatus.SOLD, ItemStatus.WITHDRAWN]
            or not force_hard_delete
        )

        try:
            if should_soft_delete:
                # Soft delete: Set deleted_at and withdrawn status
                item.deleted_at = datetime.now(UTC)
                item.status = ItemStatus.WITHDRAWN
                await self.db.commit()

                # Audit logging (T025)
                await AuditService.log_auction_item_deleted(
                    db=self.db,
                    item_id=item_id,
                    event_id=item.event_id,
                    bid_number=item.bid_number,
                    title=item.title,
                    deleted_by_user_id=item.created_by,  # Note: user_id should be passed in
                    is_soft_delete=True,
                )

                logger.info(f"Soft deleted auction item {item_id}")
            else:
                # Hard delete: Remove from database and clean up media blobs
                # Note: Media blob cleanup will be implemented in AuctionItemMediaService (T047)

                # Audit logging before deletion (T025)
                await AuditService.log_auction_item_deleted(
                    db=self.db,
                    item_id=item_id,
                    event_id=item.event_id,
                    bid_number=item.bid_number,
                    title=item.title,
                    deleted_by_user_id=item.created_by,  # Note: user_id should be passed in
                    is_soft_delete=False,
                )

                await self.db.delete(item)
                await self.db.commit()
                logger.info(f"Hard deleted auction item {item_id}")

            return True

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to delete auction item: {e}")
            raise ValueError(f"Failed to delete auction item: {e}") from e
