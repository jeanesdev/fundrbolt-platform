"""Contract tests for admin quick-entry live bid endpoint."""

from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.registration_guest import RegistrationGuest

pytestmark = pytest.mark.asyncio


async def _assign_bidder_number(
    db_session: AsyncSession,
    registration_id: Any,
    user_id: Any,
    bidder_number: int,
) -> RegistrationGuest:
    stmt = select(RegistrationGuest).where(
        RegistrationGuest.registration_id == registration_id,
        RegistrationGuest.is_primary.is_(True),
    )
    guest = (await db_session.execute(stmt)).scalar_one_or_none()

    if guest is None:
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


async def _create_live_item(npo_admin_client: AsyncClient, event_id: Any) -> str:
    response = await npo_admin_client.post(
        f"/api/v1/events/{event_id}/auction-items",
        json={
            "title": "Live Item",
            "description": "Live item for quick-entry tests",
            "auction_type": "live",
            "starting_bid": 100.0,
            "buy_now_enabled": False,
            "quantity_available": 1,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


class TestAdminQuickEntryLiveBidContract:
    """Contract tests for quick-entry live bid create endpoint."""

    async def test_create_live_bid_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        test_donor_user: Any,
        db_session: AsyncSession,
    ) -> None:
        """Creates a quick-entry live bid with matched bidder number."""
        item_id = await _create_live_item(npo_admin_client, test_event.id)
        await _assign_bidder_number(
            db_session,
            registration_id=test_registration.id,
            user_id=test_donor_user.id,
            bidder_number=321,
        )

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/live-auction/bids",
            json={"item_id": item_id, "amount": 500, "bidder_number": 321},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["event_id"] == str(test_event.id)
        assert data["item_id"] == item_id
        assert data["amount"] == 500
        assert data["bidder_number"] == 321
        assert data["donor_name"] == "Donor Person"
        assert data["table_number"] is None
        assert "id" in data
        assert "accepted_at" in data

    async def test_create_live_bid_returns_404_for_missing_item(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        test_donor_user: Any,
        db_session: AsyncSession,
    ) -> None:
        """Returns not found when item does not exist for event."""
        await _assign_bidder_number(
            db_session,
            registration_id=test_registration.id,
            user_id=test_donor_user.id,
            bidder_number=322,
        )

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/live-auction/bids",
            json={"item_id": str(uuid4()), "amount": 500, "bidder_number": 322},
        )

        assert response.status_code == 404
        assert response.json()["detail"]["code"] == 404
        assert response.json()["detail"]["message"] == "Live auction item not found"

    async def test_create_live_bid_rejects_unauthorized_role(
        self,
        donor_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Returns forbidden for users outside quick-entry allowed roles."""
        response = await donor_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/live-auction/bids",
            json={"item_id": str(uuid4()), "amount": 100, "bidder_number": 1},
        )

        assert response.status_code == 403
        assert response.json()["detail"]["code"] == 403
        assert response.json()["detail"]["message"] == "Forbidden"

    async def test_create_live_bid_requires_positive_amount(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Enforces request schema amount lower bound."""
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/live-auction/bids",
            json={"item_id": str(uuid4()), "amount": 0, "bidder_number": 99},
        )

        assert response.status_code == 422
