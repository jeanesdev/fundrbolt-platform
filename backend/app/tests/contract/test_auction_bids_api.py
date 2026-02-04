"""Contract tests for auction bids API endpoints."""

from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.registration_guest import RegistrationGuest


async def _assign_bidder_number(
    db_session: AsyncSession,
    registration_id,
    user_id,
    bidder_number: int,
) -> RegistrationGuest:
    guest = RegistrationGuest(
        registration_id=registration_id,
        user_id=user_id,
        name="Bidder",
        bidder_number=bidder_number,
    )
    db_session.add(guest)
    await db_session.commit()
    await db_session.refresh(guest)
    return guest


async def _create_auction_item(
    npo_admin_client: AsyncClient,
    event_id,
    *,
    auction_type: str = "silent",
    starting_bid: float = 100.0,
    bid_increment: float = 10.0,
    buy_now_enabled: bool = False,
    buy_now_price: float | None = None,
) -> dict[str, Any]:
    payload = {
        "title": "Auction Item",
        "description": "Test description",
        "auction_type": auction_type,
        "starting_bid": starting_bid,
        "bid_increment": bid_increment,
        "buy_now_enabled": buy_now_enabled,
        "quantity_available": 1,
    }
    if buy_now_price is not None:
        payload["buy_now_price"] = buy_now_price

    response = await npo_admin_client.post(
        f"/api/v1/events/{event_id}/auction-items",
        json=payload,
    )
    assert response.status_code == 201, response.json()
    return response.json()


@pytest.mark.asyncio
class TestAuctionBidPlacement:
    """Contract tests for placing bids."""

    async def test_place_bid_success(
        self,
        donor_client: AsyncClient,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        test_donor_user: Any,
        db_session: AsyncSession,
    ) -> None:
        item = await _create_auction_item(npo_admin_client, test_event.id)
        await _assign_bidder_number(
            db_session,
            registration_id=test_registration.id,
            user_id=test_donor_user.id,
            bidder_number=321,
        )

        payload = {
            "event_id": str(test_event.id),
            "auction_item_id": item["id"],
            "bid_amount": 100.0,
            "bid_type": "regular",
        }

        response = await donor_client.post("/api/v1/auction/bids", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["event_id"] == str(test_event.id)
        assert data["auction_item_id"] == item["id"]
        assert data["bid_status"] == "active"
        assert float(data["bid_amount"]) == 100.0

    async def test_item_bid_history_returns_results(
        self,
        donor_client: AsyncClient,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        test_donor_user: Any,
        db_session: AsyncSession,
    ) -> None:
        item = await _create_auction_item(npo_admin_client, test_event.id)
        await _assign_bidder_number(
            db_session,
            registration_id=test_registration.id,
            user_id=test_donor_user.id,
            bidder_number=654,
        )

        bid_payload = {
            "event_id": str(test_event.id),
            "auction_item_id": item["id"],
            "bid_amount": 100.0,
            "bid_type": "regular",
        }
        place_response = await donor_client.post("/api/v1/auction/bids", json=bid_payload)
        assert place_response.status_code == 201

        response = await donor_client.get(f"/api/v1/auction/items/{item['id']}/bids")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["auction_item_id"] == item["id"]

    async def test_mark_winning_bid(
        self,
        donor_client: AsyncClient,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        test_donor_user: Any,
        db_session: AsyncSession,
    ) -> None:
        item = await _create_auction_item(
            npo_admin_client,
            test_event.id,
            buy_now_enabled=True,
            buy_now_price=200.0,
        )
        await _assign_bidder_number(
            db_session,
            registration_id=test_registration.id,
            user_id=test_donor_user.id,
            bidder_number=777,
        )

        bid_payload = {
            "event_id": str(test_event.id),
            "auction_item_id": item["id"],
            "bid_amount": 200.0,
            "bid_type": "buy_now",
        }
        bid_response = await donor_client.post("/api/v1/auction/bids", json=bid_payload)
        assert bid_response.status_code == 201
        bid = bid_response.json()

        response = await npo_admin_client.post(
            f"/api/v1/auction/bids/{bid['id']}/mark-winning",
            json={"reason": "Confirmed winner"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["bid_status"] == "winning"
        assert Decimal(data["bid_amount"]) == Decimal("200.00")
