"""Contract tests for the public donate-now API."""

from typing import Any

import pytest
from httpx import AsyncClient

from app.models.donate_now_config import DonateNowPageConfig

pytestmark = pytest.mark.asyncio


class TestPublicDonateNowContract:
    """Contract tests for the donor-facing donate-now endpoints."""

    async def test_create_donation_succeeds_without_native_postgres_enums(
        self,
        donor_client: AsyncClient,
        db_session: Any,
        test_approved_npo: Any,
        test_donor_user: Any,
    ) -> None:
        """Allow dev/test databases with varchar donation status columns."""

        config = DonateNowPageConfig(
            npo_id=test_approved_npo.id,
            is_enabled=True,
        )
        db_session.add(config)
        await db_session.commit()

        response = await donor_client.post(
            f"/api/v1/npos/{test_approved_npo.slug}/donate-now/donations",
            json={
                "amount_cents": 2500,
                "covers_processing_fee": False,
                "is_monthly": False,
                "idempotency_key": "contract-donate-now-1",
            },
        )

        assert response.status_code == 201
        body = response.json()
        assert body["npo_id"] == str(test_approved_npo.id)
        assert body["amount_cents"] == 2500
        assert body["status"] == "captured"
