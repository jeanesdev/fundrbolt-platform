"""Integration tests for quick-entry paddle raise behavior."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quick_entry_donation import QuickEntryDonation
from app.models.registration_guest import RegistrationGuest

pytestmark = pytest.mark.asyncio


async def _assign_bidder_number(
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


async def _count_event_paddle_donations(db_session: AsyncSession, event_id: Any) -> int:
    stmt = select(func.count(QuickEntryDonation.id)).where(QuickEntryDonation.event_id == event_id)
    result = await db_session.execute(stmt)
    return int(result.scalar_one())


class TestQuickEntryPaddleRaiseIntegration:
    """Integration coverage for paddle raise quick-entry."""

    async def test_unmatched_bidder_accepted_without_donor_association(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Unmatched bidder number is accepted; donation is created with no donor link."""
        initial_count = await _count_event_paddle_donations(db_session, test_event.id)

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/paddle-raise/donations",
            json={"amount": 300, "bidder_number": 9999, "label_ids": []},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["bidder_number"] == 9999
        assert data["donor_name"] is None

        final_count = await _count_event_paddle_donations(db_session, test_event.id)
        assert final_count == initial_count + 1

    async def test_optional_labels_allow_successful_create(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        """Allows donation create with no predefined/custom labels selected."""
        await _assign_bidder_number(db_session, test_registration.id, bidder_number=451)

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/paddle-raise/donations",
            json={"amount": 700, "bidder_number": 451, "label_ids": []},
        )
        assert response.status_code == 201
        assert response.json()["labels"] == []
