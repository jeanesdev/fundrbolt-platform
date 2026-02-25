"""Integration tests for donation role-based access behavior."""

from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestDonationAccess:
    """Role-access integration tests for donation endpoints."""

    async def test_admin_role_can_create_and_view_donations(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """NPO admin can create and list donations for an event in their NPO."""
        create_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/donations",
            json={
                "donor_user_id": str(test_donor_user.id),
                "amount": "100.00",
                "is_paddle_raise": False,
                "label_ids": [],
            },
        )
        assert create_response.status_code == 201

        list_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{test_event.id}/donations"
        )
        assert list_response.status_code == 200
        assert len(list_response.json()["items"]) == 1

    async def test_donor_role_is_forbidden_from_writing_donations(
        self,
        donor_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
    ) -> None:
        """Donor role cannot create donations via admin endpoints."""
        response = await donor_client.post(
            f"/api/v1/admin/events/{test_event.id}/donations",
            json={
                "donor_user_id": str(test_donor_user.id),
                "amount": "100.00",
                "is_paddle_raise": True,
                "label_ids": [],
            },
        )
        assert response.status_code == 403

    async def test_donor_role_is_forbidden_from_reading_admin_donations(
        self,
        donor_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Donor role cannot read admin donation listings."""
        response = await donor_client.get(f"/api/v1/admin/events/{test_event.id}/donations")
        assert response.status_code == 403
