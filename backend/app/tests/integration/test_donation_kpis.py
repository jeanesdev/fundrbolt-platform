"""KPI verification tests for donation success criteria."""

from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestDonationKPIs:
    """KPI assertions aligned with SC-001, SC-004, and SC-005."""

    async def test_sc001_required_fields_first_submit_rate_at_least_95_percent(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """SC-001: >=95% first-submit success for required donor+amount fields."""
        attempts = 20
        successes = 0

        for _ in range(attempts):
            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/donations",
                json={
                    "donor_user_id": str(test_donor_user.id),
                    "amount": "25.00",
                    "is_paddle_raise": False,
                    "label_ids": [],
                },
            )
            if response.status_code == 201:
                successes += 1

        success_rate = successes / attempts
        assert success_rate >= 0.95

    async def test_sc004_at_least_90_percent_donations_have_attribution(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """SC-004: >=90% donations have paddle raise or at least one label."""
        label_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donation-labels",
            json={"name": "KPI Label"},
        )
        assert label_response.status_code == 201
        label_id = label_response.json()["id"]

        payloads = [
            {"amount": "10.00", "is_paddle_raise": True, "label_ids": []},
            {"amount": "11.00", "is_paddle_raise": False, "label_ids": [label_id]},
            {"amount": "12.00", "is_paddle_raise": True, "label_ids": [label_id]},
            {"amount": "13.00", "is_paddle_raise": True, "label_ids": []},
            {"amount": "14.00", "is_paddle_raise": False, "label_ids": [label_id]},
            {"amount": "15.00", "is_paddle_raise": True, "label_ids": []},
            {"amount": "16.00", "is_paddle_raise": False, "label_ids": [label_id]},
            {"amount": "17.00", "is_paddle_raise": True, "label_ids": []},
            {"amount": "18.00", "is_paddle_raise": False, "label_ids": [label_id]},
            {"amount": "19.00", "is_paddle_raise": False, "label_ids": []},
        ]

        for payload in payloads:
            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/donations",
                json={
                    "donor_user_id": str(test_donor_user.id),
                    "amount": payload["amount"],
                    "is_paddle_raise": payload["is_paddle_raise"],
                    "label_ids": payload["label_ids"],
                },
            )
            assert response.status_code == 201

        list_response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/donations")
        assert list_response.status_code == 200
        items = list_response.json()["items"]

        attributed = [
            donation
            for donation in items
            if donation["is_paddle_raise"] or len(donation["label_ids"]) > 0
        ]
        attribution_rate = len(attributed) / len(items)
        assert attribution_rate >= 0.90

    async def test_sc005_three_common_attribution_queries_return_totals(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """SC-005: Totals for 3 attribution queries are directly derivable from API responses."""
        last_hero_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donation-labels",
            json={"name": "Last Hero"},
        )
        assert last_hero_response.status_code == 201
        last_hero_id = last_hero_response.json()["id"]

        coin_toss_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donation-labels",
            json={"name": "Coin Toss"},
        )
        assert coin_toss_response.status_code == 201
        coin_toss_id = coin_toss_response.json()["id"]

        entries = [
            {"amount": "100.00", "is_paddle_raise": True, "label_ids": [last_hero_id]},
            {"amount": "75.00", "is_paddle_raise": False, "label_ids": [coin_toss_id]},
            {"amount": "50.00", "is_paddle_raise": True, "label_ids": []},
            {
                "amount": "25.00",
                "is_paddle_raise": False,
                "label_ids": [last_hero_id, coin_toss_id],
            },
        ]

        for entry in entries:
            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/donations",
                json={
                    "donor_user_id": str(test_donor_user.id),
                    "amount": entry["amount"],
                    "is_paddle_raise": entry["is_paddle_raise"],
                    "label_ids": entry["label_ids"],
                },
            )
            assert response.status_code == 201

        paddle_raise_response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/donations",
            params={"is_paddle_raise": True},
        )
        assert paddle_raise_response.status_code == 200
        paddle_raise_total = sum(
            Decimal(item["amount"]) for item in paddle_raise_response.json()["items"]
        )

        last_hero_total_response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/donations",
            params=[("label_ids", last_hero_id)],
        )
        assert last_hero_total_response.status_code == 200
        last_hero_total = sum(
            Decimal(item["amount"]) for item in last_hero_total_response.json()["items"]
        )

        coin_toss_total_response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/donations",
            params=[("label_ids", coin_toss_id)],
        )
        assert coin_toss_total_response.status_code == 200
        coin_toss_total = sum(
            Decimal(item["amount"]) for item in coin_toss_total_response.json()["items"]
        )

        assert paddle_raise_total > Decimal("0")
        assert last_hero_total > Decimal("0")
        assert coin_toss_total > Decimal("0")
