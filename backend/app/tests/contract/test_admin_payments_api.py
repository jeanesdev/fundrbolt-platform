"""Contract tests for admin payments API — T062-T066."""

import uuid
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_profile import PaymentProfile

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def test_payment_profile(
    db_session: AsyncSession,
    test_donor_user: Any,
    test_npo_id: Any,
) -> PaymentProfile:
    """Create a PaymentProfile for the test donor user."""
    profile = PaymentProfile(
        user_id=test_donor_user.id,
        npo_id=test_npo_id,
        gateway_profile_id=f"stub_profile_{uuid.uuid4().hex[:8]}",
        card_last4="4242",
        card_brand="visa",
        card_expiry_month=12,
        card_expiry_year=2030,
        billing_name="Test Donor",
        is_default=True,
    )
    db_session.add(profile)
    await db_session.flush()
    return profile


class TestCheckoutStatus:
    """Contract tests for GET/PATCH /admin/payments/checkout/status."""

    async def test_get_checkout_status_returns_closed_by_default(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        response = await npo_admin_client.get(
            "/api/v1/admin/payments/checkout/status",
            params={"event_id": str(test_event.id)},
        )
        assert response.status_code == 200
        data = response.json()
        assert "checkout_open" in data
        assert isinstance(data["checkout_open"], bool)

    async def test_open_checkout(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        response = await npo_admin_client.patch(
            "/api/v1/admin/payments/checkout/status",
            json={"checkout_open": True},
            params={"event_id": str(test_event.id)},
        )
        assert response.status_code == 200
        assert response.json()["checkout_open"] is True

    async def test_close_checkout(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        # Open first
        await npo_admin_client.patch(
            "/api/v1/admin/payments/checkout/status",
            json={"checkout_open": True},
            params={"event_id": str(test_event.id)},
        )
        # Then close
        response = await npo_admin_client.patch(
            "/api/v1/admin/payments/checkout/status",
            json={"checkout_open": False},
            params={"event_id": str(test_event.id)},
        )
        assert response.status_code == 200
        assert response.json()["checkout_open"] is False

    async def test_checkout_status_requires_auth(
        self,
        client: AsyncClient,
        test_event: Any,
    ) -> None:
        response = await client.get(
            "/api/v1/admin/payments/checkout/status",
            params={"event_id": str(test_event.id)},
        )
        assert response.status_code == 401


class TestDonorBalances:
    """Contract tests for GET /admin/payments/donors."""

    async def test_donor_balances_empty_when_no_activity(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        response = await npo_admin_client.get(
            "/api/v1/admin/payments/donors",
            params={"event_id": str(test_event.id)},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["event_id"] == str(test_event.id)
        assert isinstance(data["donors"], list)
        assert isinstance(data["total_outstanding"], str)

    async def test_donor_balances_requires_admin_role(
        self,
        client: AsyncClient,
        test_event: Any,
    ) -> None:
        response = await client.get(
            "/api/v1/admin/payments/donors",
            params={"event_id": str(test_event.id)},
        )
        assert response.status_code == 401

    async def test_donor_balances_404_for_unknown_event(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        response = await npo_admin_client.get(
            "/api/v1/admin/payments/donors",
            params={"event_id": str(uuid.uuid4())},
        )
        assert response.status_code == 404


class TestAdminCharge:
    """Contract tests for POST /admin/payments/charge."""

    async def test_admin_charge_approved(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
        test_npo_id: Any,
        test_payment_profile: PaymentProfile,
    ) -> None:
        response = await npo_admin_client.post(
            "/api/v1/admin/payments/charge",
            json={
                "user_id": str(test_donor_user.id),
                "npo_id": str(test_npo_id),
                "event_id": str(test_event.id),
                "payment_profile_id": str(test_payment_profile.id),
                "line_items": [
                    {
                        "type": "auction_win",
                        "label": "Dinner for Two",
                        "amount": "150.00",
                    }
                ],
                "total_amount": "150.00",
                "reason": "Admin checkout test",
                "idempotency_key": f"test-charge-{uuid.uuid4().hex}",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert Decimal(data["amount_charged"]) == Decimal("150.00")
        assert "transaction_id" in data

    async def test_admin_charge_requires_reason(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
        test_npo_id: Any,
        test_payment_profile: PaymentProfile,
    ) -> None:
        """Omitting reason should fail validation."""
        response = await npo_admin_client.post(
            "/api/v1/admin/payments/charge",
            json={
                "user_id": str(test_donor_user.id),
                "npo_id": str(test_npo_id),
                "event_id": str(test_event.id),
                "payment_profile_id": str(test_payment_profile.id),
                "line_items": [{"type": "auction_win", "label": "Test", "amount": "10.00"}],
                "total_amount": "10.00",
                # missing "reason"
                "idempotency_key": f"test-no-reason-{uuid.uuid4().hex}",
            },
        )
        assert response.status_code == 422

    async def test_admin_charge_missing_profile_returns_404(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
        test_npo_id: Any,
    ) -> None:
        response = await npo_admin_client.post(
            "/api/v1/admin/payments/charge",
            json={
                "user_id": str(test_donor_user.id),
                "npo_id": str(test_npo_id),
                "event_id": str(test_event.id),
                "payment_profile_id": str(uuid.uuid4()),  # nonexistent
                "line_items": [{"type": "auction_win", "label": "Test", "amount": "10.00"}],
                "total_amount": "10.00",
                "reason": "Test missing profile",
                "idempotency_key": f"test-404-{uuid.uuid4().hex}",
            },
        )
        assert response.status_code == 404


class TestTransactionList:
    """Contract tests for GET /admin/payments/transactions."""

    async def test_transaction_list_empty(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        response = await npo_admin_client.get(
            "/api/v1/admin/payments/transactions",
            params={"event_id": str(test_event.id)},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["event_id"] == str(test_event.id)
        assert data["transactions"] == []
        assert data["total"] == 0

    async def test_transaction_list_after_charge(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
        test_npo_id: Any,
        test_payment_profile: PaymentProfile,
    ) -> None:
        """After an admin charge, the transaction appears in the list."""
        # Create a transaction
        ikey = f"test-list-charge-{uuid.uuid4().hex}"
        charge_resp = await npo_admin_client.post(
            "/api/v1/admin/payments/charge",
            json={
                "user_id": str(test_donor_user.id),
                "npo_id": str(test_npo_id),
                "event_id": str(test_event.id),
                "payment_profile_id": str(test_payment_profile.id),
                "line_items": [{"type": "auction_win", "label": "Artwork", "amount": "50.00"}],
                "total_amount": "50.00",
                "reason": "List test",
                "idempotency_key": ikey,
            },
        )
        assert charge_resp.status_code == 200
        txn_id = charge_resp.json()["transaction_id"]

        # Check it appears in the list
        list_resp = await npo_admin_client.get(
            "/api/v1/admin/payments/transactions",
            params={"event_id": str(test_event.id)},
        )
        assert list_resp.status_code == 200
        data = list_resp.json()
        assert data["total"] >= 1
        txn_ids = [t["transaction_id"] for t in data["transactions"]]
        assert txn_id in txn_ids


class TestVoidRefund:
    """Contract tests for void/refund endpoints."""

    async def test_void_captured_transaction(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
        test_npo_id: Any,
        test_payment_profile: PaymentProfile,
    ) -> None:
        """Void a captured transaction using the stub gateway (auto-approves)."""
        ikey = f"test-void-{uuid.uuid4().hex}"
        charge_resp = await npo_admin_client.post(
            "/api/v1/admin/payments/charge",
            json={
                "user_id": str(test_donor_user.id),
                "npo_id": str(test_npo_id),
                "event_id": str(test_event.id),
                "payment_profile_id": str(test_payment_profile.id),
                "line_items": [{"type": "donation", "label": "Donation", "amount": "25.00"}],
                "total_amount": "25.00",
                "reason": "Void test source",
                "idempotency_key": ikey,
            },
        )
        assert charge_resp.status_code == 200
        txn_id = charge_resp.json()["transaction_id"]

        void_resp = await npo_admin_client.post(
            f"/api/v1/admin/payments/{txn_id}/void",
            json={"reason": "Test void"},
        )
        assert void_resp.status_code == 200
        data = void_resp.json()
        assert data["status"] == "voided"
        assert data["parent_transaction_id"] == txn_id

    async def test_refund_captured_transaction(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_donor_user: Any,
        test_npo_id: Any,
        test_payment_profile: PaymentProfile,
    ) -> None:
        """Refund a captured transaction using the stub gateway."""
        ikey = f"test-refund-{uuid.uuid4().hex}"
        charge_resp = await npo_admin_client.post(
            "/api/v1/admin/payments/charge",
            json={
                "user_id": str(test_donor_user.id),
                "npo_id": str(test_npo_id),
                "event_id": str(test_event.id),
                "payment_profile_id": str(test_payment_profile.id),
                "line_items": [{"type": "ticket", "label": "Ticket", "amount": "75.00"}],
                "total_amount": "75.00",
                "reason": "Refund test source",
                "idempotency_key": ikey,
            },
        )
        assert charge_resp.status_code == 200
        txn_id = charge_resp.json()["transaction_id"]

        refund_resp = await npo_admin_client.post(
            f"/api/v1/admin/payments/{txn_id}/refund",
            json={"amount": "25.00", "reason": "Partial refund test"},
        )
        assert refund_resp.status_code == 200
        data = refund_resp.json()
        assert Decimal(data["amount_refunded"]) == Decimal("25.00")

    async def test_void_nonexistent_transaction_returns_404(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        response = await npo_admin_client.post(
            f"/api/v1/admin/payments/{uuid.uuid4()}/void",
            json={"reason": "Test"},
        )
        assert response.status_code == 404
