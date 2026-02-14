"""Unit tests for ItemViewService."""

import uuid
from datetime import UTC, datetime
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.event import Event
from app.models.user import User
from app.services.item_view_service import ItemViewService


async def _create_auction_item(
    db_session: AsyncSession,
    event_id: UUID,
    created_by: UUID,
) -> AuctionItem:
    """Helper to create a test auction item."""
    item = AuctionItem(
        id=uuid.uuid4(),
        event_id=event_id,
        created_by=created_by,
        bid_number=100,
        title="Test Item",
        description="Test description",
        auction_type=AuctionType.SILENT.value,
        starting_bid=100.00,
        bid_increment=10.00,
        status=ItemStatus.PUBLISHED.value,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


@pytest.mark.asyncio
class TestItemViewService:
    """Tests for ItemViewService."""

    async def test_record_view_success(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test successfully recording an item view."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        service = ItemViewService(db_session)
        view_time = datetime.now(UTC)
        
        view = await service.record_view(
            item_id=item.id,
            event_id=test_event.id,
            user_id=test_user.id,
            view_started_at=view_time,
            view_duration_seconds=30,
        )
        
        assert view.item_id == item.id
        assert view.user_id == test_user.id
        assert view.event_id == test_event.id
        assert view.view_duration_seconds == 30
        assert view.view_started_at == view_time

    async def test_get_item_views(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test getting all views for an item."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        service = ItemViewService(db_session)
        
        # Record multiple views
        await service.record_view(
            item.id, test_event.id, test_user.id,
            datetime.now(UTC), 30
        )
        await service.record_view(
            item.id, test_event.id, test_user.id,
            datetime.now(UTC), 45
        )
        
        # Get all views
        views = await service.get_item_views(item.id)
        
        assert len(views) == 2
        assert views[0].view_duration_seconds in [30, 45]

    async def test_get_view_stats(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test getting view statistics for an item."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        service = ItemViewService(db_session)
        
        # Record multiple views
        await service.record_view(
            item.id, test_event.id, test_user.id,
            datetime.now(UTC), 30
        )
        await service.record_view(
            item.id, test_event.id, test_user.id,
            datetime.now(UTC), 45
        )
        
        # Get stats
        stats = await service.get_view_stats(item.id)
        
        assert stats["total_views"] == 2
        assert stats["total_duration_seconds"] == 75
        assert stats["unique_viewers"] == 1

    async def test_get_user_views(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test getting all views by a user."""
        item1 = await _create_auction_item(db_session, test_event.id, test_user.id)
        item2 = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        service = ItemViewService(db_session)
        
        # Record views on different items
        await service.record_view(
            item1.id, test_event.id, test_user.id,
            datetime.now(UTC), 30
        )
        await service.record_view(
            item2.id, test_event.id, test_user.id,
            datetime.now(UTC), 45
        )
        
        # Get user's views
        views = await service.get_user_views(test_user.id, test_event.id)
        
        assert len(views) == 2
        item_ids = {v.item_id for v in views}
        assert item1.id in item_ids
        assert item2.id in item_ids
