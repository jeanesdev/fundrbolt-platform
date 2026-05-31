"""Integration tests for auction browsing and bidding flows."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event, EventStatus
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest

pytestmark = pytest.mark.asyncio


async def test_watchlist_and_bid_validation_flow(
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
        name="Auction Bidding Flow",
        slug="auction-bidding-flow",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=10),
        timezone="America/New_York",
        venue_name="FundrBolt Hall",
        version=1,
        created_by=test_npo_admin_user.id,
        updated_by=test_npo_admin_user.id,
    )
    db_session.add(event)
    await db_session.flush()
    registration = EventRegistration(
        event_id=event.id, user_id=test_donor_user.id, number_of_guests=1
    )
    db_session.add(registration)
    await db_session.flush()
    db_session.add(
        RegistrationGuest(
            registration_id=registration.id,
            user_id=test_donor_user.id,
            name=test_donor_user.full_name,
            email=test_donor_user.email,
            is_primary=True,
            bidder_number=777,
        )
    )
    await db_session.commit()

    admin_headers = {"Authorization": f"Bearer {test_npo_admin_token}"}
    donor_headers = {"Authorization": f"Bearer {test_donor_token}"}
    create_item_response = await async_client.post(
        f"/api/v1/events/{event.id}/auction-items",
        json={
            "title": "Signed Guitar",
            "description": "Music collectible",
            "auction_type": "silent",
            "starting_bid": 100,
            "bid_increment": 10,
            "quantity_available": 1,
        },
        headers=admin_headers,
    )
    assert create_item_response.status_code == 201
    item_id = create_item_response.json()["id"]

    watchlist_response = await async_client.post(
        "/api/v1/watchlist",
        json={"item_id": item_id},
        headers=donor_headers,
    )
    assert watchlist_response.status_code == 201

    low_bid_response = await async_client.post(
        "/api/v1/auction/bids",
        json={
            "event_id": str(event.id),
            "auction_item_id": item_id,
            "bid_amount": 90,
            "bid_type": "regular",
        },
        headers=donor_headers,
    )
    assert low_bid_response.status_code == 422

    valid_bid_response = await async_client.post(
        "/api/v1/auction/bids",
        json={
            "event_id": str(event.id),
            "auction_item_id": item_id,
            "bid_amount": 100,
            "bid_type": "regular",
        },
        headers=donor_headers,
    )
    assert valid_bid_response.status_code == 201

    list_response = await async_client.get(
        f"/api/v1/events/{event.id}/auction-items?auction_type=silent",
        headers=donor_headers,
    )
    assert list_response.status_code == 200
