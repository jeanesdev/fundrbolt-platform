"""Unit tests for AuctionBidService."""

from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_bid import BidStatus, BidType
from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.registration_guest import RegistrationGuest
from app.services.auction_bid_service import AuctionBidService


async def _create_auction_item(
    db_session: AsyncSession,
    event_id,
    created_by,
    *,
    auction_type: AuctionType = AuctionType.SILENT,
    starting_bid: Decimal = Decimal("100.00"),
    bid_increment: Decimal = Decimal("10.00"),
    buy_now_enabled: bool = False,
    buy_now_price: Decimal | None = None,
) -> AuctionItem:
    item = AuctionItem(
        event_id=event_id,
        created_by=created_by,
        bid_number=100,
        title="Test Item",
        description="Test description",
        auction_type=auction_type.value,
        starting_bid=starting_bid,
        bid_increment=bid_increment,
        donor_value=Decimal("0.00"),
        cost=Decimal("0.00"),
        buy_now_enabled=buy_now_enabled,
        buy_now_price=buy_now_price,
        quantity_available=1,
        donated_by="Test Donor",
        item_webpage=None,
        status=ItemStatus.PUBLISHED.value,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


async def _create_registration_for_user(
    db_session: AsyncSession,
    event_id,
    user_id,
) -> EventRegistration:
    registration = EventRegistration(
        event_id=event_id,
        user_id=user_id,
        status=RegistrationStatus.CONFIRMED,
        number_of_guests=1,
    )
    db_session.add(registration)
    await db_session.commit()
    await db_session.refresh(registration)
    return registration


async def _create_bidder_number(
    db_session: AsyncSession,
    registration_id,
    user_id,
    bidder_number: int,
) -> RegistrationGuest:
    stmt = select(RegistrationGuest).where(
        RegistrationGuest.registration_id == registration_id,
        RegistrationGuest.is_primary.is_(True),
    )
    guest = (await db_session.execute(stmt)).scalar_one_or_none()

    if not guest:
        guest = RegistrationGuest(
            registration_id=registration_id,
            user_id=user_id,
            name="Bidder",
            bidder_number=bidder_number,
            is_primary=True,
        )
        db_session.add(guest)
    else:
        guest.bidder_number = bidder_number

    await db_session.commit()
    await db_session.refresh(guest)
    return guest


@pytest.mark.asyncio
class TestAuctionBidService:
    """Unit tests for AuctionBidService bid placement."""

    async def test_place_bid_requires_bidder_number(
        self,
        db_session: AsyncSession,
        test_event,
        test_donor_user,
    ) -> None:
        service = AuctionBidService(db_session)
        item = await _create_auction_item(
            db_session,
            event_id=test_event.id,
            created_by=test_donor_user.id,
        )

        with pytest.raises(ValueError, match="Bidder number not found"):
            await service.place_bid(
                user_id=test_donor_user.id,
                event_id=test_event.id,
                auction_item_id=item.id,
                bid_amount=Decimal("100.00"),
                bid_type=BidType.REGULAR,
            )

    async def test_place_bid_validates_minimum_bid(
        self,
        db_session: AsyncSession,
        test_event,
        test_donor_user,
        test_registration,
    ) -> None:
        service = AuctionBidService(db_session)
        item = await _create_auction_item(
            db_session,
            event_id=test_event.id,
            created_by=test_donor_user.id,
            auction_type=AuctionType.LIVE,
            starting_bid=Decimal("100.00"),
            bid_increment=Decimal("10.00"),
        )
        await _create_bidder_number(
            db_session,
            registration_id=test_registration.id,
            user_id=test_donor_user.id,
            bidder_number=123,
        )

        with pytest.raises(ValueError, match="minimum required bid"):
            await service.place_bid(
                user_id=test_donor_user.id,
                event_id=test_event.id,
                auction_item_id=item.id,
                bid_amount=Decimal("50.00"),
                bid_type=BidType.REGULAR,
            )

    async def test_buy_now_bid_sets_winning_status(
        self,
        db_session: AsyncSession,
        test_event,
        test_donor_user,
        test_registration,
    ) -> None:
        service = AuctionBidService(db_session)
        item = await _create_auction_item(
            db_session,
            event_id=test_event.id,
            created_by=test_donor_user.id,
            buy_now_enabled=True,
            buy_now_price=Decimal("200.00"),
        )
        await _create_bidder_number(
            db_session,
            registration_id=test_registration.id,
            user_id=test_donor_user.id,
            bidder_number=456,
        )

        bid = await service.place_bid(
            user_id=test_donor_user.id,
            event_id=test_event.id,
            auction_item_id=item.id,
            bid_amount=Decimal("200.00"),
            bid_type=BidType.BUY_NOW,
        )

        assert bid.bid_status == BidStatus.WINNING.value
        assert bid.bid_type == BidType.BUY_NOW.value

    async def test_proxy_auto_bidding_outbids_previous(
        self, db_session: AsyncSession, test_event, test_donor_user, test_user_2
    ) -> None:
        service = AuctionBidService(db_session)
        item = await _create_auction_item(
            db_session,
            event_id=test_event.id,
            created_by=test_donor_user.id,
            auction_type=AuctionType.SILENT,
            starting_bid=Decimal("100.00"),
            bid_increment=Decimal("10.00"),
        )

        registration_one = await _create_registration_for_user(
            db_session,
            event_id=test_event.id,
            user_id=test_donor_user.id,
        )
        registration_two = await _create_registration_for_user(
            db_session,
            event_id=test_event.id,
            user_id=test_user_2.id,
        )

        await _create_bidder_number(
            db_session,
            registration_id=registration_one.id,
            user_id=test_donor_user.id,
            bidder_number=111,
        )
        await _create_bidder_number(
            db_session,
            registration_id=registration_two.id,
            user_id=test_user_2.id,
            bidder_number=222,
        )

        await service.place_bid(
            user_id=test_donor_user.id,
            event_id=test_event.id,
            auction_item_id=item.id,
            bid_amount=Decimal("100.00"),
            bid_type=BidType.PROXY_AUTO,
            max_bid=Decimal("130.00"),
        )

        await service.place_bid(
            user_id=test_user_2.id,
            event_id=test_event.id,
            auction_item_id=item.id,
            bid_amount=Decimal("110.00"),
            bid_type=BidType.PROXY_AUTO,
            max_bid=Decimal("160.00"),
        )

        current_high = await service._current_high_bid(item.id)
        assert current_high is not None
        assert current_high.user_id == test_user_2.id
        assert current_high.bid_amount == Decimal("110.00")
