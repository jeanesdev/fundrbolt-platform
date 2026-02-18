"""Unit tests for WatchListService."""

import uuid
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.event import Event
from app.models.user import User
from app.models.watch_list_entry import WatchListEntry
from app.services.watch_list_service import WatchListService


async def _create_auction_item(
    db_session: AsyncSession,
    event_id: UUID,
    created_by: UUID,
    title: str = "Test Item",
) -> AuctionItem:
    """Helper to create a test auction item."""
    item = AuctionItem(
        id=uuid.uuid4(),
        event_id=event_id,
        created_by=created_by,
        bid_number=100,
        title=title,
        description="Test description",
        auction_type=AuctionType.SILENT.value,
        starting_bid=100.00,
        bid_increment=10.00,
        status=ItemStatus.PUBLISHED.value,
        watcher_count=0,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


@pytest.mark.asyncio
class TestWatchListService:
    """Tests for WatchListService."""

    async def test_add_to_watch_list_success(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test successfully adding an item to watch list."""
        # Create auction item
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        # Add to watch list
        service = WatchListService(db_session)
        entry = await service.add_to_watch_list(
            item_id=item.id,
            event_id=test_event.id,
            user_id=test_user.id,
        )
        
        assert entry.item_id == item.id
        assert entry.user_id == test_user.id
        assert entry.event_id == test_event.id
        
        # Check watcher count was incremented
        await db_session.refresh(item)
        assert item.watcher_count == 1

    async def test_add_to_watch_list_duplicate(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test adding same item twice returns existing entry."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        service = WatchListService(db_session)
        
        # Add first time
        entry1 = await service.add_to_watch_list(
            item_id=item.id,
            event_id=test_event.id,
            user_id=test_user.id,
        )
        
        # Add second time
        entry2 = await service.add_to_watch_list(
            item_id=item.id,
            event_id=test_event.id,
            user_id=test_user.id,
        )
        
        assert entry1.id == entry2.id
        
        # Watcher count should still be 1
        await db_session.refresh(item)
        assert item.watcher_count == 1

    async def test_add_to_watch_list_item_not_found(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test adding non-existent item raises ValueError."""
        service = WatchListService(db_session)
        
        with pytest.raises(ValueError, match="not found"):
            await service.add_to_watch_list(
                item_id=uuid.uuid4(),
                event_id=test_event.id,
                user_id=test_user.id,
            )

    async def test_remove_from_watch_list_success(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test successfully removing item from watch list."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        service = WatchListService(db_session)
        
        # Add to watch list
        await service.add_to_watch_list(
            item_id=item.id,
            event_id=test_event.id,
            user_id=test_user.id,
        )
        
        await db_session.refresh(item)
        assert item.watcher_count == 1
        
        # Remove from watch list
        result = await service.remove_from_watch_list(
            item_id=item.id,
            user_id=test_user.id,
        )
        
        assert result is True
        
        # Check watcher count was decremented
        await db_session.refresh(item)
        assert item.watcher_count == 0

    async def test_remove_from_watch_list_not_watching(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test removing item not in watch list returns False."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        service = WatchListService(db_session)
        result = await service.remove_from_watch_list(
            item_id=item.id,
            user_id=test_user.id,
        )
        
        assert result is False

    async def test_get_user_watch_list(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test getting user's watch list."""
        item1 = await _create_auction_item(db_session, test_event.id, test_user.id, "Item 1")
        item2 = await _create_auction_item(db_session, test_event.id, test_user.id, "Item 2")
        
        service = WatchListService(db_session)
        
        # Add items to watch list
        await service.add_to_watch_list(item1.id, test_event.id, test_user.id)
        await service.add_to_watch_list(item2.id, test_event.id, test_user.id)
        
        # Get watch list
        entries = await service.get_user_watch_list(test_user.id, test_event.id)
        
        assert len(entries) == 2
        assert any(e.item_id == item1.id for e in entries)
        assert any(e.item_id == item2.id for e in entries)

    async def test_is_watching(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test checking if user is watching an item."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        service = WatchListService(db_session)
        
        # Not watching initially
        is_watching = await service.is_watching(item.id, test_user.id)
        assert is_watching is False
        
        # Add to watch list
        await service.add_to_watch_list(item.id, test_event.id, test_user.id)
        
        # Now watching
        is_watching = await service.is_watching(item.id, test_user.id)
        assert is_watching is True

    async def test_get_watchers(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test getting all watchers for an item."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        service = WatchListService(db_session)
        
        # Add to watch list
        await service.add_to_watch_list(item.id, test_event.id, test_user.id)
        
        # Get watchers
        watchers = await service.get_watchers(item.id)
        
        assert len(watchers) == 1
        assert watchers[0].user_id == test_user.id
