"""Performance verification tests for donation workflows."""

from time import perf_counter
from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestDonationPerformance:
    """Performance checks aligned to SC-002 and SC-003."""

    async def test_donation_creation_workflow_under_45_seconds(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """SC-002: Verify typical donation creation workflow completes under 45 seconds."""
        label_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donation-labels",
            json={"name": "Performance Label"},
        )
        assert label_response.status_code == 201
        label_id = label_response.json()["id"]

        start = perf_counter()
        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donations",
            json={
                "donor_user_id": str(test_donor_user.id),
                "amount": "100.00",
                "is_paddle_raise": True,
                "label_ids": [label_id],
            },
        )
        elapsed = perf_counter() - start

        assert response.status_code == 201
        assert elapsed < 45.0

    async def test_filtered_donation_list_under_3_seconds(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """SC-003: Verify multi-label filtered retrieval completes under 3 seconds."""
        label_a_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donation-labels",
            json={"name": "Perf A"},
        )
        assert label_a_response.status_code == 201
        label_a_id = label_a_response.json()["id"]

        label_b_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donation-labels",
            json={"name": "Perf B"},
        )
        assert label_b_response.status_code == 201
        label_b_id = label_b_response.json()["id"]

        for index in range(25):
            label_ids = [label_a_id]
            if index % 2 == 0:
                label_ids.append(label_b_id)
            create_response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/donations",
                json={
                    "donor_user_id": str(test_donor_user.id),
                    "amount": "50.00",
                    "is_paddle_raise": bool(index % 3 == 0),
                    "label_ids": label_ids,
                },
            )
            assert create_response.status_code == 201

        start = perf_counter()
        list_response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/donations",
            params=[
                ("label_ids", label_a_id),
                ("label_ids", label_b_id),
                ("label_match_mode", "all"),
            ],
        )
        elapsed = perf_counter() - start

        assert list_response.status_code == 200
        assert elapsed < 3.0
        assert len(list_response.json()["items"]) > 0
