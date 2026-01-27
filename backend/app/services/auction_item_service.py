"""Service for auction item operations."""

import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
import uuid
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.event import Event
from app.schemas.auction_item import AuctionItemCreate, AuctionItemUpdate
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


def calculate_bid_increment(starting_bid: Decimal) -> Decimal:
    """Calculate bid increment based on starting bid amount.

    Bid increment ranges:
    - $0-$50: $5
    - $50-$150: $10
    - $150-$500: $25
    - $500-$1000: $50
    - $1000-$2500: $100
    - $2500+: $250

    Args:
        starting_bid: The starting bid amount

    Returns:
        Recommended bid increment
    """
    if starting_bid <= Decimal("50"):
        return Decimal("5.00")
    elif starting_bid <= Decimal("150"):
        return Decimal("10.00")
    elif starting_bid <= Decimal("500"):
        return Decimal("25.00")
    elif starting_bid <= Decimal("1000"):
        return Decimal("50.00")
    elif starting_bid <= Decimal("2500"):
        return Decimal("100.00")
    else:
        return Decimal("250.00")


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
                # Note: Sequence creation is transactional and will be committed with the main transaction
                create_query = text(
                    f"CREATE SEQUENCE {sequence_name} START 100 MINVALUE 100 MAXVALUE 999"
                )
                await self.db.execute(create_query)
                logger.info(f"Created bid number sequence {sequence_name} for event {event_id}")

        except Exception as e:
            logger.error(f"Failed to create bid number sequence: {e}")
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

        # Auto-calculate bid_increment if not provided or set to default
        bid_increment = item_data.bid_increment
        if bid_increment == Decimal("50.00"):  # Default value
            bid_increment = calculate_bid_increment(item_data.starting_bid)

        # Create auction item
        auction_item = AuctionItem(
            event_id=event_id,
            external_id=item_data.external_id or str(uuid.uuid4()),
            bid_number=bid_number,
            title=item_data.title,
            description=item_data.description,
            auction_type=item_data.auction_type,
            starting_bid=item_data.starting_bid,
            bid_increment=bid_increment,
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
            include_media: Whether to eagerly load media files (not yet implemented)
            include_sponsor: Whether to eagerly load sponsor details (not yet implemented)

        Returns:
            AuctionItem instance or None if not found

        Note:
            include_media and include_sponsor are placeholders for future functionality.
            Currently these parameters are ignored.
        """
        query = select(AuctionItem).where(
            AuctionItem.id == item_id,
            AuctionItem.deleted_at.is_(None),
        )

        # TODO: Implement eager loading when media/sponsor endpoints are ready
        # if include_media:
        #     query = query.options(joinedload(AuctionItem.media))
        # if include_sponsor:
        #     query = query.options(joinedload(AuctionItem.sponsor))

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_auction_items(
        self,
        event_id: UUID,
        auction_type: AuctionType | None = None,
        status: ItemStatus | None = None,
        search: str | None = None,
        sort_by: str = "highest_bid",
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
            sort_by: Sort field - 'highest_bid' (default) or 'newest'
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
            from sqlalchemy import String

            search_term = f"%{search}%"
            query = query.where(
                (AuctionItem.title.ilike(search_term))
                | (AuctionItem.bid_number.cast(String).like(search_term))
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply sorting based on sort_by parameter
        if sort_by == "newest":
            # Most recently created first
            query = query.order_by(AuctionItem.created_at.desc(), AuctionItem.bid_number.asc())
        else:  # Default: "highest_bid"
            # Highest starting bid first (current_bid tracking will be added later)
            # Secondary sort by display_priority and bid_number for consistent ordering
            query = query.order_by(
                AuctionItem.starting_bid.desc().nulls_last(),
                AuctionItem.display_priority.asc().nulls_last(),
                AuctionItem.bid_number.asc(),
            )

        # Apply pagination
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

        # If starting_bid is being updated and bid_increment is not, auto-calculate
        if "starting_bid" in update_dict and "bid_increment" not in update_dict:
            new_starting_bid = update_dict["starting_bid"]
            auto_increment = calculate_bid_increment(new_starting_bid)
            update_dict["bid_increment"] = auto_increment

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
                # Convert changes dict to JSON-serializable format
                # Decimals → strings, UUIDs → strings, etc.
                simplified_changes = {}
                for k, v in changes.items():
                    new_value = v["new"]
                    # Convert Decimal to string for JSON serialization
                    if isinstance(new_value, Decimal):
                        simplified_changes[k] = str(new_value)
                    # Convert UUID to string
                    elif isinstance(new_value, UUID):
                        simplified_changes[k] = str(new_value)
                    # Keep other types as-is (str, int, bool, etc.)
                    else:
                        simplified_changes[k] = new_value

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
        # Soft delete published/sold/withdrawn items to preserve audit trail
        # Hard delete draft items unless explicitly prevented
        should_soft_delete = (
            item.status in [ItemStatus.PUBLISHED, ItemStatus.SOLD, ItemStatus.WITHDRAWN]
            and not force_hard_delete
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
