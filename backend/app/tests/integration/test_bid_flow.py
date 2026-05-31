"""Scenario-driven integration tests for bidding and watch lists."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_bid import AuctionBid
from app.models.event import Event, EventStatus
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest

pytestmark = pytest.mark.asyncio


async def test_bid_watchlist_and_winning_flow(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_approved_npo: Any,
    test_npo_admin_token: str,
    test_npo_admin_user: Any,
    test_donor_token: str,
    test_donor_user: Any,
) -> None:
    event = Event(
        npo_id=test_approved_npo.id,
        name="Bid Flow Gala",
        slug="bid-flow-gala",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=21),
        timezone="America/New_York",
        venue_name="FundrBolt Hall",
        version=1,
        created_by=test_npo_admin_user.id,
        updated_by=test_npo_admin_user.id,
    )
    db_session.add(event)
    await db_session.flush()

    registration = EventRegistration(
        event_id=event.id,
        user_id=test_donor_user.id,
        number_of_guests=1,
    )
    db_session.add(registration)
    await db_session.flush()
    db_session.add(
        RegistrationGuest(
            registration_id=registration.id,
            user_id=test_donor_user.id,
            name=f"{test_donor_user.first_name} {test_donor_user.last_name}",
            email=test_donor_user.email,
            is_primary=True,
            bidder_number=444,
        )
    )
    await db_session.commit()

    admin_headers = {"Authorization": f"Bearer {test_npo_admin_token}"}
    donor_headers = {"Authorization": f"Bearer {test_donor_token}"}

    create_item_response = await async_client.post(
        f"/api/v1/events/{event.id}/auction-items",
        json={
            "title": "Weekend Getaway",
            "description": "Two-night getaway package",
            "auction_type": "silent",
            "starting_bid": 100,
            "bid_increment": 10,
            "quantity_available": 1,
        },
        headers=admin_headers,
    )
    assert create_item_response.status_code == 201, create_item_response.json()
    item = create_item_response.json()

    add_watchlist_response = await async_client.post(
        "/api/v1/watchlist",
        json={"item_id": item["id"]},
        headers=donor_headers,
    )
    assert add_watchlist_response.status_code == 201

    watchlist_response = await async_client.get("/api/v1/watchlist", headers=donor_headers)
    assert watchlist_response.status_code == 200
    watchlist = watchlist_response.json()
    assert watchlist["total"] == 1
    assert watchlist["items"][0]["id"] == item["id"]

    bid_response = await async_client.post(
        "/api/v1/auction/bids",
        json={
            "event_id": str(event.id),
            "auction_item_id": item["id"],
            "bid_amount": 100,
            "bid_type": "regular",
        },
        headers=donor_headers,
    )
    assert bid_response.status_code == 201, bid_response.json()

    history_response = await async_client.get(
        f"/api/v1/auction/items/{item['id']}/bids",
        headers=donor_headers,
    )
    assert history_response.status_code == 200
    history = history_response.json()
    assert history["total"] == 1
    bid_id = history["items"][0]["id"]

    winning_response = await async_client.post(
        f"/api/v1/auction/bids/{bid_id}/mark-winning",
        json={"reason": "Integration flow"},
        headers=admin_headers,
    )
    assert winning_response.status_code == 200
    assert winning_response.json()["bid_status"] == "winning"

    bid_result = await db_session.execute(select(AuctionBid).where(AuctionBid.id == bid_id))
    bid = bid_result.scalar_one()
    assert bid.bid_amount == Decimal("100.00")

    remove_watchlist_response = await async_client.delete(
        f"/api/v1/watchlist/{item['id']}",
        headers=donor_headers,
    )
    assert remove_watchlist_response.status_code == 204

    empty_watchlist_response = await async_client.get("/api/v1/watchlist", headers=donor_headers)
    assert empty_watchlist_response.status_code == 200
    assert empty_watchlist_response.json()["total"] == 0
