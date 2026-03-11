"""Payment gateway port (ABC) — typed abstract interface for all gateway backends.

T011 — Phase 2 implementation.
"""

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any


@dataclass
class HostedSessionResult:
    """Result of creating a hosted payment form (HPF) session.

    Returned by `create_hosted_session()`. The frontend embeds `session_url`
    in an iframe (or opens it in a drawer) to collect card details.
    """

    #: Short-lived opaque token identifying the session at the gateway.
    session_token: str

    #: The URL to load in the iframe / browser drawer.
    session_url: str

    #: When the session token expires (typically 15 minutes from creation).
    expires_at: datetime

    #: Our internal PaymentTransaction.id that was passed as order_id.
    transaction_id: uuid.UUID


@dataclass
class TransactionResult:
    """Result of a charge, void, or refund operation.

    Returned by `charge_profile()`, `void_transaction()`, `refund_transaction()`,
    and `get_transaction_status()`.
    """

    #: Gateway's own transaction reference (stored in gateway_transaction_id).
    gateway_transaction_id: str

    #: One of: "approved", "declined", "voided", "refunded", "error"
    status: str

    #: Amount actually processed (may differ from requested on partial refunds).
    amount: Decimal

    #: If declined or errored, a human-readable reason.
    decline_reason: str | None = None

    #: Opaque vault profile ID (present after a successful vault charge).
    profile_id: str | None = None

    #: Card last 4 digits (present in webhook/status responses).
    card_last4: str | None = None

    #: Card brand (Visa, Mastercard, Amex, Discover, …)
    card_brand: str | None = None

    #: Raw sanitised gateway response (stored in gateway_response JSONB).
    raw_response: dict[str, Any] | None = None


class PaymentGatewayPort(ABC):
    """Abstract base class for payment gateway implementations.

    All gateway backends (Stub, Deluxe) must implement every method.
    Types are defined via HostedSessionResult and TransactionResult dataclasses.
    """

    @abstractmethod
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
        """Request a short-lived HPF session token from the gateway.

        The backend creates a PaymentTransaction record (status=pending) before
        calling this method, then embeds the returned session_url in the donor's
        browser.

        See research.md R-001 for expected request/response shapes.
        """
        raise NotImplementedError

    @abstractmethod
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
        """Charge a previously-vaulted payment profile.

        Used for admin-initiated charges and end-of-night self-checkout.
        See research.md R-003 for Deluxe vault charge endpoint.
        """
        raise NotImplementedError

    @abstractmethod
    async def void_transaction(
        self,
        *,
        gateway_transaction_id: str,
        reason: str | None = None,
    ) -> TransactionResult:
        """Void an authorised or captured transaction before settlement.

        See research.md R-005 for Deluxe void endpoint.
        """
        raise NotImplementedError

    @abstractmethod
    async def refund_transaction(
        self,
        *,
        gateway_transaction_id: str,
        amount: Decimal,
        reason: str | None = None,
    ) -> TransactionResult:
        """Issue a full or partial refund for an already-settled transaction.

        See research.md R-005 for Deluxe refund endpoint.
        """
        raise NotImplementedError

    @abstractmethod
    async def verify_webhook_signature(
        self,
        *,
        raw_body: bytes,
        signature_header: str,
        timestamp_header: str,
    ) -> bool:
        """Verify that an incoming webhook POST was signed by the gateway.

        See research.md R-003 for Deluxe HMAC signature scheme.

        Returns True if signature is valid, False otherwise.
        """
        raise NotImplementedError

    @abstractmethod
    async def get_transaction_status(
        self,
        *,
        gateway_transaction_id: str,
    ) -> TransactionResult:
        """Poll the gateway for the current status of a transaction.

        Used as a polling fallback when the webhook was not received within
        PAYMENT_WEBHOOK_TIMEOUT_MINUTES. See research.md R-005.
        """
        raise NotImplementedError

    @abstractmethod
    async def delete_profile(self, gateway_profile_id: str) -> None:
        """Remove a vaulted card from the gateway's secure vault.

        Called before soft-deleting a PaymentProfile in the database so
        the donor's card data is not retained longer than necessary.
        Implementers should treat 404 from the gateway as success (idempotent).
        """
        raise NotImplementedError
