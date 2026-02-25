"""Contract tests for admin donations API."""

from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAdminDonationsContract:
    """Contract tests for donation CRUD/void endpoints."""

    async def test_create_get_update_void_donation_lifecycle(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """Create, read, update, and void a donation within one event."""
        create_payload = {
            "donor_user_id": str(test_donor_user.id),
            "amount": "150.00",
            "is_paddle_raise": True,
            "label_ids": [],
        }

        create_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/donations",
            json=create_payload,
        )
        assert create_response.status_code == 201
        created = create_response.json()
        donation_id = created["id"]

        assert created["event_id"] == str(test_event.id)
        assert created["donor_user_id"] == str(test_donor_user.id)
        assert Decimal(created["amount"]) == Decimal("150.00")
        assert created["is_paddle_raise"] is True
        assert created["status"] == "active"

        get_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/donations/{donation_id}"
        )
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["id"] == donation_id

        update_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/donations/{donation_id}",
            json={"amount": "200.00", "is_paddle_raise": False},
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert Decimal(updated["amount"]) == Decimal("200.00")
        assert updated["is_paddle_raise"] is False
        assert updated["status"] == "active"

        list_before_void = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/donations"
        )
        assert list_before_void.status_code == 200
        listed_before_void = list_before_void.json()["items"]
        assert len(listed_before_void) == 1
        assert listed_before_void[0]["id"] == donation_id

        void_response = await npo_admin_client.delete(
            f"/api/v1/admin/events/{test_event.id}/donations/{donation_id}"
        )
        assert void_response.status_code == 200
        voided = void_response.json()
        assert voided["status"] == "voided"

        list_after_void = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/donations"
        )
        assert list_after_void.status_code == 200
        assert list_after_void.json()["items"] == []

        list_include_voided = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/donations",
            params={"include_voided": True},
        )
        assert list_include_voided.status_code == 200
        listed_with_voided = list_include_voided.json()["items"]
        assert len(listed_with_voided) == 1
        assert listed_with_voided[0]["status"] == "voided"

    async def test_create_donation_requires_positive_amount(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """Reject non-positive donation amounts via schema validation."""
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/donations",
            json={
                "donor_user_id": str(test_donor_user.id),
                "amount": "0.00",
                "is_paddle_raise": False,
                "label_ids": [],
            },
        )

        assert response.status_code == 422

    async def test_create_donation_with_label_assignments_and_paddle_raise(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """Accept label_ids and paddle-raise attribution on create payload."""
        label_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/donation-labels",
            json={"name": "Last Hero"},
        )
        assert label_response.status_code == 201
        label_id = label_response.json()["id"]

        create_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/donations",
            json={
                "donor_user_id": str(test_donor_user.id),
                "amount": "250.00",
                "is_paddle_raise": True,
                "label_ids": [label_id],
            },
        )
        assert create_response.status_code == 201
        created = create_response.json()
        assert created["is_paddle_raise"] is True
        assert created["label_ids"] == [label_id]

    async def test_update_donation_can_remove_label_assignments(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """Allow removing all label assignments via update payload."""
        label_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/donation-labels",
            json={"name": "Coin Toss"},
        )
        assert label_response.status_code == 201
        label_id = label_response.json()["id"]

        create_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/donations",
            json={
                "donor_user_id": str(test_donor_user.id),
                "amount": "300.00",
                "is_paddle_raise": True,
                "label_ids": [label_id],
            },
        )
        assert create_response.status_code == 201
        donation_id = create_response.json()["id"]

        update_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/donations/{donation_id}",
            json={"is_paddle_raise": False, "label_ids": []},
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["is_paddle_raise"] is False
        assert updated["label_ids"] == []

    async def test_update_donation_requires_at_least_one_field(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """Reject empty patch payload for donation update."""
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/donations",
            json={
                "donor_user_id": str(test_donor_user.id),
                "amount": "90.00",
                "is_paddle_raise": False,
                "label_ids": [],
            },
        )
        assert create_response.status_code == 201
        donation_id = create_response.json()["id"]

        patch_response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/donations/{donation_id}",
            json={},
        )
        assert patch_response.status_code == 422
