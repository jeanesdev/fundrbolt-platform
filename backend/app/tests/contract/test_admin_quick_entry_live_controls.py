"""Contract tests for quick-entry live controls endpoints."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.registration_guest import RegistrationGuest

pytestmark = pytest.mark.asyncio


async def _assign_primary_bidder_number(
    db_session: AsyncSession,
    registration_id: Any,
    bidder_number: int,
) -> None:
    stmt = select(RegistrationGuest).where(
        RegistrationGuest.registration_id == registration_id,
        RegistrationGuest.is_primary.is_(True),
    )
    guest = (await db_session.execute(stmt)).scalar_one()
    guest.bidder_number = bidder_number
    await db_session.commit()


async def _create_secondary_bidder_number(
    db_session: AsyncSession,
    registration_id: Any,
    bidder_number: int,
) -> None:
    guest = RegistrationGuest(
        registration_id=registration_id,
        user_id=None,
        name=f"Bidder {bidder_number}",
        bidder_number=bidder_number,
        is_primary=False,
    )
    db_session.add(guest)
    await db_session.commit()


async def _create_live_item(npo_admin_client: AsyncClient, event_id: Any) -> str:
    response = await npo_admin_client.post(
        f"/api/v1/events/{event_id}/auction-items",
        json={
            "title": "Live Controls Item",
            "description": "Live controls contract test item",
            "auction_type": "live",
            "starting_bid": 100.0,
            "buy_now_enabled": False,
            "quantity_available": 1,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


async def _create_live_bid(
    npo_admin_client: AsyncClient,
    event_id: Any,
    item_id: str,
    amount: int,
    bidder_number: int,
) -> dict[str, Any]:
    response = await npo_admin_client.post(
        f"/api/v1/admin/events/{event_id}/quick-entry/live-auction/bids",
        json={"item_id": item_id, "amount": amount, "bidder_number": bidder_number},
    )
    assert response.status_code == 201
    return response.json()


class TestAdminQuickEntryLiveControlsContract:
    """Contract coverage for live summary, delete, and winner APIs."""

    async def test_live_summary_delete_and_winner_assignment(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        """Returns summary metrics, supports delete, and assigns highest valid winner."""
        item_id = await _create_live_item(npo_admin_client, test_event.id)
        await _assign_primary_bidder_number(db_session, test_registration.id, bidder_number=111)
        await _create_secondary_bidder_number(db_session, test_registration.id, bidder_number=222)

        first_bid = await _create_live_bid(
            npo_admin_client,
            event_id=test_event.id,
            item_id=item_id,
            amount=500,
            bidder_number=111,
        )
        second_bid = await _create_live_bid(
            npo_admin_client,
            event_id=test_event.id,
            item_id=item_id,
            amount=750,
            bidder_number=222,
        )

        summary_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/summary",
            params={"mode": "LIVE_AUCTION", "item_id": item_id},
        )
        assert summary_response.status_code == 200
        summary = summary_response.json()
        assert summary["mode"] == "LIVE_AUCTION"
        assert summary["item_id"] == item_id
        assert summary["current_highest_bid"] == 750
        assert summary["bid_count"] == 2
        assert summary["unique_bidder_count"] == 2
        assert len(summary["bids"]) == 2

        delete_response = await npo_admin_client.delete(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/live-auction/bids/{first_bid['id']}"
        )
        assert delete_response.status_code == 204

        post_delete_summary_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/summary",
            params={"mode": "LIVE_AUCTION", "item_id": item_id},
        )
        assert post_delete_summary_response.status_code == 200
        post_delete_summary = post_delete_summary_response.json()
        assert post_delete_summary["bid_count"] == 1
        assert post_delete_summary["current_highest_bid"] == 750
        assert post_delete_summary["bids"][0]["id"] == second_bid["id"]

        assign_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/live-auction/items/{item_id}/winner",
            json={"confirm": True},
        )
        assert assign_response.status_code == 200
        assigned = assign_response.json()
        assert assigned["item_id"] == item_id
        assert assigned["winner_bid_id"] == second_bid["id"]
        assert assigned["winning_amount"] == 750
        assert assigned["winner_bidder_number"] == 222

    async def test_assign_winner_returns_conflict_without_valid_bids(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Returns 409 when attempting winner assignment with no valid bids."""
        item_id = await _create_live_item(npo_admin_client, test_event.id)

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/live-auction/items/{item_id}/winner",
            json={"confirm": True},
        )
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == 409
        assert (
            response.json()["detail"]["message"] == "No valid bids available for winner assignment"
        )
