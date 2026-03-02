"""Integration tests for donation attribution workflows."""

from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestDonationAttribution:
    """Integration tests for label attribution assignment/removal."""

    async def test_assign_and_remove_attribution_labels(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """Create labels, assign them to donation, then remove one attribution."""
        last_hero_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/donation-labels",
            json={"name": "Last Hero"},
        )
        assert last_hero_response.status_code == 201
        last_hero_label_id = last_hero_response.json()["id"]

        coin_toss_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/donation-labels",
            json={"name": "Coin Toss"},
        )
        assert coin_toss_response.status_code == 201
        coin_toss_label_id = coin_toss_response.json()["id"]

        create_donation_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/donations",
            json={
                "donor_user_id": str(test_donor_user.id),
                "amount": "500.00",
                "is_paddle_raise": True,
                "label_ids": [last_hero_label_id, coin_toss_label_id],
            },
        )
        assert create_donation_response.status_code == 201
        donation = create_donation_response.json()
        assert donation["is_paddle_raise"] is True
        assert sorted(donation["label_ids"]) == sorted([last_hero_label_id, coin_toss_label_id])

        donation_id = donation["id"]
        update_donation_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/donations/{donation_id}",
            json={"label_ids": [last_hero_label_id]},
        )
        assert update_donation_response.status_code == 200
        updated = update_donation_response.json()
        assert updated["label_ids"] == [last_hero_label_id]
