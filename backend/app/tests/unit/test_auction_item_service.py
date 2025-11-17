"""Unit tests for AuctionItemService."""

from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.event import Event, EventStatus
from app.models.npo import NPO, NPOStatus
from app.schemas.auction_item import AuctionItemCreate, AuctionItemUpdate
from app.services.auction_item_service import AuctionItemService


@pytest.fixture
async def test_npo(db_session: AsyncSession, test_user):
    """Create a test NPO."""
    npo = NPO(
        name="Test NPO",
        mission_statement="Test mission",
        status=NPOStatus.APPROVED,
        phone="555-1234",
        email="test@testnpo.com",
        created_by_user_id=test_user.id,
    )
    db_session.add(npo)
    await db_session.commit()
    await db_session.refresh(npo)
    return npo


@pytest.fixture
async def test_event(db_session: AsyncSession, test_npo: NPO, test_user):
    """Create a test event."""
    from datetime import datetime, timedelta

    import pytz

    event = Event(
        npo_id=test_npo.id,
        name="Test Auction Event",
        slug="test-auction-event",
        event_datetime=datetime.now(pytz.UTC) + timedelta(days=30),
        timezone="America/New_York",
        status=EventStatus.DRAFT,
        version=1,
        created_by=test_user.id,
        updated_by=test_user.id,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


@pytest.fixture
async def auction_item_service(db_session: AsyncSession):
    """Create an AuctionItemService instance."""
    return AuctionItemService(db_session)


@pytest.mark.asyncio
class TestBidNumberAssignment:
    """Test T027: Sequential bid number assignment (100-999)."""

    async def test_first_bid_number_is_100(
        self,
        db_session: AsyncSession,
        test_event: Event,
        test_user,
        auction_item_service: AuctionItemService,
    ):
        """Test that the first auction item gets bid number 100."""
        item_data = AuctionItemCreate(
            title="Test Item",
            description="Test description",
            auction_type=AuctionType.SILENT,
            starting_bid=Decimal("10.00"),
            donor_value=Decimal("20.00"),
            cost=Decimal("0.00"),
            buy_now_price=None,
            donated_by="Test Donor",
            item_webpage=None,
        )

        item = await auction_item_service.create_auction_item(
            event_id=test_event.id,
            item_data=item_data,
            created_by=test_user.id,
        )

        assert item.bid_number == 100

    async def test_sequential_bid_numbers(
        self,
        db_session: AsyncSession,
        test_event: Event,
        test_user,
        auction_item_service: AuctionItemService,
    ):
        """Test that bid numbers increment sequentially (100, 101, 102...)."""
        user_id = test_user.id

        # Create 5 items
        for i in range(5):
            item_data = AuctionItemCreate(
                title=f"Test Item {i}",
                description="Test description",
                auction_type=AuctionType.SILENT,
                starting_bid=Decimal("10.00"),
                donor_value=Decimal("20.00"),
                cost=Decimal("0.00"),
                buy_now_price=None,
                donated_by="Test Donor",
                item_webpage=None,
            )

            item = await auction_item_service.create_auction_item(
                event_id=test_event.id,
                item_data=item_data,
                created_by=user_id,
            )

            assert item.bid_number == 100 + i

    async def test_bid_number_sequence_per_event(
        self,
        db_session: AsyncSession,
        test_npo: NPO,
        test_user,
        auction_item_service: AuctionItemService,
    ):
        """Test that each event has its own bid number sequence."""
        from datetime import datetime, timedelta

        import pytz

        # Create two events
        event1 = Event(
            npo_id=test_npo.id,
            name="Event 1",
            slug="event-1",
            event_datetime=datetime.now(pytz.UTC) + timedelta(days=30),
            timezone="America/New_York",
            status=EventStatus.DRAFT,
            version=1,
            created_by=test_user.id,
            updated_by=test_user.id,
        )
        event2 = Event(
            npo_id=test_npo.id,
            name="Event 2",
            slug="event-2",
            event_datetime=datetime.now(pytz.UTC) + timedelta(days=60),
            timezone="America/New_York",
            status=EventStatus.DRAFT,
            version=1,
            created_by=test_user.id,
            updated_by=test_user.id,
        )
        db_session.add_all([event1, event2])
        await db_session.commit()
        await db_session.refresh(event1)
        await db_session.refresh(event2)

        user_id = test_user.id
        item_data = AuctionItemCreate(
            title="Test Item",
            description="Test description",
            auction_type=AuctionType.SILENT,
            starting_bid=Decimal("10.00"),
            donor_value=Decimal("20.00"),
            cost=Decimal("0.00"),
            buy_now_price=None,
            donated_by="Test Donor",
            item_webpage=None,
        )

        # Create item in event1
        item1 = await auction_item_service.create_auction_item(
            event_id=event1.id,
            item_data=item_data,
            created_by=user_id,
        )

        # Create item in event2
        item2 = await auction_item_service.create_auction_item(
            event_id=event2.id,
            item_data=item_data,
            created_by=user_id,
        )

        # Both should start at 100 (separate sequences)
        assert item1.bid_number == 100
        assert item2.bid_number == 100

    async def test_bid_number_max_999(
        self,
        db_session: AsyncSession,
        test_event: Event,
        test_user,
        auction_item_service: AuctionItemService,
    ):
        """Test that bid numbers cannot exceed 999."""
        # Set sequence to 999
        sequence_name = f"event_{str(test_event.id).replace('-', '_')}_bid_number_seq"
        await auction_item_service._ensure_bid_number_sequence(test_event.id)
        await db_session.execute(text(f"SELECT setval('{sequence_name}', 999)"))
        await db_session.commit()

        # Try to create an item
        item_data = AuctionItemCreate(
            title="Test Item",
            description="Test description",
            auction_type=AuctionType.SILENT,
            starting_bid=Decimal("10.00"),
            donor_value=Decimal("20.00"),
            cost=Decimal("0.00"),
            buy_now_price=None,
            donated_by="Test Donor",
            item_webpage=None,
        )

        with pytest.raises(ValueError, match="maximum"):
            await auction_item_service.create_auction_item(
                event_id=test_event.id,
                item_data=item_data,
                created_by=test_user.id,
            )


@pytest.mark.asyncio
class TestBuyNowPriceValidation:
    """Test T028: Buy-now price validation logic."""

    async def test_buy_now_price_must_be_gte_starting_bid(
        self,
        db_session: AsyncSession,
        test_event: Event,
        test_user,
        auction_item_service: AuctionItemService,
    ):
        """Test that buy_now_price must be >= starting_bid."""
        item_data = AuctionItemCreate(
            title="Test Item",
            description="Test description",
            auction_type=AuctionType.SILENT,
            starting_bid=Decimal("100.00"),
            buy_now_price=Decimal("50.00"),  # Less than starting_bid
            buy_now_enabled=True,
            donor_value=Decimal("150.00"),
            cost=Decimal("0.00"),
            donated_by="Test Donor",
            item_webpage=None,
        )

        with pytest.raises(ValueError, match="Buy now price.*must be >= starting bid"):
            await auction_item_service.create_auction_item(
                event_id=test_event.id,
                item_data=item_data,
                created_by=test_user.id,
            )

    async def test_buy_now_price_equal_to_starting_bid(
        self,
        db_session: AsyncSession,
        test_event: Event,
        test_user,
        auction_item_service: AuctionItemService,
    ):
        """Test that buy_now_price can equal starting_bid."""
        item_data = AuctionItemCreate(
            title="Test Item",
            description="Test description",
            auction_type=AuctionType.SILENT,
            starting_bid=Decimal("100.00"),
            buy_now_price=Decimal("100.00"),  # Equal
            buy_now_enabled=True,
            donor_value=Decimal("150.00"),
            cost=Decimal("0.00"),
            donated_by="Test Donor",
            item_webpage=None,
        )

        item = await auction_item_service.create_auction_item(
            event_id=test_event.id,
            item_data=item_data,
            created_by=test_user.id,
        )

        assert item.buy_now_price == Decimal("100.00")

    async def test_buy_now_enabled_requires_price(
        self,
        db_session: AsyncSession,
        test_event: Event,
        test_user,
        auction_item_service: AuctionItemService,
    ):
        """Test that buy_now_enabled=True requires buy_now_price (enforced by DB constraint)."""
        item_data = AuctionItemCreate(
            title="Test Item",
            description="Test description",
            auction_type=AuctionType.SILENT,
            starting_bid=Decimal("100.00"),
            buy_now_enabled=True,
            buy_now_price=None,  # Missing price - violates DB constraint
            donor_value=Decimal("150.00"),
            cost=Decimal("0.00"),
            donated_by="Test Donor",
            item_webpage=None,
        )

        # Database constraint enforces buy_now_enabled=true requires buy_now_price IS NOT NULL
        with pytest.raises(ValueError, match="Failed to create auction item"):
            await auction_item_service.create_auction_item(
                event_id=test_event.id,
                item_data=item_data,
                created_by=test_user.id,
            )

    async def test_update_buy_now_price_validation(
        self,
        db_session: AsyncSession,
        test_event: Event,
        test_user,
        auction_item_service: AuctionItemService,
    ):
        """Test validation when updating buy_now_price."""
        # Create item
        item_data = AuctionItemCreate(
            title="Test Item",
            description="Test description",
            auction_type=AuctionType.SILENT,
            starting_bid=Decimal("100.00"),
            donor_value=Decimal("150.00"),
            cost=Decimal("0.00"),
            buy_now_price=None,
            donated_by="Test Donor",
            item_webpage=None,
        )

        item = await auction_item_service.create_auction_item(
            event_id=test_event.id,
            item_data=item_data,
            created_by=test_user.id,
        )

        # Try to update with invalid buy_now_price
        update_data = AuctionItemUpdate(  # type: ignore[call-arg]
            buy_now_price=Decimal("50.00"),  # Less than starting_bid
        )

        with pytest.raises(ValueError, match="Buy now price must be >= starting bid"):
            await auction_item_service.update_auction_item(
                item_id=item.id,
                update_data=update_data,
            )


@pytest.mark.asyncio
class TestSoftVsHardDelete:
    """Test T029: Soft delete for published items, hard delete for drafts."""

    async def test_draft_item_hard_deleted(
        self,
        db_session: AsyncSession,
        test_event: Event,
        test_user,
        auction_item_service: AuctionItemService,
    ):
        """Test that draft items are hard deleted (removed from DB)."""
        item_data = AuctionItemCreate(
            title="Draft Item",
            description="Test description",
            auction_type=AuctionType.SILENT,
            starting_bid=Decimal("10.00"),
            donor_value=Decimal("20.00"),
            cost=Decimal("0.00"),
            buy_now_price=None,
            donated_by="Test Donor",
            item_webpage=None,
        )

        item = await auction_item_service.create_auction_item(
            event_id=test_event.id,
            item_data=item_data,
            created_by=test_user.id,
        )

        assert item.status == ItemStatus.DRAFT

        # Delete the item
        await auction_item_service.delete_auction_item(item_id=item.id)

        # Verify item is gone from DB
        deleted_item = await auction_item_service.get_auction_item_by_id(item.id)
        assert deleted_item is None

    async def test_published_item_soft_deleted(
        self,
        db_session: AsyncSession,
        test_event: Event,
        test_user,
        auction_item_service: AuctionItemService,
    ):
        """Test that published items are soft deleted (deleted_at set)."""
        item_data = AuctionItemCreate(
            title="Published Item",
            description="Test description",
            auction_type=AuctionType.SILENT,
            starting_bid=Decimal("10.00"),
            donor_value=Decimal("20.00"),
            cost=Decimal("0.00"),
            buy_now_price=None,
            donated_by="Test Donor",
            item_webpage=None,
        )

        item = await auction_item_service.create_auction_item(
            event_id=test_event.id,
            item_data=item_data,
            created_by=test_user.id,
        )

        # Manually set status to PUBLISHED
        item.status = ItemStatus.PUBLISHED
        await db_session.commit()

        # Delete the item
        await auction_item_service.delete_auction_item(item_id=item.id)

        # Verify item still exists but is soft deleted
        # Need to query directly since get_auction_item_by_id filters deleted items
        from sqlalchemy import select

        result = await db_session.execute(select(AuctionItem).where(AuctionItem.id == item.id))
        deleted_item = result.scalar_one_or_none()

        assert deleted_item is not None
        assert deleted_item.deleted_at is not None
        assert deleted_item.status == ItemStatus.WITHDRAWN

    async def test_sold_item_soft_deleted(
        self,
        db_session: AsyncSession,
        test_event: Event,
        test_user,
        auction_item_service: AuctionItemService,
    ):
        """Test that sold items are soft deleted."""
        item_data = AuctionItemCreate(
            title="Sold Item",
            description="Test description",
            auction_type=AuctionType.SILENT,
            starting_bid=Decimal("10.00"),
            donor_value=Decimal("20.00"),
            cost=Decimal("0.00"),
            buy_now_price=None,
            donated_by="Test Donor",
            item_webpage=None,
        )

        item = await auction_item_service.create_auction_item(
            event_id=test_event.id,
            item_data=item_data,
            created_by=test_user.id,
        )

        # Manually set status to SOLD
        item.status = ItemStatus.SOLD
        await db_session.commit()

        # Delete the item
        await auction_item_service.delete_auction_item(item_id=item.id)

        # Verify soft delete
        from sqlalchemy import select

        result = await db_session.execute(select(AuctionItem).where(AuctionItem.id == item.id))
        deleted_item = result.scalar_one_or_none()

        assert deleted_item is not None
        assert deleted_item.deleted_at is not None
        assert deleted_item.status == ItemStatus.WITHDRAWN

    async def test_force_hard_delete(
        self,
        db_session: AsyncSession,
        test_event: Event,
        test_user,
        auction_item_service: AuctionItemService,
    ):
        """Test force hard delete even for published items."""
        item_data = AuctionItemCreate(
            title="Published Item",
            description="Test description",
            auction_type=AuctionType.SILENT,
            starting_bid=Decimal("10.00"),
            donor_value=Decimal("20.00"),
            cost=Decimal("0.00"),
            buy_now_price=None,
            donated_by="Test Donor",
            item_webpage=None,
        )

        item = await auction_item_service.create_auction_item(
            event_id=test_event.id,
            item_data=item_data,
            created_by=test_user.id,
        )

        # Set to published
        item.status = ItemStatus.PUBLISHED
        await db_session.commit()

        # Force hard delete
        await auction_item_service.delete_auction_item(
            item_id=item.id,
            force_hard_delete=True,
        )

        # Verify item is completely gone
        from sqlalchemy import select

        result = await db_session.execute(select(AuctionItem).where(AuctionItem.id == item.id))
        deleted_item = result.scalar_one_or_none()

        assert deleted_item is None
