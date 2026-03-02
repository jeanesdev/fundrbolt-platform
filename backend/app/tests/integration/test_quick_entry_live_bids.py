"""Integration tests for quick-entry live bid persistence behavior."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quick_entry_bid import QuickEntryBid

pytestmark = pytest.mark.asyncio


async def _count_event_quick_entry_bids(db_session: AsyncSession, event_id: Any) -> int:
    stmt = select(func.count(QuickEntryBid.id)).where(QuickEntryBid.event_id == event_id)
    result = await db_session.execute(stmt)
    return int(result.scalar_one())


async def _create_live_item(npo_admin_client: AsyncClient, event_id: Any) -> str:
    response = await npo_admin_client.post(
        f"/api/v1/events/{event_id}/auction-items",
        json={
            "title": "Integration Live Item",
            "description": "Live item for quick-entry integration tests",
            "auction_type": "live",
            "starting_bid": 100.0,
            "buy_now_enabled": False,
            "quantity_available": 1,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


class TestQuickEntryLiveBidIntegration:
    """Integration coverage for quick-entry unmatched bidder handling."""

    async def test_unmatched_bidder_accepted_without_donor_link(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Unmatched bidder number is accepted; bid is created with donor_user_id=None."""
        item_id = await _create_live_item(npo_admin_client, test_event.id)
        initial_count = await _count_event_quick_entry_bids(db_session, test_event.id)

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/live-auction/bids",
            json={"item_id": item_id, "amount": 250, "bidder_number": 9999},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["bidder_number"] == 9999
        assert data["donor_name"] is None  # no registration match

        final_count = await _count_event_quick_entry_bids(db_session, test_event.id)
        assert final_count == initial_count + 1
