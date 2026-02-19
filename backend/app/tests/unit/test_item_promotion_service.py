"""Unit tests for ItemPromotionService."""

import uuid
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.event import Event
from app.models.user import User
from app.services.item_promotion_service import ItemPromotionService


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
class TestItemPromotionService:
    """Tests for ItemPromotionService."""

    async def test_update_promotion_create_new(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test creating a new promotion."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = ItemPromotionService(db_session)
        promotion = await service.update_promotion(
            item_id=item.id,
            event_id=test_event.id,
            updated_by_user_id=test_user.id,
            badge_label="Hot Item",
            notice_message="Limited time offer!",
        )

        assert promotion.item_id == item.id
        assert promotion.badge_label == "Hot Item"
        assert promotion.notice_message == "Limited time offer!"

        # Check denormalized fields on item
        await db_session.refresh(item)
        assert item.promotion_badge == "Hot Item"
        assert item.promotion_notice == "Limited time offer!"

    async def test_update_promotion_update_existing(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test updating an existing promotion."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = ItemPromotionService(db_session)

        # Create initial promotion
        await service.update_promotion(
            item.id, test_event.id, test_user.id, "Hot Item", "Limited time!"
        )

        # Update promotion
        updated = await service.update_promotion(
            item.id, test_event.id, test_user.id, "Super Deal", "Amazing value!"
        )

        assert updated.badge_label == "Super Deal"
        assert updated.notice_message == "Amazing value!"

        # Check denormalized fields updated
        await db_session.refresh(item)
        assert item.promotion_badge == "Super Deal"
        assert item.promotion_notice == "Amazing value!"

    async def test_update_promotion_item_not_found(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test updating promotion for non-existent item."""
        service = ItemPromotionService(db_session)

        with pytest.raises(ValueError, match="not found"):
            await service.update_promotion(
                item_id=uuid.uuid4(),
                event_id=test_event.id,
                updated_by_user_id=test_user.id,
                badge_label="Test",
                notice_message="Test",
            )

    async def test_get_promotion(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test getting a promotion."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = ItemPromotionService(db_session)

        # No promotion initially
        promotion = await service.get_promotion(item.id)
        assert promotion is None

        # Create promotion
        await service.update_promotion(
            item.id, test_event.id, test_user.id, "Hot Item", "Limited time!"
        )

        # Get promotion
        promotion = await service.get_promotion(item.id)
        assert promotion is not None
        assert promotion.badge_label == "Hot Item"

    async def test_delete_promotion(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test deleting a promotion."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = ItemPromotionService(db_session)

        # Create promotion
        await service.update_promotion(
            item.id, test_event.id, test_user.id, "Hot Item", "Limited time!"
        )

        await db_session.refresh(item)
        assert item.promotion_badge == "Hot Item"

        # Delete promotion
        result = await service.delete_promotion(item.id)
        assert result is True

        # Check denormalized fields cleared
        await db_session.refresh(item)
        assert item.promotion_badge is None
        assert item.promotion_notice is None

    async def test_delete_promotion_not_exists(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test deleting non-existent promotion."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = ItemPromotionService(db_session)
        result = await service.delete_promotion(item.id)

        assert result is False
