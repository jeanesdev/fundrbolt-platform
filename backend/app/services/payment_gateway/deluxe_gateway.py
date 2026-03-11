"""Deluxe (First American) payment gateway — T013 Phase 2 skeleton.

All methods raise NotImplementedError with docstrings citing Deluxe API docs.
Full implementation pending live Deluxe sandbox credentials (see research.md R-001).
"""

import uuid
from decimal import Decimal
from typing import Any

from app.services.payment_gateway.port import (
    HostedSessionResult,
    PaymentGatewayPort,
    TransactionResult,
)

_DELUXE_API_BASE = "https://api.deluxe.com/v1"
_DELUXE_HPF_BASE = "https://pay.deluxe.com/hosted-payment"


class DeluxePaymentGateway(PaymentGatewayPort):
    """Deluxe (First American) live gateway implementation.

    Used when PAYMENT_GATEWAY_BACKEND=deluxe.

    Constructor receives the per-NPO decrypted credentials. All API calls
    authenticate with Basic Auth: base64(merchant_id:api_key).

    Reference: docs/features/033-payment-processing.md + research.md R-001 – R-009.
    Full implementation to be completed once Deluxe sandbox credentials are active.
    """

    def __init__(
        self,
        merchant_id: str,
        api_key: str,
        api_secret: str,
        gateway_id: str | None = None,
        is_live_mode: bool = False,
    ) -> None:
        """Store decrypted Deluxe merchant credentials.

        Args:
            merchant_id: Deluxe merchant account ID (decrypted from DB via
                `decrypt_credential(merchant_id_enc)`).
            api_key: Deluxe API key (decrypted from api_key_enc).
            api_secret: Deluxe HMAC signing secret (decrypted from api_secret_enc).
                Used to verify webhook signatures (see research.md R-003).
            gateway_id: Optional Deluxe terminal / gateway ID.
            is_live_mode: If False, targets the Deluxe sandbox environment.
        """
        self._merchant_id = merchant_id
        self._api_key = api_key
        self._api_secret = api_secret
        self._gateway_id = gateway_id
        self._is_live_mode = is_live_mode

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
        """Request a short-lived HPF session token from Deluxe.

        API call:
            POST {DELUXE_API_BASE}/hosted-session
            Authorization: Basic base64(merchant_id:api_key)

        Request body (see research.md R-001):
            {
                "amount": "125.00",
                "currency": "USD",
                "order_id": "<transaction_id>",
                "return_url": "<return_url>",
                "webhook_url": "<webhook_url>",
                "save_profile": true,
                "metadata": { ... }
            }

        Expected response (see research.md R-001):
            {
                "session_token": "hpf_abc123...",
                "session_url": "https://pay.deluxe.com/hosted-payment?token=...",
                "expires_at": "2026-03-10T02:15:00Z"
            }

        Token TTL: ~15 minutes (confirm with Deluxe sandbox).
        """
        raise NotImplementedError(
            "DeluxePaymentGateway.create_hosted_session() — "
            "awaiting live Deluxe sandbox credentials. See research.md R-001."
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
        """Charge a previously-vaulted Deluxe payment profile.

        API call:
            POST {DELUXE_API_BASE}/transactions
            Authorization: Basic base64(merchant_id:api_key)
            Idempotency-Key: <idempotency_key>  (if provided)

        Request body (see research.md R-003):
            {
                "transaction_type": "sale",
                "vault_profile_id": "<gateway_profile_id>",
                "amount": "125.00",
                "currency": "USD",
                "order_id": "<transaction_id>",
                "metadata": { ... }
            }

        Successful response contains transaction_id, status="approved", amount.
        Declined response contains status="declined", decline_reason.
        """
        raise NotImplementedError(
            "DeluxePaymentGateway.charge_profile() — "
            "awaiting live Deluxe sandbox credentials. See research.md R-003."
        )

    async def void_transaction(
        self,
        *,
        gateway_transaction_id: str,
        reason: str | None = None,
    ) -> TransactionResult:
        """Void an authorised or captured Deluxe transaction.

        Only valid before settlement (typically within the same business day).

        API call:
            POST {DELUXE_API_BASE}/transactions/{gateway_transaction_id}/void
            Authorization: Basic base64(merchant_id:api_key)

        See research.md R-005 for Deluxe void endpoint.
        """
        raise NotImplementedError(
            "DeluxePaymentGateway.void_transaction() — "
            "awaiting live Deluxe sandbox credentials. See research.md R-005."
        )

    async def refund_transaction(
        self,
        *,
        gateway_transaction_id: str,
        amount: Decimal,
        reason: str | None = None,
    ) -> TransactionResult:
        """Issue a full or partial refund for a settled Deluxe transaction.

        API call:
            POST {DELUXE_API_BASE}/transactions/{gateway_transaction_id}/refund
            Authorization: Basic base64(merchant_id:api_key)

        Request body:
            { "amount": "50.00", "reason": "<reason>" }

        See research.md R-005 for Deluxe refund endpoint.
        """
        raise NotImplementedError(
            "DeluxePaymentGateway.refund_transaction() — "
            "awaiting live Deluxe sandbox credentials. See research.md R-005."
        )

    async def verify_webhook_signature(
        self,
        *,
        raw_body: bytes,
        signature_header: str,
        timestamp_header: str,
    ) -> bool:
        """Verify that a webhook POST was signed by Deluxe.

        Algorithm (see research.md R-003):
            1. Parse X-Deluxe-Timestamp header (Unix epoch seconds).
            2. Reject if |now - timestamp| > PAYMENT_WEBHOOK_TIMEOUT_MINUTES (replay protection).
            3. Compute HMAC-SHA256 of "<timestamp>.<raw_body>" using api_secret.
            4. Compare result to hex value in X-Deluxe-Signature: sha256=<hex>.

        Use `hmac.compare_digest()` to prevent timing attacks.
        """
        raise NotImplementedError(
            "DeluxePaymentGateway.verify_webhook_signature() — "
            "awaiting live Deluxe sandbox credentials. See research.md R-003."
        )

    async def get_transaction_status(
        self,
        *,
        gateway_transaction_id: str,
    ) -> TransactionResult:
        """Poll Deluxe for the current status of a transaction.

        Used when the webhook was not received within PAYMENT_WEBHOOK_TIMEOUT_MINUTES.

        API call:
            GET {DELUXE_API_BASE}/transactions/{gateway_transaction_id}
            Authorization: Basic base64(merchant_id:api_key)

        See research.md R-005 for Deluxe transaction status endpoint.
        """
        raise NotImplementedError(
            "DeluxePaymentGateway.get_transaction_status() — "
            "awaiting live Deluxe sandbox credentials. See research.md R-005."
        )

    async def delete_profile(self, gateway_profile_id: str) -> None:
        """Delete a vaulted card from the Deluxe secure vault.

        API call:
            DELETE {DELUXE_API_BASE}/vault/profiles/{gateway_profile_id}
            Authorization: Basic base64(merchant_id:api_key)

        Treat 404 responses as success (idempotent delete).
        See research.md R-003 for Deluxe vault management endpoints.
        """
        raise NotImplementedError(
            "DeluxePaymentGateway.delete_profile() — "
            "awaiting live Deluxe sandbox credentials. See research.md R-003."
        )
