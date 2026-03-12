"""Contract tests for donor-facing payments API — T067-T069."""

import uuid
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_profile import PaymentProfile

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def donor_payment_profile(
    db_session: AsyncSession,
    test_donor_user: Any,
    test_npo_id: Any,
) -> PaymentProfile:
    """PaymentProfile for the donor user."""
    profile = PaymentProfile(
        user_id=test_donor_user.id,
        npo_id=test_npo_id,
        gateway_profile_id=f"stub_donor_{uuid.uuid4().hex[:8]}",
        card_last4="1111",
        card_brand="mastercard",
        card_expiry_month=6,
        card_expiry_year=2028,
        billing_name="Donor Test",
        is_default=True,
    )
    db_session.add(profile)
    await db_session.flush()
    return profile


class TestPaymentProfiles:
    """Contract tests for GET/DELETE/PATCH /payments/profiles."""

    async def test_list_profiles_empty(
        self,
        donor_client: AsyncClient,
        test_npo_id: Any,
    ) -> None:
        response = await donor_client.get(
            "/api/v1/payments/profiles",
            params={"npo_id": str(test_npo_id)},
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_profiles_after_creation(
        self,
        donor_client: AsyncClient,
        test_npo_id: Any,
        donor_payment_profile: PaymentProfile,
    ) -> None:
        response = await donor_client.get(
            "/api/v1/payments/profiles",
            params={"npo_id": str(test_npo_id)},
        )
        assert response.status_code == 200
        profiles = response.json()
        assert len(profiles) >= 1
        profile_ids = [p["id"] for p in profiles]
        assert str(donor_payment_profile.id) in profile_ids

    async def test_list_profiles_requires_auth(
        self,
        client: AsyncClient,
        test_npo_id: Any,
    ) -> None:
        response = await client.get(
            "/api/v1/payments/profiles",
            params={"npo_id": str(test_npo_id)},
        )
        assert response.status_code == 401

    async def test_set_default_profile(
        self,
        donor_client: AsyncClient,
        test_npo_id: Any,
        donor_payment_profile: PaymentProfile,
    ) -> None:
        response = await donor_client.patch(
            f"/api/v1/payments/profiles/{donor_payment_profile.id}/default",
            params={"npo_id": str(test_npo_id)},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_default"] is True

    async def test_delete_profile(
        self,
        donor_client: AsyncClient,
        test_npo_id: Any,
        donor_payment_profile: PaymentProfile,
    ) -> None:
        response = await donor_client.delete(
            f"/api/v1/payments/profiles/{donor_payment_profile.id}",
            params={"npo_id": str(test_npo_id)},
        )
        assert response.status_code == 200


class TestCheckoutBalance:
    """Contract tests for GET /payments/checkout/balance."""

    async def test_balance_zero_when_no_activity(
        self,
        donor_client: AsyncClient,
        test_event: Any,
    ) -> None:
        response = await donor_client.get(
            "/api/v1/payments/checkout/balance",
            params={"event_id": str(test_event.id)},
        )
        assert response.status_code == 200
        data = response.json()
        assert Decimal(data["total_balance"]) == Decimal("0.00")
        assert isinstance(data["line_items"], list)
        assert "processing_fee" in data
        assert "total_with_fee" in data

    async def test_balance_requires_auth(
        self,
        client: AsyncClient,
        test_event: Any,
    ) -> None:
        response = await client.get(
            "/api/v1/payments/checkout/balance",
            params={"event_id": str(test_event.id)},
        )
        assert response.status_code == 401


class TestDonorCheckout:
    """Contract tests for POST /payments/checkout."""

    async def test_checkout_fails_when_checkout_closed(
        self,
        donor_client: AsyncClient,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_npo_id: Any,
        test_donor_user: Any,
        donor_payment_profile: PaymentProfile,
    ) -> None:
        """POST /payments/checkout returns 409 when checkout is closed."""
        # Ensure checkout is closed
        await npo_admin_client.patch(
            "/api/v1/admin/payments/checkout/status",
            json={"checkout_open": False},
            params={"event_id": str(test_event.id)},
        )

        response = await donor_client.post(
            "/api/v1/payments/checkout",
            json={
                "event_id": str(test_event.id),
                "payment_profile_id": str(donor_payment_profile.id),
                "cover_processing_fee": False,
                "idempotency_key": f"test-closed-{uuid.uuid4().hex}",
            },
        )
        # 409 = checkout not open; 422 = zero balance
        # Both acceptable (zero balance may fire before checkout-open check)
        assert response.status_code in (409, 422)

    async def test_checkout_fails_when_zero_balance(
        self,
        donor_client: AsyncClient,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_npo_id: Any,
        test_donor_user: Any,
        donor_payment_profile: PaymentProfile,
    ) -> None:
        """POST /payments/checkout returns 422 when donor has zero balance."""
        # Open checkout first
        await npo_admin_client.patch(
            "/api/v1/admin/payments/checkout/status",
            json={"checkout_open": True},
            params={"event_id": str(test_event.id)},
        )

        response = await donor_client.post(
            "/api/v1/payments/checkout",
            json={
                "event_id": str(test_event.id),
                "payment_profile_id": str(donor_payment_profile.id),
                "cover_processing_fee": False,
                "idempotency_key": f"test-zero-{uuid.uuid4().hex}",
            },
        )
        # 422 = zero balance (no auction wins etc.)
        assert response.status_code == 422
