"""Service for ticket purchasing: cart validation, checkout, and sponsorship linking."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.sponsor import Sponsor
from app.models.ticket_management import (
    AssignedTicket,
    DiscountType,
    PaymentStatus,
    PromoCode,
    PromoCodeApplication,
    TicketAuditLog,
    TicketPackage,
    TicketPurchase,
)
from app.models.user import User
from app.schemas.ticket_purchasing import (
    CartItem,
    CartItemValidation,
    CartValidationResponse,
    CheckoutRequest,
    CheckoutResponse,
    PurchaseSummary,
    SponsorshipDetails,
)

logger = logging.getLogger(__name__)


class TicketPurchasingService:
    """Service layer for donor ticket purchasing flows.

    All public methods accept an open AsyncSession — commit responsibility
    sits with the calling endpoint (unit-of-work pattern).
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Cart validation ───────────────────────────────────────────────────────

    async def validate_cart(
        self,
        event_id: uuid.UUID,
        items: list[CartItem],
        promo_code: str | None,
        user_id: uuid.UUID,
    ) -> CartValidationResponse:
        """Validate cart contents, apply promo discount, and enforce per-donor limit.

        Returns a full price breakdown with any warnings the UI should display.
        """
        event = await self._get_event_or_404(event_id)

        validated_items: list[CartItemValidation] = []
        subtotal = Decimal("0")
        warnings: list[str] = []

        for cart_item in items:
            item_validation = await self._validate_cart_item(event_id, cart_item)
            validated_items.append(item_validation)
            subtotal += item_validation.line_total

            if item_validation.warning:
                warnings.append(item_validation.warning)

        # Promo code
        discount = Decimal("0")
        promo_code_applied: str | None = None

        if promo_code:
            promo = await self._validate_promo_code(event_id, promo_code)
            discount = self._calculate_discount(promo, subtotal)
            promo_code_applied = promo.code

        total = max(subtotal - discount, Decimal("0"))

        # Per-donor limit
        existing_count = await self._get_donor_ticket_count(event_id, user_id)
        new_ticket_total = sum(i.quantity for i in items)
        limit = event.max_tickets_per_donor

        if limit is not None:
            remaining_allowance = limit - existing_count
            if new_ticket_total > remaining_allowance:
                warnings.append(
                    f"Per-donor limit is {limit}. "
                    f"You already have {existing_count} ticket(s); "
                    f"you may purchase up to {max(remaining_allowance, 0)} more."
                )

        return CartValidationResponse(
            items=validated_items,
            subtotal=subtotal,
            discount=discount,
            promo_code_applied=promo_code_applied,
            total=total,
            warnings=warnings,
            per_donor_limit=limit,
            current_donor_ticket_count=existing_count,
        )

    # ── Checkout ──────────────────────────────────────────────────────────────

    async def checkout(
        self,
        event_id: uuid.UUID,
        checkout_request: CheckoutRequest,
        user_id: uuid.UUID,
    ) -> CheckoutResponse:
        """Execute a full checkout: create purchases, tickets, promo application, sponsor."""
        # Re-validate cart (ensures prices/availability are still accurate)
        validation = await self.validate_cart(
            event_id=event_id,
            items=checkout_request.items,
            promo_code=checkout_request.promo_code,
            user_id=user_id,
        )

        promo: PromoCode | None = None
        if checkout_request.promo_code:
            promo = await self._validate_promo_code(event_id, checkout_request.promo_code)

        # Create sponsor entry if sponsorship details provided
        sponsor: Sponsor | None = None
        if checkout_request.sponsorship_details:
            sponsor = await self._create_sponsor(
                event_id=event_id,
                user_id=user_id,
                details=checkout_request.sponsorship_details,
            )

        purchase_summaries: list[PurchaseSummary] = []

        for cart_item, item_val in zip(checkout_request.items, validation.items, strict=True):
            package = await self._get_package_or_404(cart_item.package_id)

            purchase = TicketPurchase(
                event_id=event_id,
                ticket_package_id=package.id,
                user_id=user_id,
                quantity=cart_item.quantity,
                total_price=item_val.line_total,
                payment_status=PaymentStatus.COMPLETED,
                sponsorship_sponsor_id=sponsor.id if sponsor and package.is_sponsorship else None,
            )
            self.db.add(purchase)
            await self.db.flush()

            # Increment sold_count (soft oversell — do not reject)
            package.sold_count = package.sold_count + cart_item.quantity

            # Generate AssignedTicket entries
            total_seats = cart_item.quantity * package.seats_per_package
            ticket_numbers: list[str] = []
            for seq in range(1, total_seats + 1):
                qr = uuid.uuid4().hex
                ticket = AssignedTicket(
                    ticket_purchase_id=purchase.id,
                    ticket_number=seq,
                    qr_code=qr,
                    assignment_status="unassigned",
                )
                self.db.add(ticket)
                ticket_numbers.append(qr)

            # Promo application (once per purchase line)
            if promo:
                line_discount = self._calculate_discount(promo, item_val.line_total)
                if line_discount > Decimal("0"):
                    app = PromoCodeApplication(
                        promo_code_id=promo.id,
                        ticket_purchase_id=purchase.id,
                        discount_amount=line_discount,
                    )
                    self.db.add(app)

            purchase_summaries.append(
                PurchaseSummary(
                    purchase_id=purchase.id,
                    package_name=package.name,
                    quantity=cart_item.quantity,
                    total_price=item_val.line_total,
                    ticket_numbers=ticket_numbers,
                )
            )

        # Increment promo used_count once for the entire checkout
        if promo:
            promo.used_count = promo.used_count + 1

        await self.db.flush()

        # Simulate payment success
        transaction_id = await self._process_payment_placeholder(validation.total)

        logger.info(
            "Checkout completed for user=%s event=%s total=%s",
            user_id,
            event_id,
            validation.total,
        )

        # Audit log: ticket_purchase_completed
        audit = TicketAuditLog(
            entity_type="ticket_purchase",
            entity_id=purchase_summaries[0].purchase_id if purchase_summaries else event_id,
            coordinator_id=user_id,
            field_name="ticket_purchase_completed",
            old_value=None,
            new_value=json.dumps(
                {
                    "total": str(validation.total),
                    "transaction_id": str(transaction_id),
                    "packages": [
                        {
                            "purchase_id": str(ps.purchase_id),
                            "package_name": ps.package_name,
                            "quantity": ps.quantity,
                            "total_price": str(ps.total_price),
                        }
                        for ps in purchase_summaries
                    ],
                }
            ),
        )
        self.db.add(audit)

        # Send order confirmation email (placeholder)
        event = await self._get_event_or_404(event_id)
        user_result = await self.db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        user_email = user.email if user else "unknown"
        user_name = user.full_name if user and hasattr(user, "full_name") else user_email
        await send_order_confirmation(
            user_email=user_email,
            user_name=user_name,
            purchases=purchase_summaries,
            total_charged=validation.total,
            event_name=event.name,
        )

        return CheckoutResponse(
            success=True,
            purchases=purchase_summaries,
            total_charged=validation.total,
            transaction_id=transaction_id,
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _get_event_or_404(self, event_id: uuid.UUID) -> Event:
        result = await self.db.execute(select(Event).where(Event.id == event_id))
        event = result.scalar_one_or_none()
        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event {event_id} not found",
            )
        return event

    async def _get_package_or_404(self, package_id: uuid.UUID) -> TicketPackage:
        result = await self.db.execute(select(TicketPackage).where(TicketPackage.id == package_id))
        package = result.scalar_one_or_none()
        if package is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ticket package {package_id} not found",
            )
        return package

    async def _validate_cart_item(
        self, event_id: uuid.UUID, cart_item: CartItem
    ) -> CartItemValidation:
        """Validate a single cart item and return its price breakdown."""
        package = await self._get_package_or_404(cart_item.package_id)

        if package.event_id != event_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Package {package.id} does not belong to event {event_id}",
            )

        if not package.is_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Package '{package.name}' is not currently available",
            )

        quantity_remaining: int | None = None
        is_sold_out = False
        warning: str | None = None

        if package.quantity_limit is not None:
            quantity_remaining = max(package.quantity_limit - package.sold_count, 0)
            is_sold_out = quantity_remaining == 0

            if is_sold_out:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Package '{package.name}' is sold out",
                )

            # Soft oversell: allow purchase past limit but warn
            if cart_item.quantity > quantity_remaining:
                oversold_by = cart_item.quantity - quantity_remaining
                warning = f"Package '{package.name}' is oversold by {oversold_by}"

            low_stock_threshold = 5
            if warning is None and quantity_remaining <= low_stock_threshold:
                warning = f"Only {quantity_remaining} remaining"

        line_total = package.price * cart_item.quantity

        return CartItemValidation(
            package_id=package.id,
            package_name=package.name,
            quantity=cart_item.quantity,
            unit_price=package.price,
            line_total=line_total,
            quantity_remaining=quantity_remaining,
            is_sold_out=is_sold_out,
            warning=warning,
        )

    async def _validate_promo_code(self, event_id: uuid.UUID, code: str) -> PromoCode:
        """Validate and return a promo code, raising HTTPException on failure."""
        result = await self.db.execute(
            select(PromoCode).where(
                PromoCode.event_id == event_id,
                func.upper(PromoCode.code) == code.upper(),
            )
        )
        promo = result.scalar_one_or_none()

        if promo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Promo code '{code}' not found for this event",
            )

        if not promo.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Promo code is no longer active",
            )

        now = datetime.now(UTC)
        if promo.valid_from and now < promo.valid_from:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Promo code is not yet valid",
            )
        if promo.valid_until and now > promo.valid_until:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Promo code has expired",
            )

        if promo.max_uses is not None and promo.used_count >= promo.max_uses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Promo code has reached its maximum number of uses",
            )

        return promo

    @staticmethod
    def _calculate_discount(promo: PromoCode, subtotal: Decimal) -> Decimal:
        """Calculate the dollar discount for a given promo code and subtotal."""
        if promo.discount_type == DiscountType.PERCENTAGE:
            return (subtotal * promo.discount_value / Decimal("100")).quantize(Decimal("0.01"))
        # FIXED_AMOUNT
        return min(promo.discount_value, subtotal)

    async def _get_donor_ticket_count(self, event_id: uuid.UUID, user_id: uuid.UUID) -> int:
        """Count how many ticket packages the donor has already purchased for this event."""
        result = await self.db.execute(
            select(func.coalesce(func.sum(TicketPurchase.quantity), 0)).where(
                TicketPurchase.event_id == event_id,
                TicketPurchase.user_id == user_id,
                TicketPurchase.payment_status != PaymentStatus.FAILED,
            )
        )
        count: int = result.scalar_one()
        return count

    async def _create_sponsor(
        self,
        *,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        details: SponsorshipDetails,
    ) -> Sponsor:
        """Create a Sponsor record from sponsorship purchase details."""
        sponsor = Sponsor(
            event_id=event_id,
            created_by=user_id,
            name=details.company_name,
            logo_url=details.logo_blob_name,
            logo_blob_name=details.logo_blob_name,
            thumbnail_url=details.logo_blob_name,
            thumbnail_blob_name=details.logo_blob_name,
            website_url=details.website_url,
            contact_name=details.contact_name,
            contact_email=details.contact_email,
        )
        self.db.add(sponsor)
        await self.db.flush()
        logger.info(
            "Created sponsor '%s' (id=%s) for event=%s",
            details.company_name,
            sponsor.id,
            event_id,
        )
        return sponsor

    @staticmethod
    async def _process_payment_placeholder(amount: Decimal) -> uuid.UUID:
        """Placeholder for payment processing — always returns success.

        Will be replaced with real gateway integration (PaymentTransactionService).
        """
        transaction_id = uuid.uuid4()
        logger.info(
            "Payment placeholder: charged $%s, transaction_id=%s",
            amount,
            transaction_id,
        )
        return transaction_id


async def send_order_confirmation(
    user_email: str,
    user_name: str,
    purchases: list[PurchaseSummary],
    total_charged: Decimal,
    event_name: str,
) -> None:
    """Send order confirmation email. Currently logs as placeholder."""
    logger.info(
        "ORDER_CONFIRMATION_EMAIL",
        extra={
            "to": user_email,
            "user_name": user_name,
            "event": event_name,
            "total": str(total_charged),
            "purchase_count": len(purchases),
        },
    )
