"""Integration tests for donation label filter modes."""

from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestDonationLabelFilters:
    """Integration tests for donation label match-mode behavior."""

    async def test_label_match_mode_all_vs_any(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """Verify multi-label filtering returns ALL by default and ANY when requested."""
        label_a_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donation-labels",
            json={"name": "Label A"},
        )
        assert label_a_response.status_code == 201
        label_a_id = label_a_response.json()["id"]

        label_b_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donation-labels",
            json={"name": "Label B"},
        )
        assert label_b_response.status_code == 201
        label_b_id = label_b_response.json()["id"]

        both_labels_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donations",
            json={
                "donor_user_id": str(test_donor_user.id),
                "amount": "100.00",
                "is_paddle_raise": False,
                "label_ids": [label_a_id, label_b_id],
            },
        )
        assert both_labels_response.status_code == 201
        both_id = both_labels_response.json()["id"]

        only_a_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donations",
            json={
                "donor_user_id": str(test_donor_user.id),
                "amount": "125.00",
                "is_paddle_raise": False,
                "label_ids": [label_a_id],
            },
        )
        assert only_a_response.status_code == 201
        only_a_id = only_a_response.json()["id"]

        filter_params = [("label_ids", label_a_id), ("label_ids", label_b_id)]
        default_all_response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/donations",
            params=filter_params,
        )
        assert default_all_response.status_code == 200
        all_ids = [item["id"] for item in default_all_response.json()["items"]]
        assert all_ids == [both_id]

        any_response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/donations",
            params=filter_params + [("label_match_mode", "any")],
        )
        assert any_response.status_code == 200
        any_ids = {item["id"] for item in any_response.json()["items"]}
        assert any_ids == {both_id, only_a_id}

    async def test_same_donor_can_have_multiple_donations_in_same_event(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """Allow multiple donations for same donor in one event."""
        first_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donations",
            json={
                "donor_user_id": str(test_donor_user.id),
                "amount": "50.00",
                "is_paddle_raise": True,
                "label_ids": [],
            },
        )
        assert first_response.status_code == 201

        second_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donations",
            json={
                "donor_user_id": str(test_donor_user.id),
                "amount": "75.00",
                "is_paddle_raise": False,
                "label_ids": [],
            },
        )
        assert second_response.status_code == 201

        list_response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/donations",
            params={"donor_user_id": str(test_donor_user.id)},
        )
        assert list_response.status_code == 200
        items = list_response.json()["items"]
        assert len(items) == 2
