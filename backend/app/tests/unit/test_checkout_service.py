"""Unit tests for CheckoutService — T061."""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.checkout_service import CheckoutService


@pytest.fixture
def service() -> CheckoutService:
    """Return a CheckoutService with a mock DB session."""
    return CheckoutService(db=AsyncMock())


class TestComputeProcessingFee:
    """Unit tests for CheckoutService.compute_processing_fee."""

    def test_standard_amount(self, service: CheckoutService) -> None:
        """$100.00 → 2.9% + $0.30 = $3.20."""
        fee = service.compute_processing_fee(Decimal("100.00"))
        # 100 * 0.029 = 2.90, + 0.30 = 3.20
        assert fee == Decimal("3.20")

    def test_zero_subtotal(self, service: CheckoutService) -> None:
        """$0.00 subtotal → only the flat fee applies."""
        fee = service.compute_processing_fee(Decimal("0.00"))
        # 0 * 0.029 = 0, + 0.30 = 0.30
        assert fee == Decimal("0.30")

    def test_small_amount(self, service: CheckoutService) -> None:
        """$1.00 → 2.9¢ + 30¢ = 32.9¢ → rounds to $0.33."""
        fee = service.compute_processing_fee(Decimal("1.00"))
        # 1 * 0.029 = 0.029, + 0.30 = 0.329 → rounds to 0.33
        assert fee == Decimal("0.33")

    def test_large_amount(self, service: CheckoutService) -> None:
        """$1000.00 → 2.9% + $0.30 = $29.30."""
        fee = service.compute_processing_fee(Decimal("1000.00"))
        # 1000 * 0.029 = 29.00, + 0.30 = 29.30
        assert fee == Decimal("29.30")

    def test_result_rounds_to_cents(self, service: CheckoutService) -> None:
        """Result is always quantized to 2 decimal places."""
        fee = service.compute_processing_fee(Decimal("73.37"))
        # 73.37 * 0.029 = 2.12773, + 0.30 = 2.42773 → rounds to 2.43
        assert fee == Decimal("2.43")

    def test_returns_decimal(self, service: CheckoutService) -> None:
        """Return type is always Decimal, not float."""
        fee = service.compute_processing_fee(Decimal("50.00"))
        assert isinstance(fee, Decimal)


class TestTxnToCheckoutResponse:
    """Unit tests for CheckoutService._txn_to_checkout_response."""

    def _make_txn(
        self,
        status: str = "captured",
        amount: str = "100.00",
        gateway_txn_id: str | None = "gw-123",
        decline_reason: str | None = None,
    ) -> MagicMock:
        import uuid
        from datetime import UTC, datetime

        from app.models.payment_transaction import TransactionStatus

        txn = MagicMock()
        txn.id = uuid.uuid4()
        txn.status = TransactionStatus(status)
        txn.amount = Decimal(amount)
        txn.gateway_transaction_id = gateway_txn_id
        txn.decline_reason = decline_reason
        txn.gateway_response = None  # raw.get("decline_reason") won't be called
        txn.created_at = datetime.now(UTC)
        return txn

    def test_captured_is_approved(self) -> None:
        txn = self._make_txn(status="captured")
        resp = CheckoutService._txn_to_checkout_response(txn)
        assert resp.status == "approved"
        assert resp.receipt_pending is True

    def test_declined_status(self) -> None:
        txn = self._make_txn(status="declined")
        txn.gateway_response = {"decline_reason": "Insufficient funds"}
        resp = CheckoutService._txn_to_checkout_response(txn)
        assert resp.status == "declined"
        assert resp.receipt_pending is False
        assert resp.decline_reason == "Insufficient funds"

    def test_pending_status(self) -> None:
        txn = self._make_txn(status="pending")
        resp = CheckoutService._txn_to_checkout_response(txn)
        assert resp.status == "pending"
        assert resp.receipt_pending is False

    def test_gateway_txn_id_propagated(self) -> None:
        txn = self._make_txn(gateway_txn_id="gw-xyz-999")
        resp = CheckoutService._txn_to_checkout_response(txn)
        assert resp.gateway_transaction_id == "gw-xyz-999"

    def test_no_gateway_txn_id(self) -> None:
        txn = self._make_txn(gateway_txn_id=None)
        resp = CheckoutService._txn_to_checkout_response(txn)
        assert resp.gateway_transaction_id is None
