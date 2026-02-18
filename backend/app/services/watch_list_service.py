"""Service for watch list operations."""

import logging
import uuid
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem
from app.models.watch_list_entry import WatchListEntry

logger = logging.getLogger(__name__)


class WatchListService:
    """Service for managing auction item watch lists."""

    def __init__(self, db: AsyncSession):
        """Initialize the service with a database session.

        Args:
            db: SQLAlchemy async session
        """
        self.db = db

    async def add_to_watch_list(
        self,
        item_id: UUID,
        event_id: UUID,
        user_id: UUID,
    ) -> WatchListEntry:
        """Add an item to user's watch list.

        Args:
            item_id: Auction item ID
            event_id: Event ID
            user_id: User ID

        Returns:
            Created watch list entry

        Raises:
            ValueError: If item already in watch list or item not found
        """
        # Check if already watching
        stmt = select(WatchListEntry).where(
            WatchListEntry.item_id == item_id,
            WatchListEntry.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            logger.info(f"Item {item_id} already in watch list for user {user_id}")
            return existing

        # Verify item exists
        item_stmt = select(AuctionItem).where(AuctionItem.id == item_id)
        item_result = await self.db.execute(item_stmt)
        item = item_result.scalar_one_or_none()

        if not item:
            raise ValueError(f"Auction item {item_id} not found")

        # Create watch list entry
        entry = WatchListEntry(
            id=uuid.uuid4(),
            item_id=item_id,
            event_id=event_id,
            user_id=user_id,
        )
        self.db.add(entry)

        # Update watcher count on item
        item.watcher_count = item.watcher_count + 1

        await self.db.commit()
        await self.db.refresh(entry)

        logger.info(f"Added item {item_id} to watch list for user {user_id}")
        return entry

    async def remove_from_watch_list(
        self,
        item_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Remove an item from user's watch list.

        Args:
            item_id: Auction item ID
            user_id: User ID

        Returns:
            True if removed, False if not in watch list
        """
        stmt = select(WatchListEntry).where(
            WatchListEntry.item_id == item_id,
            WatchListEntry.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        entry = result.scalar_one_or_none()

        if not entry:
            logger.info(f"Item {item_id} not in watch list for user {user_id}")
            return False

        # Decrement watcher count
        item_stmt = select(AuctionItem).where(AuctionItem.id == item_id)
        item_result = await self.db.execute(item_stmt)
        item = item_result.scalar_one_or_none()

        if item and item.watcher_count > 0:
            item.watcher_count = item.watcher_count - 1

        await self.db.delete(entry)
        await self.db.commit()

        logger.info(f"Removed item {item_id} from watch list for user {user_id}")
        return True

    async def get_user_watch_list(
        self,
        user_id: UUID,
        event_id: UUID | None = None,
    ) -> list[WatchListEntry]:
        """Get user's watch list entries.

        Args:
            user_id: User ID
            event_id: Optional event ID to filter by

        Returns:
            List of watch list entries
        """
        stmt = select(WatchListEntry).where(WatchListEntry.user_id == user_id)

        if event_id:
            stmt = stmt.where(WatchListEntry.event_id == event_id)

        stmt = stmt.order_by(WatchListEntry.created_at.desc())

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def is_watching(self, item_id: UUID, user_id: UUID) -> bool:
        """Check if user is watching an item.

        Args:
            item_id: Auction item ID
            user_id: User ID

        Returns:
            True if watching, False otherwise
        """
        stmt = select(func.count(WatchListEntry.id)).where(
            WatchListEntry.item_id == item_id,
            WatchListEntry.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        count = result.scalar()
        return count > 0

    async def get_watchers(self, item_id: UUID) -> list[WatchListEntry]:
        """Get all watchers for an item (admin use).

        Args:
            item_id: Auction item ID

        Returns:
            List of watch list entries for the item
        """
        stmt = (
            select(WatchListEntry)
            .where(WatchListEntry.item_id == item_id)
            .order_by(WatchListEntry.created_at.desc())
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())
