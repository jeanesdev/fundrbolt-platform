"""CheckoutService — end-of-night donor self-checkout and admin manual charge.

Responsibilities
────────────────
* Aggregate a donor's outstanding balance for an event (auction wins,
  quick-entry bids/donations, unpaid tickets).
* Compute the payment-processing fee if the donor elects to cover it.
* Drive a charge through PaymentTransactionService, returning a typed response.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.auction_bid import AuctionBid
from app.models.event import Event
from app.models.payment_transaction import PaymentTransaction, TransactionStatus
from app.models.quick_entry_bid import QuickEntryBid, QuickEntryBidStatus
from app.models.quick_entry_donation import QuickEntryDonation
from app.models.ticket_management import PaymentStatus, TicketPurchase
from app.schemas.payment import (
    CheckoutBalanceResponse,
    CheckoutResponse,
    LineItemSchema,
)
from app.services.payment_gateway.port import PaymentGatewayPort
from app.services.payment_transaction_service import PaymentTransactionService

_settings = get_settings()


class CheckoutError(Exception):
    """Domain error for checkout-specific failures."""


class CheckoutNotOpenError(CheckoutError):
    """Raised when checkout is not open for the event."""


class ZeroBalanceError(CheckoutError):
    """Raised when the donor has no outstanding balance to charge."""


class CheckoutService:
    """Aggregate outstanding donor balance and execute end-of-night charge."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ──────────────────────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────────────────────

    async def aggregate_balance(
        self, user_id: uuid.UUID, event_id: uuid.UUID
    ) -> CheckoutBalanceResponse:
        """Return a breakdown of the donor's outstanding balance for an event.

        The caller must be the donor (user_id) or an admin acting on their
        behalf.  All monetary values are USD Decimal dollars.
        """
        line_items: list[LineItemSchema] = []

        # ── Winning auction bids ───────────────────────────────────────────
        bid_stmt = (
            select(AuctionBid)
            .where(
                AuctionBid.user_id == user_id,
                AuctionBid.event_id == event_id,
                AuctionBid.bid_status == "winning",
                AuctionBid.transaction_status == "pending",
            )
            .options(selectinload(AuctionBid.auction_item))
        )
        bid_result = await self.db.execute(bid_stmt)
        for bid in bid_result.scalars().all():
            label = (
                bid.auction_item.title
                if bid.auction_item
                else f"Auction item #{bid.auction_item_id}"
            )
            line_items.append(
                LineItemSchema(
                    type="auction_win",
                    label=label,
                    amount=bid.bid_amount,
                )
            )

        # ── Quick-entry paddle-raise donations ─────────────────────────────
        qe_donation_stmt = select(QuickEntryDonation).where(
            QuickEntryDonation.donor_user_id == user_id,
            QuickEntryDonation.event_id == event_id,
        )
        qe_donation_result = await self.db.execute(qe_donation_stmt)
        for donation in qe_donation_result.scalars().all():
            line_items.append(
                LineItemSchema(
                    type="donation",
                    label="Paddle raise donation",
                    # amount is stored as whole dollars (integer)
                    amount=Decimal(donation.amount),
                )
            )

        # ── Quick-entry live bids ──────────────────────────────────────────
        qe_bid_stmt = select(QuickEntryBid).where(
            QuickEntryBid.donor_user_id == user_id,
            QuickEntryBid.event_id == event_id,
            QuickEntryBid.status != QuickEntryBidStatus.DELETED,
        )
        qe_bid_result = await self.db.execute(qe_bid_stmt)
        for qe_bid in qe_bid_result.scalars().all():
            line_items.append(
                LineItemSchema(
                    type="donation",
                    label="Live auction bid",
                    amount=Decimal(qe_bid.amount),
                )
            )

        # ── Unpaid ticket purchases ────────────────────────────────────────
        ticket_stmt = select(TicketPurchase).where(
            TicketPurchase.user_id == user_id,
            TicketPurchase.event_id == event_id,
            TicketPurchase.payment_status == PaymentStatus.PENDING,
        )
        ticket_result = await self.db.execute(ticket_stmt)
        for ticket in ticket_result.scalars().all():
            line_items.append(
                LineItemSchema(
                    type="ticket",
                    label="Ticket purchase",
                    amount=ticket.total_price,
                )
            )

        # ── Subtract already-captured amounts ─────────────────────────────
        paid_stmt = select(
            PaymentTransaction.amount,
        ).where(
            PaymentTransaction.user_id == user_id,
            PaymentTransaction.event_id == event_id,
            PaymentTransaction.status == TransactionStatus.CAPTURED,
        )
        paid_result = await self.db.execute(paid_stmt)
        already_paid: Decimal = sum(
            (row[0] for row in paid_result.all()),
            Decimal("0"),
        )

        gross_total: Decimal = sum((item.amount for item in line_items), Decimal("0"))
        total_balance = max(gross_total - already_paid, Decimal("0"))
        processing_fee = self.compute_processing_fee(total_balance)

        return CheckoutBalanceResponse(
            event_id=event_id,
            user_id=user_id,
            total_balance=total_balance,
            line_items=line_items,
            processing_fee=processing_fee,
            total_with_fee=(total_balance + processing_fee).quantize(Decimal("0.01")),
        )

    def compute_processing_fee(self, subtotal: Decimal) -> Decimal:
        """Return the Stripe-style processing fee for a given subtotal.

        Formula: (subtotal × fee_pct) + flat_fee_dollars
        Default: 2.9% + $0.30
        """
        fee_pct = Decimal(str(_settings.payment_processing_fee_pct))
        flat_dollars = Decimal(_settings.payment_processing_fee_flat_cents) / Decimal("100")
        return (subtotal * fee_pct + flat_dollars).quantize(Decimal("0.01"))

    async def checkout(
        self,
        *,
        user_id: uuid.UUID,
        event_id: uuid.UUID,
        payment_profile_id: uuid.UUID,
        cover_fee: bool = False,
        idempotency_key: str,
        gateway: PaymentGatewayPort,
        initiated_by: uuid.UUID | None = None,
        reason: str | None = None,
    ) -> CheckoutResponse:
        """Execute end-of-night checkout for a donor.

        Security: the balance is always re-derived from the database
        (never trusted from the frontend payload).

        Raises:
            CheckoutNotOpenError: If the event's checkout window is closed.
            ZeroBalanceError: If the donor has no outstanding balance.
            HTTPException: Profile/ownership validation failure propagated from
                PaymentTransactionService.
        """
        # Load event and verify checkout is open
        event_stmt = select(Event).where(Event.id == event_id)
        event_result = await self.db.execute(event_stmt)
        event = event_result.scalar_one_or_none()
        if event is None or not event.checkout_open:
            raise CheckoutNotOpenError("Checkout is not currently open for this event.")

        # Re-derive balance from DB (ignores frontend line_items for security)
        balance = await self.aggregate_balance(user_id, event_id)

        subtotal = balance.total_balance
        line_items = list(balance.line_items)

        if cover_fee and subtotal > Decimal("0"):
            fee = self.compute_processing_fee(subtotal)
            line_items.append(
                LineItemSchema(
                    type="fee_coverage",
                    label="Payment processing fee",
                    amount=fee,
                )
            )
            total = subtotal + fee
        else:
            total = subtotal

        total = total.quantize(Decimal("0.01"))

        if total == Decimal("0"):
            raise ZeroBalanceError("No outstanding balance to charge.")

        txn_service = PaymentTransactionService(self.db)
        txn = await txn_service.charge_profile(
            user_id=user_id,
            npo_id=event.npo_id,
            event_id=event_id,
            payment_profile_id=payment_profile_id,
            line_items=line_items,
            idempotency_key=idempotency_key,
            gateway=gateway,
            initiated_by=initiated_by,
            reason=reason or "Donor self-checkout",
        )
        return self._txn_to_checkout_response(txn)

    # ──────────────────────────────────────────────────────────────────────────
    # Private helpers
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _txn_to_checkout_response(txn: PaymentTransaction) -> CheckoutResponse:
        """Map a ``PaymentTransaction`` ORM object to the API response schema."""
        status_map = {
            TransactionStatus.CAPTURED: "approved",
            TransactionStatus.DECLINED: "declined",
            TransactionStatus.PENDING: "pending",
        }
        raw = txn.gateway_response or {}
        is_approved = txn.status == TransactionStatus.CAPTURED
        return CheckoutResponse(
            transaction_id=txn.id,
            status=status_map.get(txn.status, txn.status.value),
            amount_charged=txn.amount,
            gateway_transaction_id=txn.gateway_transaction_id,
            decline_reason=raw.get("decline_reason"),
            # Receipt email is always queued async after a successful charge
            receipt_pending=is_approved,
        )

    async def admin_charge(
        self,
        *,
        user_id: uuid.UUID,
        npo_id: uuid.UUID,
        event_id: uuid.UUID | None,
        payment_profile_id: uuid.UUID,
        line_items: list[LineItemSchema],
        total_amount: Decimal,
        idempotency_key: str | None,
        gateway: PaymentGatewayPort,
        initiated_by: uuid.UUID,
        reason: str,
    ) -> CheckoutResponse:
        """Admin-initiated manual charge with explicit line_items/amount.

        Unlike donor self-checkout, admin charges trust the provided
        line_items / total_amount (admin is authenticated + has checked role).
        """
        effective_npo_id = npo_id
        if event_id:
            event_stmt = select(Event).where(Event.id == event_id)
            event_result = await self.db.execute(event_stmt)
            event = event_result.scalar_one_or_none()
            if event:
                effective_npo_id = event.npo_id

        ikey = idempotency_key or f"admin-{initiated_by}-{user_id}-{total_amount}"

        txn_service = PaymentTransactionService(self.db)
        txn = await txn_service.charge_profile(
            user_id=user_id,
            npo_id=effective_npo_id,
            event_id=event_id,
            payment_profile_id=payment_profile_id,
            line_items=line_items,
            idempotency_key=ikey,
            gateway=gateway,
            initiated_by=initiated_by,
            reason=reason,
        )
        return self._txn_to_checkout_response(txn)
