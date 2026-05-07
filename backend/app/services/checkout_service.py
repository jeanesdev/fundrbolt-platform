"""CheckoutService — end-of-night donor self-checkout and admin manual charge.

Responsibilities
────────────────
* Aggregate a donor's outstanding balance for an event (auction wins,
  quick-entry bids/donations, unpaid tickets).
* Compute the payment-processing fee if the donor elects to cover it.
* Drive a charge through PaymentTransactionService, returning a typed response.
* Manage checkout sessions, items, and admin adjustments (feature 044).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.auction_bid import AuctionBid
from app.models.checkout_configuration import CheckoutConfiguration
from app.models.checkout_session import (
    CheckoutAuditActionEnum,
    CheckoutAuditLog,
    CheckoutItem,
    CheckoutItemSourceTypeEnum,
    CheckoutPaymentMethodEnum,
    CheckoutSession,
    CheckoutStatusEnum,
)
from app.models.event import Event
from app.models.payment_transaction import PaymentTransaction, TransactionStatus
from app.models.quick_entry_bid import QuickEntryBid, QuickEntryBidStatus
from app.models.quick_entry_donation import QuickEntryDonation
from app.models.revenue_generator_entry import RevenueGeneratorEntry
from app.models.ticket_management import PaymentStatus, TicketPurchase
from app.schemas.checkout import AdminAddCheckoutItemRequest, CheckoutConfirmRequest
from app.schemas.payment import (
    CheckoutBalanceResponse,
    CheckoutResponse,
    LineItemSchema,
)
from app.services.payment_gateway.port import PaymentGatewayPort
from app.services.payment_transaction_service import PaymentTransactionService

logger = get_logger(__name__)

_settings = get_settings()


class ItemsChangedError(Exception):
    """Raised when donor has not acknowledged updated items at checkout confirm."""


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

    # ── Feature 044: Session-based checkout methods ───────────────────────────

    async def get_or_create_session(
        self, user_id: uuid.UUID, event_id: uuid.UUID
    ) -> CheckoutSession:
        """Get or create a checkout session for a donor at an event.

        If a new session is created, populates it with outstanding balance items
        and recalculates totals.
        """
        result = await self.db.execute(
            select(CheckoutSession)
            .where(
                CheckoutSession.event_id == event_id,
                CheckoutSession.user_id == user_id,
            )
            .options(selectinload(CheckoutSession.items))
        )
        session = result.scalar_one_or_none()

        if session is None:
            session = CheckoutSession(
                event_id=event_id,
                user_id=user_id,
                status=CheckoutStatusEnum.NOT_STARTED,
                cover_processing_fee=True,
                auctioneer_tip_cents=5000,
                platform_tip_cents=0,
            )
            self.db.add(session)
            await self.db.flush()
            await self.build_checkout_items_from_balance(session)
            await self.recalculate_totals(session)
        else:
            # Refresh item names from source records so donors always see the
            # current item name even if the session was created before names
            # were populated (e.g. sessions created with generic fallbacks).
            await self._refresh_item_names(session)

        return session

    async def update_session(
        self,
        session_id: uuid.UUID,
        *,
        payment_method: str | None = None,
        cover_processing_fee: bool | None = None,
        auctioneer_tip_cents: int | None = None,
        platform_tip_cents: int | None = None,
    ) -> CheckoutSession:
        """Update session preferences and recalculate totals."""
        result = await self.db.execute(
            select(CheckoutSession)
            .where(CheckoutSession.id == session_id)
            .options(selectinload(CheckoutSession.items))
        )
        session = result.scalar_one()

        if payment_method is not None:
            session.payment_method = CheckoutPaymentMethodEnum(payment_method)
        if cover_processing_fee is not None:
            session.cover_processing_fee = cover_processing_fee
        if auctioneer_tip_cents is not None:
            session.auctioneer_tip_cents = auctioneer_tip_cents
        if platform_tip_cents is not None:
            session.platform_tip_cents = platform_tip_cents

        if session.status == CheckoutStatusEnum.NOT_STARTED:
            session.status = CheckoutStatusEnum.IN_PROGRESS

        await self.recalculate_totals(session)
        return session

    async def build_checkout_items_from_balance(self, session: CheckoutSession) -> None:
        """Populate a new checkout session with the donor's outstanding balance items."""
        event_id = session.event_id
        user_id = session.user_id
        display_order = 0

        # ── Winning auction bids ──────────────────────────────────────────────
        bid_result = await self.db.execute(
            select(AuctionBid)
            .where(
                AuctionBid.user_id == user_id,
                AuctionBid.event_id == event_id,
                AuctionBid.bid_status == "winning",
                AuctionBid.transaction_status == "pending",
            )
            .options(selectinload(AuctionBid.auction_item))
        )
        for bid in bid_result.scalars().all():
            label = (
                bid.auction_item.title
                if bid.auction_item
                else f"Auction item #{bid.auction_item_id}"
            )
            amount_cents = int(bid.bid_amount * 100)
            item = CheckoutItem(
                session_id=session.id,
                name=label,
                original_amount_cents=amount_cents,
                source_type=CheckoutItemSourceTypeEnum.AUCTION_WIN,
                source_id=bid.id,
                display_order=display_order,
            )
            self.db.add(item)
            display_order += 1

        # ── Quick-entry paddle-raise donations ────────────────────────────────
        qe_donation_result = await self.db.execute(
            select(QuickEntryDonation).where(
                QuickEntryDonation.donor_user_id == user_id,
                QuickEntryDonation.event_id == event_id,
            )
        )
        for donation in qe_donation_result.scalars().all():
            amount_cents = int(donation.amount * 100)
            item = CheckoutItem(
                session_id=session.id,
                name="Paddle raise donation",
                original_amount_cents=amount_cents,
                source_type=CheckoutItemSourceTypeEnum.QUICK_ENTRY_DONATION,
                source_id=donation.id,
                display_order=display_order,
            )
            self.db.add(item)
            display_order += 1

        # ── Quick-entry live bids ─────────────────────────────────────────────
        qe_bid_result = await self.db.execute(
            select(QuickEntryBid)
            .where(
                QuickEntryBid.donor_user_id == user_id,
                QuickEntryBid.event_id == event_id,
                QuickEntryBid.status != QuickEntryBidStatus.DELETED,
            )
            .options(selectinload(QuickEntryBid.item))
        )
        for qe_bid in qe_bid_result.scalars().all():
            amount_cents = int(qe_bid.amount * 100)
            name = qe_bid.item.title if qe_bid.item else "Live auction bid"
            item = CheckoutItem(
                session_id=session.id,
                name=name,
                original_amount_cents=amount_cents,
                source_type=CheckoutItemSourceTypeEnum.QUICK_ENTRY_BID,
                source_id=qe_bid.id,
                display_order=display_order,
            )
            self.db.add(item)
            display_order += 1

        # ── Unpaid ticket purchases ───────────────────────────────────────────
        ticket_result = await self.db.execute(
            select(TicketPurchase)
            .where(
                TicketPurchase.user_id == user_id,
                TicketPurchase.event_id == event_id,
                TicketPurchase.payment_status == PaymentStatus.PENDING,
            )
            .options(selectinload(TicketPurchase.ticket_package))
        )
        for ticket in ticket_result.scalars().all():
            amount_cents = int(ticket.total_price * 100)
            name = ticket.ticket_package.name if ticket.ticket_package else "Ticket purchase"
            item = CheckoutItem(
                session_id=session.id,
                name=name,
                original_amount_cents=amount_cents,
                source_type=CheckoutItemSourceTypeEnum.TICKET,
                source_id=ticket.id,
                display_order=display_order,
            )
            self.db.add(item)
            display_order += 1

        # ── Revenue generator entries ─────────────────────────────────────────
        rg_result = await self.db.execute(
            select(RevenueGeneratorEntry)
            .where(
                RevenueGeneratorEntry.event_id == event_id,
            )
            .options(selectinload(RevenueGeneratorEntry.item))
        )
        for rg_entry in rg_result.scalars().all():
            amount_cents = int(rg_entry.amount_paid * 100)
            name = rg_entry.item.name if rg_entry.item else "Revenue generator entry"
            item = CheckoutItem(
                session_id=session.id,
                name=name,
                original_amount_cents=amount_cents,
                source_type=CheckoutItemSourceTypeEnum.REVENUE_GENERATOR,
                source_id=rg_entry.id,
                display_order=display_order,
            )
            self.db.add(item)
            display_order += 1

        await self.db.flush()

    async def _refresh_item_names(self, session: CheckoutSession) -> None:
        """Update item names from their source records.

        Called for existing sessions so that names always reflect the current
        source record (auction item title, ticket package name, etc.) rather
        than a stale generic label stored when the session was first built.
        Only non-MANUAL items are refreshed; admin-added items keep their names.
        """
        # Gather items by source type that can be looked up
        items_by_source: dict[CheckoutItemSourceTypeEnum, list[CheckoutItem]] = {}
        for item in session.items:
            if item.source_id is None or item.source_type in (CheckoutItemSourceTypeEnum.MANUAL,):
                continue
            items_by_source.setdefault(item.source_type, []).append(item)

        if not items_by_source:
            return

        # ── Auction wins ──────────────────────────────────────────────────────
        if CheckoutItemSourceTypeEnum.AUCTION_WIN in items_by_source:
            src_ids = [i.source_id for i in items_by_source[CheckoutItemSourceTypeEnum.AUCTION_WIN]]
            bid_result = await self.db.execute(
                select(AuctionBid)
                .where(AuctionBid.id.in_(src_ids))
                .options(selectinload(AuctionBid.auction_item))
            )
            bid_map = {b.id: b for b in bid_result.scalars().all()}
            for ci in items_by_source[CheckoutItemSourceTypeEnum.AUCTION_WIN]:
                bid = bid_map.get(ci.source_id) if ci.source_id is not None else None
                if bid and bid.auction_item:
                    ci.name = bid.auction_item.title

        # ── Quick-entry bids ──────────────────────────────────────────────────
        if CheckoutItemSourceTypeEnum.QUICK_ENTRY_BID in items_by_source:
            src_ids = [
                i.source_id for i in items_by_source[CheckoutItemSourceTypeEnum.QUICK_ENTRY_BID]
            ]
            qe_result = await self.db.execute(
                select(QuickEntryBid)
                .where(QuickEntryBid.id.in_(src_ids))
                .options(selectinload(QuickEntryBid.item))
            )
            qe_map = {q.id: q for q in qe_result.scalars().all()}
            for ci in items_by_source[CheckoutItemSourceTypeEnum.QUICK_ENTRY_BID]:
                qe_bid = qe_map.get(ci.source_id) if ci.source_id is not None else None
                if qe_bid and qe_bid.item:
                    ci.name = qe_bid.item.title

        # ── Ticket purchases ──────────────────────────────────────────────────
        if CheckoutItemSourceTypeEnum.TICKET in items_by_source:
            src_ids = [i.source_id for i in items_by_source[CheckoutItemSourceTypeEnum.TICKET]]
            ticket_result = await self.db.execute(
                select(TicketPurchase)
                .where(TicketPurchase.id.in_(src_ids))
                .options(selectinload(TicketPurchase.ticket_package))
            )
            ticket_map = {t.id: t for t in ticket_result.scalars().all()}
            for ci in items_by_source[CheckoutItemSourceTypeEnum.TICKET]:
                ticket = ticket_map.get(ci.source_id) if ci.source_id is not None else None
                if ticket and ticket.ticket_package:
                    ci.name = ticket.ticket_package.name

        # ── Revenue generator entries ─────────────────────────────────────────
        if CheckoutItemSourceTypeEnum.REVENUE_GENERATOR in items_by_source:
            src_ids = [
                i.source_id for i in items_by_source[CheckoutItemSourceTypeEnum.REVENUE_GENERATOR]
            ]
            rg_result = await self.db.execute(
                select(RevenueGeneratorEntry)
                .where(RevenueGeneratorEntry.id.in_(src_ids))
                .options(selectinload(RevenueGeneratorEntry.item))
            )
            rg_map = {r.id: r for r in rg_result.scalars().all()}
            for ci in items_by_source[CheckoutItemSourceTypeEnum.REVENUE_GENERATOR]:
                rg_entry = rg_map.get(ci.source_id) if ci.source_id is not None else None
                if rg_entry and rg_entry.item:
                    ci.name = rg_entry.item.name

    async def recalculate_totals(self, session: CheckoutSession) -> None:
        """Recalculate subtotal, processing fee, and total for a session."""
        # Always reload items explicitly to avoid lazy-loading in async context
        result = await self.db.execute(
            select(CheckoutItem).where(
                CheckoutItem.session_id == session.id,
                CheckoutItem.deleted_at.is_(None),
            )
        )
        active_items = list(result.scalars().all())

        subtotal = sum(i.effective_amount_cents for i in active_items)
        session.subtotal_cents = subtotal

        # Compute processing fee from checkout configuration
        fee_cents = 0
        if session.cover_processing_fee and subtotal > 0:
            config_result = await self.db.execute(
                select(CheckoutConfiguration).where(
                    CheckoutConfiguration.event_id == session.event_id
                )
            )
            config = config_result.scalar_one_or_none()
            if config and config.processing_fee_rate is not None:
                fee = Decimal(subtotal) * config.processing_fee_rate
                fee_cents = int(fee.to_integral_value())

        session.processing_fee_cents = fee_cents
        session.total_cents = (
            subtotal + fee_cents + session.auctioneer_tip_cents + session.platform_tip_cents
        )

    async def confirm_checkout(
        self,
        session_id: uuid.UUID,
        request: CheckoutConfirmRequest,
    ) -> CheckoutSession:
        """Confirm/complete checkout for a session.

        Validates that the donor has acknowledged any item changes.
        Stubs payment processing (marks as complete).
        """
        result = await self.db.execute(
            select(CheckoutSession)
            .where(CheckoutSession.id == session_id)
            .options(selectinload(CheckoutSession.items))
        )
        session = result.scalar_one()

        # Validate items_updated_at acknowledgement
        if session.items_updated_at is not None:
            if request.acknowledged_items_updated_at is None:
                raise ItemsChangedError(
                    "Items have been updated. Please acknowledge the changes before confirming."
                )
            if request.acknowledged_items_updated_at < session.items_updated_at:
                raise ItemsChangedError(
                    "Acknowledged timestamp is older than the latest items update."
                )

        if request.payment_method:
            session.payment_method = CheckoutPaymentMethodEnum(request.payment_method)

        # Stub payment processing — mark as complete
        session.status = CheckoutStatusEnum.COMPLETE
        session.completed_at = datetime.now(UTC)

        return session

    # ── Admin item management ─────────────────────────────────────────────────

    async def admin_add_item(
        self,
        session_id: uuid.UUID,
        admin_user_id: uuid.UUID,
        data: AdminAddCheckoutItemRequest,
    ) -> CheckoutItem:
        """Add a line item to a checkout session (admin only)."""
        # Get current max display_order
        items_result = await self.db.execute(
            select(CheckoutItem).where(
                CheckoutItem.session_id == session_id,
                CheckoutItem.deleted_at.is_(None),
            )
        )
        existing = list(items_result.scalars().all())
        next_order = max((i.display_order for i in existing), default=-1) + 1

        item = CheckoutItem(
            session_id=session_id,
            name=data.name,
            description=data.description,
            original_amount_cents=data.original_amount_cents,
            source_type=CheckoutItemSourceTypeEnum(data.source_type),
            display_order=next_order,
        )
        self.db.add(item)
        await self.db.flush()

        # Write audit log
        audit = CheckoutAuditLog(
            session_id=session_id,
            admin_user_id=admin_user_id,
            action=CheckoutAuditActionEnum.ITEM_ADDED,
            item_id=item.id,
            after_value=str(data.original_amount_cents),
        )
        self.db.add(audit)

        # Update session items_updated_at and recalculate
        session = await self._load_session_with_items(session_id)
        session.items_updated_at = datetime.now(UTC)
        await self.recalculate_totals(session)

        return item

    async def admin_reprice_item(
        self,
        session_id: uuid.UUID,
        item_id: uuid.UUID,
        admin_user_id: uuid.UUID,
        new_amount_cents: int,
    ) -> CheckoutItem:
        """Update the adjusted price of a checkout item (admin only)."""
        result = await self.db.execute(select(CheckoutItem).where(CheckoutItem.id == item_id))
        item = result.scalar_one()

        old_value = str(item.adjusted_amount_cents)
        item.adjusted_amount_cents = new_amount_cents

        audit = CheckoutAuditLog(
            session_id=session_id,
            admin_user_id=admin_user_id,
            action=CheckoutAuditActionEnum.ITEM_REPRICED,
            item_id=item_id,
            field_changed="adjusted_amount_cents",
            before_value=old_value,
            after_value=str(new_amount_cents),
        )
        self.db.add(audit)

        session = await self._load_session_with_items(session_id)
        session.items_updated_at = datetime.now(UTC)
        await self.recalculate_totals(session)

        return item

    async def admin_remove_item(
        self,
        session_id: uuid.UUID,
        item_id: uuid.UUID,
        admin_user_id: uuid.UUID,
    ) -> CheckoutItem:
        """Soft-delete a checkout item (admin only)."""
        result = await self.db.execute(select(CheckoutItem).where(CheckoutItem.id == item_id))
        item = result.scalar_one()
        item.deleted_at = datetime.now(UTC)

        audit = CheckoutAuditLog(
            session_id=session_id,
            admin_user_id=admin_user_id,
            action=CheckoutAuditActionEnum.ITEM_REMOVED,
            item_id=item_id,
            before_value=str(item.original_amount_cents),
        )
        self.db.add(audit)

        session = await self._load_session_with_items(session_id)
        session.items_updated_at = datetime.now(UTC)
        await self.recalculate_totals(session)

        return item

    async def _load_session_with_items(self, session_id: uuid.UUID) -> CheckoutSession:
        """Load a checkout session with its items eagerly."""
        result = await self.db.execute(
            select(CheckoutSession)
            .where(CheckoutSession.id == session_id)
            .options(selectinload(CheckoutSession.items))
        )
        return result.scalar_one()
