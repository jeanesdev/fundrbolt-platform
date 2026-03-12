"""Stub payment gateway — T012 Phase 2 implementation.

Auto-approves all operations for local development and testing.
"""

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from app.services.payment_gateway.port import (
    HostedSessionResult,
    PaymentGatewayPort,
    TransactionResult,
)


class StubPaymentGateway(PaymentGatewayPort):
    """Stub gateway that auto-approves all operations.

    Used when PAYMENT_GATEWAY_BACKEND=stub (local dev / CI).

    Behaviour:
    - `create_hosted_session()` returns a stub token pointing to
      `{stub_hpf_base_url}/api/v1/payments/stub-hpf?token=stub_<uuid>`.
      After the donor "submits" the stub form, the form JS posts a synthetic
      DELUXE_HPF_COMPLETE postMessage and calls the webhook endpoint internally.
    - `charge_profile()` always returns status="approved".
    - `void_transaction()` / `refund_transaction()` always return success.
    - `verify_webhook_signature()` always returns True.
    - `get_transaction_status()` returns status="captured" for any known txn.

    See docs/features/033-payment-processing.md Stub design section.
    """

    def __init__(self, stub_hpf_base_url: str = "http://localhost:8000") -> None:
        """Initialise the stub gateway.

        Args:
            stub_hpf_base_url: Base URL for the in-process stub HPF page.
                Defaults to localhost:8000 but can be overridden via env var.
        """
        self._base_url = stub_hpf_base_url.rstrip("/")

    async def create_hosted_session(
        self,
        *,
        transaction_id: uuid.UUID,
        amount: Decimal,
        currency: str = "USD",
        return_url: str,
        webhook_url: str,
        save_profile: bool = True,
        metadata: dict[str, Any] | None = None,
    ) -> HostedSessionResult:
        """Return a stub HPF session pointing to the local stub-hpf HTML page.

        The stub HPF page auto-approves on submit and fires a synthetic
        postMessage event that the donor PWA HpfIframe component handles.
        """
        stub_token = f"stub_{uuid.uuid4().hex}"
        session_url = (
            f"{self._base_url}/api/v1/payments/stub-hpf"
            f"?token={stub_token}"
            f"&transaction_id={transaction_id}"
            f"&amount={amount}"
        )
        return HostedSessionResult(
            session_token=stub_token,
            session_url=session_url,
            expires_at=datetime.now(tz=UTC) + timedelta(minutes=15),
            transaction_id=transaction_id,
        )

    async def charge_profile(
        self,
        *,
        transaction_id: uuid.UUID,
        gateway_profile_id: str,
        amount: Decimal,
        currency: str = "USD",
        idempotency_key: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> TransactionResult:
        """Auto-approve all vault charges."""
        gateway_txn_id = f"stub_charge_{uuid.uuid4().hex[:12]}"
        return TransactionResult(
            gateway_transaction_id=gateway_txn_id,
            status="approved",
            amount=amount,
            profile_id=gateway_profile_id,
            raw_response={
                "stub": True,
                "transaction_id": gateway_txn_id,
                "status": "approved",
                "amount": str(amount),
                "currency": currency,
            },
        )

    async def void_transaction(
        self,
        *,
        gateway_transaction_id: str,
        reason: str | None = None,
    ) -> TransactionResult:
        """Auto-approve all voids."""
        void_txn_id = f"stub_void_{uuid.uuid4().hex[:12]}"
        return TransactionResult(
            gateway_transaction_id=void_txn_id,
            status="voided",
            amount=Decimal("0.00"),
            raw_response={"stub": True, "status": "voided", "original": gateway_transaction_id},
        )

    async def refund_transaction(
        self,
        *,
        gateway_transaction_id: str,
        amount: Decimal,
        reason: str | None = None,
    ) -> TransactionResult:
        """Auto-approve all refunds."""
        refund_txn_id = f"stub_refund_{uuid.uuid4().hex[:12]}"
        return TransactionResult(
            gateway_transaction_id=refund_txn_id,
            status="refunded",
            amount=amount,
            raw_response={"stub": True, "status": "refunded", "amount": str(amount)},
        )

    async def verify_webhook_signature(
        self,
        *,
        raw_body: bytes,
        signature_header: str,
        timestamp_header: str,
    ) -> bool:
        """Stub always accepts webhook signatures."""
        return True

    async def get_transaction_status(
        self,
        *,
        gateway_transaction_id: str,
    ) -> TransactionResult:
        """Return captured status for any stub transaction."""
        return TransactionResult(
            gateway_transaction_id=gateway_transaction_id,
            status="captured",
            amount=Decimal("0.00"),
            raw_response={"stub": True, "status": "captured"},
        )

    async def delete_profile(self, gateway_profile_id: str) -> None:
        """Stub no-op — stub vault tokens are ephemeral and require no deletion."""
        return
