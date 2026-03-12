"""PaymentTransactionService — lifecycle management for payment transactions.

Current implementation covers Phases 4 and 6:
  - create_hosted_session(): donor initiates HPF payment flow (US2 / US5)
  - handle_webhook():         process gateway IPN and update transaction state (US4)

Future phases will extend this service with:
  - charge_profile():    donor/admin direct profile charge (Phase 9 / T048)
  - void_transaction():  admin-initiated void (Phase 10 / T052)
  - refund_transaction(): admin-initiated refund (Phase 10 / T052)

All public methods take an open AsyncSession and commit responsibility sits
with the endpoint that calls them (unit-of-work pattern).
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.event import Event
from app.models.payment_profile import PaymentProfile
from app.models.payment_transaction import PaymentTransaction, TransactionStatus, TransactionType
from app.models.ticket_management import PaymentStatus, TicketPurchase
from app.schemas.payment import (
    LineItemSchema,
    PaymentSessionRequest,
    PaymentSessionResponse,
)
from app.services.payment_gateway.port import PaymentGatewayPort

logger = logging.getLogger(__name__)


class PaymentTransactionService:
    """Service layer for payment transaction lifecycle."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── US2 / US5 — HPF Session ───────────────────────────────────────────────

    async def create_hosted_session(
        self,
        *,
        user_id: uuid.UUID,
        request: PaymentSessionRequest,
        gateway: PaymentGatewayPort,
    ) -> PaymentSessionResponse:
        """Create a pending transaction and return an HPF session URL.

        When `request.event_id` is None (card-vault-only flow from the settings
        page), `request.npo_id` must be set to identify which NPO's gateway to use.

        Idempotent: if a non-expired PENDING transaction already exists for the
        given idempotency_key, return its existing session data (409 is NOT
        raised — the existing session is returned so retried requests succeed).

        Raises:
            HTTPException 400: Neither event_id nor npo_id provided.
            HTTPException 404: Event not found.
            HTTPException 409: Non-pending duplicate idempotency key.
            HTTPException 503: Gateway unavailable.
        """
        from fastapi import HTTPException, status

        # ── Idempotency check ─────────────────────────────────────────────────
        existing = await self._find_by_idempotency_key(request.idempotency_key)
        if existing is not None:
            if existing.status != TransactionStatus.PENDING:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Idempotency key {request.idempotency_key!r} has already been used "
                        f"for a transaction with status {existing.status.value!r}. "
                        "Use a new idempotency key to start a fresh payment."
                    ),
                )
            # Pending dup — reconstruct and return existing session data
            if existing.gateway_response and "session_url" in existing.gateway_response:
                return self._build_session_response_from_txn(existing)

        # ── Event lookup / npo_id resolution ─────────────────────────────────
        resolved_event_id: uuid.UUID | None = None
        resolved_npo_id: uuid.UUID

        if request.event_id is not None:
            event = await self._get_event_or_404(request.event_id)
            resolved_event_id = event.id
            resolved_npo_id = event.npo_id
        elif request.npo_id is not None:
            resolved_npo_id = request.npo_id
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either event_id or npo_id must be provided.",
            )

        # ── Calculate total ───────────────────────────────────────────────────
        amount_total = self._sum_line_items(request.line_items)

        # ── Create PENDING transaction ────────────────────────────────────────
        now = datetime.now(UTC)
        txn = PaymentTransaction(
            user_id=user_id,
            npo_id=resolved_npo_id,
            event_id=resolved_event_id,
            transaction_type=TransactionType.CHARGE,
            status=TransactionStatus.PENDING,
            amount=amount_total,
            currency="USD",
            line_items={"items": [item.model_dump(mode="json") for item in request.line_items]},
            idempotency_key=request.idempotency_key,
            session_created_at=now,
        )
        self.db.add(txn)
        await self.db.flush()  # populate txn.id

        # ── Call gateway ──────────────────────────────────────────────────────
        settings = get_settings()
        webhook_url = f"{settings.stub_hpf_base_url}/api/v1/payments/webhook"

        try:
            result = await gateway.create_hosted_session(
                transaction_id=txn.id,
                amount=amount_total,
                currency="USD",
                return_url=request.return_url,
                webhook_url=webhook_url,
                save_profile=request.save_profile,
            )
        except Exception as exc:  # noqa: BLE001
            # Roll back the pending row so retry with same idempotency_key works
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Payment gateway unavailable: {exc}",
            ) from exc

        # ── Persist session data on transaction ───────────────────────────────
        txn.gateway_response = {
            "session_token": result.session_token,
            "session_url": result.session_url,
            "expires_at": result.expires_at.isoformat(),
            "gateway_transaction_id": str(result.transaction_id),
        }
        await self.db.flush()

        return PaymentSessionResponse(
            transaction_id=txn.id,
            session_token=result.session_token,
            hpf_url=result.session_url,
            expires_at=result.expires_at,
            amount_total=amount_total,
        )

    # ── US4 — Webhook handler ─────────────────────────────────────────────────

    async def handle_webhook(
        self,
        *,
        raw_body: bytes,
        signature_header: str,
        timestamp_header: str,
        payload: dict[str, Any],
        gateway: PaymentGatewayPort,
    ) -> None:
        """Process an inbound gateway IPN / webhook.

        Verifies the HMAC signature, resolves the linked ``PaymentTransaction``
        via ``order_id`` (which is our UUID), updates its status, optionally
        upserts a ``PaymentProfile``, marks any linked ``TicketPurchase`` as
        completed, and enqueues a receipt generation task.

        Raises:
            HTTPException 400: HMAC signature invalid or bad order_id.
            HTTPException 404: No transaction found for ``order_id``.
        """
        from fastapi import HTTPException
        from fastapi import status as http_status

        # ── 1. Verify HMAC ────────────────────────────────────────────────────
        valid = await gateway.verify_webhook_signature(
            raw_body=raw_body,
            signature_header=signature_header,
            timestamp_header=timestamp_header,
        )
        if not valid:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Invalid webhook HMAC signature.",
            )

        # ── 2. Resolve transaction ────────────────────────────────────────────
        order_id_raw: str = payload.get("order_id", "")
        # Strip any prefix added by the gateway (e.g., "txn_<uuid>")
        order_id_str = order_id_raw.lstrip("txn_")
        try:
            transaction_id = uuid.UUID(order_id_str)
        except ValueError:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid order_id format: {order_id_raw!r}",
            ) from None

        txn_result = await self.db.execute(
            select(PaymentTransaction).where(PaymentTransaction.id == transaction_id)
        )
        txn = txn_result.scalar_one_or_none()
        if txn is None:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"PaymentTransaction {transaction_id} not found.",
            )

        # ── 3. Idempotency — duplicate webhook ────────────────────────────────
        gateway_txn_id: str = payload.get("transaction_id", "")
        if (
            gateway_txn_id
            and txn.gateway_transaction_id
            and txn.gateway_transaction_id == gateway_txn_id
        ):
            logger.info(
                "Duplicate webhook received (already processed)",
                extra={"transaction_id": str(transaction_id), "gateway_txn_id": gateway_txn_id},
            )
            return  # idempotent no-op

        # ── 4. Map gateway status to our enum ────────────────────────────────
        gateway_status: str = payload.get("status", "").lower()
        status_map: dict[str, TransactionStatus] = {
            "approved": TransactionStatus.CAPTURED,
            "captured": TransactionStatus.CAPTURED,
            "authorized": TransactionStatus.AUTHORIZED,
            "declined": TransactionStatus.DECLINED,
            "voided": TransactionStatus.VOIDED,
            "refunded": TransactionStatus.REFUNDED,
        }
        new_status = status_map.get(gateway_status, TransactionStatus.ERROR)

        # ── 5. Update PaymentTransaction ──────────────────────────────────────
        txn.status = new_status
        if gateway_txn_id:
            txn.gateway_transaction_id = gateway_txn_id
        txn.gateway_response = {
            **(txn.gateway_response or {}),
            "webhook": {
                "event_type": payload.get("event_type"),
                "status": gateway_status,
                "auth_code": payload.get("auth_code"),
                "card_last4": payload.get("card_last4"),
                "card_brand": payload.get("card_brand"),
                "timestamp": payload.get("timestamp"),
            },
        }
        await self.db.flush()

        # ── 6. Upsert PaymentProfile ──────────────────────────────────────────
        gateway_profile_id: str | None = payload.get("profile_id")
        if gateway_profile_id and new_status == TransactionStatus.CAPTURED:
            await self._upsert_payment_profile(
                user_id=txn.user_id,
                npo_id=txn.npo_id,
                transaction_id=txn.id,
                gateway_profile_id=gateway_profile_id,
                card_last4=payload.get("card_last4", ""),
                card_brand=payload.get("card_brand", "Unknown"),
                payload=payload,
            )

        # ── 7. Update linked TicketPurchase ───────────────────────────────────
        if new_status == TransactionStatus.CAPTURED:
            await self._update_ticket_purchases(txn)

        # ── 8. Enqueue receipt generation ─────────────────────────────────────
        if new_status == TransactionStatus.CAPTURED:
            try:
                from app.tasks.payment_tasks import generate_and_send_receipt

                generate_and_send_receipt.delay(str(txn.id))
            except Exception:  # noqa: BLE001
                logger.warning(
                    "Failed to enqueue receipt task; will be retried by periodic task",
                    extra={"transaction_id": str(txn.id)},
                )

    async def _upsert_payment_profile(
        self,
        *,
        user_id: uuid.UUID,
        npo_id: uuid.UUID,
        transaction_id: uuid.UUID,
        gateway_profile_id: str,
        card_last4: str,
        card_brand: str,
        payload: dict[str, Any],
    ) -> PaymentProfile:
        """Create or refresh a PaymentProfile from webhook card data."""
        profile_result = await self.db.execute(
            select(PaymentProfile).where(
                PaymentProfile.user_id == user_id,
                PaymentProfile.npo_id == npo_id,
                PaymentProfile.gateway_profile_id == gateway_profile_id,
                PaymentProfile.deleted_at.is_(None),
            )
        )
        profile = profile_result.scalar_one_or_none()

        expiry_month: int = int(payload.get("card_expiry_month", 12))
        expiry_year: int = int(payload.get("card_expiry_year", 2099))

        if profile is None:
            default_result = await self.db.execute(
                select(PaymentProfile).where(
                    PaymentProfile.user_id == user_id,
                    PaymentProfile.npo_id == npo_id,
                    PaymentProfile.is_default.is_(True),
                    PaymentProfile.deleted_at.is_(None),
                )
            )
            has_default = default_result.scalar_one_or_none() is not None

            profile = PaymentProfile(
                user_id=user_id,
                npo_id=npo_id,
                gateway_profile_id=gateway_profile_id,
                card_last4=card_last4[-4:] if card_last4 else "0000",
                card_brand=card_brand,
                card_expiry_month=expiry_month,
                card_expiry_year=expiry_year,
                billing_name=payload.get("billing_name"),
                billing_zip=payload.get("billing_zip"),
                is_default=not has_default,
            )
            self.db.add(profile)
            logger.info(
                "PaymentProfile upserted from webhook",
                extra={"user_id": str(user_id), "npo_id": str(npo_id)},
            )
        else:
            profile.card_last4 = card_last4[-4:] if card_last4 else profile.card_last4
            profile.card_brand = card_brand or profile.card_brand
            profile.card_expiry_month = expiry_month
            profile.card_expiry_year = expiry_year

        # Link transaction to this profile
        txn_result = await self.db.execute(
            select(PaymentTransaction).where(PaymentTransaction.id == transaction_id)
        )
        txn = txn_result.scalar_one_or_none()
        if txn is not None and txn.payment_profile_id is None:
            await self.db.flush()  # give profile an id if new
            txn.payment_profile_id = profile.id

        await self.db.flush()
        return profile

    async def _update_ticket_purchases(self, txn: PaymentTransaction) -> None:
        """Mark TicketPurchase rows linked to this transaction as completed."""
        tp_result = await self.db.execute(
            select(TicketPurchase).where(
                TicketPurchase.payment_transaction_id == txn.id,
            )
        )
        purchases = tp_result.scalars().all()
        for purchase in purchases:
            purchase.payment_status = PaymentStatus.COMPLETED
            logger.info(
                "TicketPurchase marked COMPLETED via webhook",
                extra={"purchase_id": str(purchase.id), "transaction_id": str(txn.id)},
            )
        await self.db.flush()

    # ── T048 / US6 — Direct profile charge ───────────────────────────────────

    async def charge_profile(
        self,
        *,
        user_id: uuid.UUID,
        npo_id: uuid.UUID,
        event_id: uuid.UUID | None,
        payment_profile_id: uuid.UUID,
        line_items: list[LineItemSchema],
        idempotency_key: str,
        gateway: PaymentGatewayPort,
        initiated_by: uuid.UUID | None = None,
        reason: str | None = None,
    ) -> PaymentTransaction:
        """Charge a stored payment profile directly (no HPF session).

        Used by:
          - ``CheckoutService.charge()`` — donor self-checkout (US5 / T043)
          - Admin force-charge endpoint (US6 / T049)

        Idempotency: raises 409 if a non-pending transaction with the same key exists.

        Returns the newly created (and committed) ``PaymentTransaction``.

        Raises:
            HTTPException 404: Profile not found.
            HTTPException 403: Profile belongs to a different user/NPO.
            HTTPException 409: Duplicate idempotency key.
            HTTPException 502: Gateway charge failed.
        """
        from fastapi import HTTPException
        from fastapi import status as http_status

        # ── Idempotency ────────────────────────────────────────────────────────
        existing = await self._find_by_idempotency_key(idempotency_key)
        if existing is not None:
            if existing.status in (TransactionStatus.CAPTURED, TransactionStatus.PENDING):
                return existing
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Duplicate idempotency key with a non-retryable transaction",
            )

        # ── Load payment profile ──────────────────────────────────────────────
        profile_result = await self.db.execute(
            select(PaymentProfile).where(PaymentProfile.id == payment_profile_id)
        )
        profile: PaymentProfile | None = profile_result.scalar_one_or_none()
        if profile is None:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Payment profile not found",
            )
        if profile.user_id != user_id or profile.npo_id != npo_id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Payment profile does not belong to this user/NPO",
            )

        # ── Compute total ─────────────────────────────────────────────────────
        total = self._sum_line_items(line_items)

        # ── Create PENDING transaction first (idempotency anchor) ─────────────
        txn = PaymentTransaction(
            npo_id=npo_id,
            event_id=event_id,
            user_id=user_id,
            payment_profile_id=payment_profile_id,
            transaction_type=TransactionType.CHARGE,
            status=TransactionStatus.PENDING,
            amount=total,
            currency="USD",
            line_items=[li.model_dump(mode="json") for li in line_items],
            idempotency_key=idempotency_key,
            initiated_by=initiated_by,
            reason=reason,
        )
        self.db.add(txn)
        await self.db.flush()  # get txn.id

        # ── Call gateway ──────────────────────────────────────────────────────
        try:
            result = await gateway.charge_profile(
                transaction_id=txn.id,
                gateway_profile_id=profile.gateway_profile_id,
                amount=total,
                currency="USD",
                idempotency_key=idempotency_key,
            )
        except Exception as exc:
            txn.status = TransactionStatus.ERROR
            txn.gateway_response = {"error": str(exc)}
            await self.db.commit()
            logger.error(
                "Gateway charge_profile failed",
                extra={"transaction_id": str(txn.id), "error": str(exc)},
            )
            raise HTTPException(
                status_code=http_status.HTTP_502_BAD_GATEWAY,
                detail=f"Payment gateway error: {exc}",
            ) from exc

        # ── Update transaction status ─────────────────────────────────────────
        if result.status == "approved":
            txn.status = TransactionStatus.CAPTURED
        else:
            txn.status = TransactionStatus.DECLINED

        txn.gateway_transaction_id = result.gateway_transaction_id
        txn.gateway_response = result.raw_response or {}

        await self.db.commit()
        await self.db.refresh(txn)

        # ── Enqueue receipt if captured ───────────────────────────────────────
        if txn.status == TransactionStatus.CAPTURED:
            from app.tasks.payment_tasks import generate_and_send_receipt

            try:
                generate_and_send_receipt.delay(str(txn.id))
            except Exception as e:
                logger.warning(
                    "Could not enqueue receipt task",
                    extra={"transaction_id": str(txn.id), "error": str(e)},
                )

        return txn

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _find_by_idempotency_key(self, idempotency_key: str) -> PaymentTransaction | None:
        result = await self.db.execute(
            select(PaymentTransaction).where(PaymentTransaction.idempotency_key == idempotency_key)
        )
        return result.scalar_one_or_none()

    async def _get_event_or_404(self, event_id: uuid.UUID) -> Event:
        from fastapi import HTTPException, status

        result = await self.db.execute(select(Event).where(Event.id == event_id))
        event = result.scalar_one_or_none()
        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event {event_id} not found",
            )
        return event

    @staticmethod
    def _sum_line_items(line_items: list[LineItemSchema]) -> Decimal:
        return sum((item.amount for item in line_items), Decimal("0.00"))

    @staticmethod
    def _build_session_response_from_txn(txn: PaymentTransaction) -> PaymentSessionResponse:
        """Reconstruct a PaymentSessionResponse from a cached PENDING transaction."""
        raw = txn.gateway_response or {}
        expires_at_str = raw.get("expires_at", datetime.now(UTC).isoformat())
        return PaymentSessionResponse(
            transaction_id=txn.id,
            session_token=raw.get("session_token", ""),
            hpf_url=raw.get("session_url", ""),
            expires_at=datetime.fromisoformat(expires_at_str),
            amount_total=txn.amount,
        )

    # ── Void / Refund ─────────────────────────────────────────────────────────

    async def void_transaction(
        self,
        *,
        transaction_id: uuid.UUID,
        gateway: PaymentGatewayPort,
        initiated_by: uuid.UUID,
        reason: str,
    ) -> PaymentTransaction:
        """Void a CAPTURED transaction (before settlement).

        Creates a new child transaction with status=VOIDED and updates
        the original transaction status.

        Raises:
            HTTPException 404: Transaction not found.
            HTTPException 422: Transaction is not voidable (already voided/refunded/declined).
            HTTPException 502: Gateway void call failed.
        """
        from fastapi import HTTPException
        from fastapi import status as http_status

        txn_result = await self.db.execute(
            select(PaymentTransaction).where(PaymentTransaction.id == transaction_id)
        )
        txn: PaymentTransaction | None = txn_result.scalar_one_or_none()
        if txn is None:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )
        if txn.status not in (TransactionStatus.CAPTURED, TransactionStatus.AUTHORIZED):
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Transaction cannot be voided in status '{txn.status.value}'",
            )
        if txn.gateway_transaction_id is None:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Transaction has no gateway reference; cannot void",
            )

        result = await gateway.void_transaction(
            gateway_transaction_id=txn.gateway_transaction_id,
            reason=reason,
        )

        # Update original transaction
        txn.status = TransactionStatus.VOIDED
        txn.reason = f"{txn.reason or ''}; VOIDED: {reason}".strip("; ")

        # Create void child record
        void_txn = PaymentTransaction(
            npo_id=txn.npo_id,
            event_id=txn.event_id,
            user_id=txn.user_id,
            payment_profile_id=txn.payment_profile_id,
            transaction_type=TransactionType.VOID,
            status=TransactionStatus.VOIDED,
            amount=txn.amount,
            currency=txn.currency,
            gateway_transaction_id=result.gateway_transaction_id,
            gateway_response=result.raw_response or {},
            parent_transaction_id=txn.id,
            initiated_by=initiated_by,
            reason=reason,
        )
        self.db.add(void_txn)
        await self.db.commit()
        await self.db.refresh(void_txn)
        return void_txn

    async def refund_transaction(
        self,
        *,
        transaction_id: uuid.UUID,
        amount: Decimal,
        gateway: PaymentGatewayPort,
        initiated_by: uuid.UUID,
        reason: str,
    ) -> PaymentTransaction:
        """Issue a full or partial refund on a CAPTURED transaction.

        Creates a new child REFUND transaction.  If the refund amount equals
        the original, the parent is marked REFUNDED; partial refunds leave the
        parent as CAPTURED.

        Raises:
            HTTPException 404: Transaction not found.
            HTTPException 422: Transaction is not refundable, or amount exceeds original.
            HTTPException 502: Gateway refund call failed.
        """
        from fastapi import HTTPException
        from fastapi import status as http_status

        txn_result = await self.db.execute(
            select(PaymentTransaction).where(PaymentTransaction.id == transaction_id)
        )
        txn: PaymentTransaction | None = txn_result.scalar_one_or_none()
        if txn is None:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )
        if txn.status != TransactionStatus.CAPTURED:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Transaction cannot be refunded in status '{txn.status.value}'",
            )
        if amount > txn.amount:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Refund amount ({amount}) exceeds original amount ({txn.amount})",
            )
        if txn.gateway_transaction_id is None:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Transaction has no gateway reference; cannot refund",
            )

        result = await gateway.refund_transaction(
            gateway_transaction_id=txn.gateway_transaction_id,
            amount=amount,
            reason=reason,
        )

        # Mark parent as REFUNDED if full amount
        if amount >= txn.amount:
            txn.status = TransactionStatus.REFUNDED

        # Create refund child record
        refund_txn = PaymentTransaction(
            npo_id=txn.npo_id,
            event_id=txn.event_id,
            user_id=txn.user_id,
            payment_profile_id=txn.payment_profile_id,
            transaction_type=TransactionType.REFUND,
            status=TransactionStatus.REFUNDED,
            amount=amount,
            currency=txn.currency,
            gateway_transaction_id=result.gateway_transaction_id,
            gateway_response=result.raw_response or {},
            parent_transaction_id=txn.id,
            initiated_by=initiated_by,
            reason=reason,
        )
        self.db.add(refund_txn)
        await self.db.commit()
        await self.db.refresh(refund_txn)
        return refund_txn
