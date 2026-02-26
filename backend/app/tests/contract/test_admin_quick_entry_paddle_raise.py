"""Contract tests for quick-entry paddle raise endpoints."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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


class TestAdminQuickEntryPaddleRaiseContract:
    """Contract tests for paddle-raise quick-entry endpoints."""

    async def test_paddle_raise_create_and_summary(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        """Creates paddle donations and returns expected summary metrics."""
        await _assign_bidder_number(db_session, test_registration.id, bidder_number=410)

        label_create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donation-labels",
            json={"name": "Last Hero"},
        )
        assert label_create_response.status_code == 201
        label_id = label_create_response.json()["id"]

        labels_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/donation-labels"
        )
        assert labels_response.status_code == 200
        assert any(item["id"] == label_id for item in labels_response.json()["items"])

        first_create = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/paddle-raise/donations",
            json={
                "amount": 1000,
                "bidder_number": 410,
                "label_ids": [label_id],
                "custom_label": "On-site pledge",
            },
        )
        assert first_create.status_code == 201
        first_data = first_create.json()
        assert first_data["amount"] == 1000
        assert first_data["bidder_number"] == 410
        assert sorted(label["label"] for label in first_data["labels"]) == [
            "Last Hero",
            "On-site pledge",
        ]

        second_create = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/paddle-raise/donations",
            json={
                "amount": 500,
                "bidder_number": 410,
                "label_ids": [],
            },
        )
        assert second_create.status_code == 201
        second_data = second_create.json()
        assert second_data["labels"] == []

        summary_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/summary",
            params={"mode": "PADDLE_RAISE"},
        )
        assert summary_response.status_code == 200
        summary = summary_response.json()
        assert summary["mode"] == "PADDLE_RAISE"
        assert summary["total_pledged"] == 1500
        assert summary["donation_count"] == 2
        assert summary["unique_donor_count"] == 1
        assert summary["participation_percent"] >= 0
        by_amount = {row["amount"]: row["count"] for row in summary["by_amount_level"]}
        assert by_amount[1000] == 1
        assert by_amount[500] == 1
