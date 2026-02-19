"""Unit tests for BuyNowAvailabilityService."""

import uuid
from decimal import Decimal
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.event import Event
from app.models.user import User
from app.services.buy_now_availability_service import BuyNowAvailabilityService


async def _create_auction_item(
    db_session: AsyncSession,
    event_id: UUID,
    created_by: UUID,
    buy_now_enabled: bool = False,
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
        starting_bid=Decimal("100.00"),
        bid_increment=Decimal("10.00"),
        buy_now_price=Decimal("500.00"),
        buy_now_enabled=buy_now_enabled,
        quantity_available=10,
        status=ItemStatus.PUBLISHED.value,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


@pytest.mark.asyncio
class TestBuyNowAvailabilityService:
    """Tests for BuyNowAvailabilityService."""

    async def test_update_availability_create_new(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test creating new buy-now availability."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = BuyNowAvailabilityService(db_session)
        availability = await service.update_availability(
            item_id=item.id,
            event_id=test_event.id,
            updated_by_user_id=test_user.id,
            enabled=True,
            remaining_quantity=5,
            override_reason="Special promotion",
        )

        assert availability.item_id == item.id
        assert availability.enabled is True
        assert availability.remaining_quantity == 5
        assert availability.override_reason == "Special promotion"

        # Check item fields updated
        await db_session.refresh(item)
        assert item.buy_now_enabled is True
        assert item.quantity_available == 5

    async def test_update_availability_update_existing(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test updating existing buy-now availability."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = BuyNowAvailabilityService(db_session)

        # Create initial availability
        await service.update_availability(
            item.id, test_event.id, test_user.id, enabled=True, remaining_quantity=10
        )

        # Update availability
        updated = await service.update_availability(
            item.id,
            test_event.id,
            test_user.id,
            enabled=True,
            remaining_quantity=3,
            override_reason="Low stock",
        )

        assert updated.remaining_quantity == 3
        assert updated.override_reason == "Low stock"

    async def test_update_availability_negative_quantity(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test that negative quantity raises error."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = BuyNowAvailabilityService(db_session)

        with pytest.raises(ValueError, match="cannot be negative"):
            await service.update_availability(
                item.id, test_event.id, test_user.id, enabled=True, remaining_quantity=-1
            )

    async def test_update_availability_item_not_found(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test updating availability for non-existent item."""
        service = BuyNowAvailabilityService(db_session)

        with pytest.raises(ValueError, match="not found"):
            await service.update_availability(
                item_id=uuid.uuid4(),
                event_id=test_event.id,
                updated_by_user_id=test_user.id,
                enabled=True,
                remaining_quantity=5,
            )

    async def test_get_availability(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test getting buy-now availability."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = BuyNowAvailabilityService(db_session)

        # No availability initially
        availability = await service.get_availability(item.id)
        assert availability is None

        # Create availability
        await service.update_availability(
            item.id, test_event.id, test_user.id, enabled=True, remaining_quantity=5
        )

        # Get availability
        availability = await service.get_availability(item.id)
        assert availability is not None
        assert availability.enabled is True
        assert availability.remaining_quantity == 5

    async def test_decrement_quantity_success(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test successfully decrementing quantity."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = BuyNowAvailabilityService(db_session)

        # Create availability with quantity 5
        await service.update_availability(
            item.id, test_event.id, test_user.id, enabled=True, remaining_quantity=5
        )

        # Decrement by 1
        result = await service.decrement_quantity(item.id, 1)
        assert result is True

        # Check quantity decreased
        availability = await service.get_availability(item.id)
        assert availability.remaining_quantity == 4

        # Check item quantity updated
        await db_session.refresh(item)
        assert item.quantity_available == 4

    async def test_decrement_quantity_to_zero_disables(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test that decrementing to zero disables buy-now."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = BuyNowAvailabilityService(db_session)

        # Create availability with quantity 1
        await service.update_availability(
            item.id, test_event.id, test_user.id, enabled=True, remaining_quantity=1
        )

        # Decrement by 1 (to zero)
        result = await service.decrement_quantity(item.id, 1)
        assert result is True

        # Check buy-now disabled
        availability = await service.get_availability(item.id)
        assert availability.remaining_quantity == 0
        assert availability.enabled is False

        await db_session.refresh(item)
        assert item.buy_now_enabled is False

    async def test_decrement_quantity_insufficient(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test that insufficient quantity returns False."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = BuyNowAvailabilityService(db_session)

        # Create availability with quantity 2
        await service.update_availability(
            item.id, test_event.id, test_user.id, enabled=True, remaining_quantity=2
        )

        # Try to decrement by 5 (more than available)
        result = await service.decrement_quantity(item.id, 5)
        assert result is False

        # Quantity should be unchanged
        availability = await service.get_availability(item.id)
        assert availability.remaining_quantity == 2

    async def test_decrement_quantity_not_found(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_event: Event,
    ):
        """Test decrementing quantity for non-existent availability."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        service = BuyNowAvailabilityService(db_session)

        with pytest.raises(ValueError, match="not found"):
            await service.decrement_quantity(item.id, 1)
