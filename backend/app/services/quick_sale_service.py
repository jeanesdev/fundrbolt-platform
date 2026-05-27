"""Service for quick ticket sales at check-in."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.event import Event
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.registration_guest import RegistrationGuest
from app.models.role import Role
from app.models.ticket_management import (
    AssignedTicket,
    PaymentStatus,
    TicketAuditLog,
    TicketPackage,
    TicketPurchase,
)
from app.models.user import User
from app.schemas.quick_sale import (
    QuickSaleGuestInfo,
    QuickSaleGuestResult,
    QuickSaleRequest,
    QuickSaleResponse,
)

logger = logging.getLogger(__name__)


class QuickSaleService:
    """Service layer for quick ticket sales at check-in.

    All public methods accept an open AsyncSession — commit responsibility
    sits with the calling endpoint (unit-of-work pattern).
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_quick_sale(
        self,
        event_id: uuid.UUID,
        request: QuickSaleRequest,
        admin_user: User,
    ) -> QuickSaleResponse:
        """
        Create a quick sale: user account, purchase, registration, guests, and optional check-in.

        Args:
            event_id: Event ID
            request: Quick sale details
            admin_user: Admin user performing the sale

        Returns:
            QuickSaleResponse with purchase and guest details

        Raises:
            HTTPException: If validation fails or sale cannot be completed
        """
        # Verify event exists and is active
        await self._get_event_or_404(event_id)

        # Verify ticket package exists and belongs to this event
        package = await self._get_package_or_404(request.ticket_package_id, event_id)

        # Validate quantity matches number of attendees in guests array
        if len(request.guests) != request.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quantity ({request.quantity}) must match number of attendees ({len(request.guests)})",
            )

        # Check if buyer already exists as a user
        buyer_email_lower = request.buyer_email.lower()
        buyer_user = await self._get_or_create_user(
            request.buyer_name,
            buyer_email_lower,
            request.buyer_phone,
        )

        # Create ticket purchase
        purchase = await self._create_purchase(
            event_id=event_id,
            package=package,
            quantity=request.quantity,
            buyer_user=buyer_user,
            admin_user=admin_user,
            payment_method=request.payment_method,
            notes=request.notes,
        )

        # Create assigned tickets
        await self._create_assigned_tickets(
            purchase_id=purchase.id,
            quantity=request.quantity,
        )

        # Create event registration
        registration = await self._create_registration(
            event_id=event_id,
            buyer_user=buyer_user,
            purchase_id=purchase.id,
            number_of_guests=request.quantity,
            check_in_immediately=request.check_in_immediately,
        )

        # Create all attendee guests from the guests array
        # (buyer is separate - they may or may not be attending)
        guest_records = await self._create_guests(
            registration_id=registration.id,
            guests=request.guests,
            check_in_immediately=request.check_in_immediately,
        )

        # Create audit log
        await self._create_audit_log(
            event_id=event_id,
            purchase=purchase,
            admin_user=admin_user,
            action="quick_sale_created",
            payment_method=request.payment_method,
        )

        # Commit all changes
        await self.db.commit()

        # Refresh to get updated relationships
        await self.db.refresh(purchase)
        await self.db.refresh(registration)

        # Build response
        guest_results = [
            QuickSaleGuestResult(
                id=guest.id,
                registration_id=guest.registration_id,
                name=guest.name or "",
                email=guest.email,
                phone=guest.phone,
                is_primary=guest.is_primary,
                checked_in=guest.checked_in,
                bidder_number=None,  # Can be assigned later via seating management
            )
            for guest in guest_records
        ]

        message = (
            f"Successfully sold {request.quantity} ticket(s) and "
            f"{'checked in' if request.check_in_immediately else 'registered'} all guests."
        )

        return QuickSaleResponse(
            purchase_id=purchase.id,
            registration_id=registration.id,
            confirmation_code=str(registration.id)[:8],
            ticket_count=request.quantity,
            package_name=package.name,
            total_amount=purchase.total_price,
            payment_method=request.payment_method or "cash",
            guests=guest_results,
            message=message,
        )

    async def _get_event_or_404(self, event_id: uuid.UUID) -> Event:
        """Get event or raise 404."""
        result = await self.db.execute(select(Event).where(Event.id == event_id))
        event = result.scalar_one_or_none()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event {event_id} not found",
            )
        return event

    async def _get_package_or_404(
        self, package_id: uuid.UUID, event_id: uuid.UUID
    ) -> TicketPackage:
        """Get ticket package or raise 404."""
        result = await self.db.execute(
            select(TicketPackage).where(
                TicketPackage.id == package_id, TicketPackage.event_id == event_id
            )
        )
        package = result.scalar_one_or_none()
        if not package:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ticket package {package_id} not found for this event",
            )

        if not package.is_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ticket package '{package.name}' is not available for purchase",
            )

        return package

    async def _get_or_create_user(self, name: str, email: str, phone: str | None) -> User:
        """Get existing user by email or create a new minimal user account."""
        # Check if user exists
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            logger.info(f"Quick sale using existing user: {email}")
            return user

        # Get donor role ID
        donor_role_stmt = select(Role.id).where(Role.name == "donor")
        role_result = await self.db.execute(donor_role_stmt)
        donor_role_id = role_result.scalar_one()

        # Create new user
        # Split name into first/last
        name_parts = name.strip().split(maxsplit=1)
        first_name = name_parts[0] if len(name_parts) > 0 else "Guest"
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Generate a secure placeholder password hash
        # User won't be able to login until they reset their password
        placeholder_hash = hash_password(f"quick-sale-placeholder-{uuid.uuid4()}")

        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            password_hash=placeholder_hash,
            email_verified=False,
            is_active=True,
            role_id=donor_role_id,
        )

        self.db.add(user)
        await self.db.flush()

        logger.info(f"Quick sale created new user: {email}")
        return user

    async def _create_purchase(
        self,
        event_id: uuid.UUID,
        package: TicketPackage,
        quantity: int,
        buyer_user: User,
        admin_user: User,
        payment_method: str,
        notes: str | None,
    ) -> TicketPurchase:
        """Create ticket purchase record."""
        total_price = package.price * quantity

        purchase = TicketPurchase(
            event_id=event_id,
            user_id=buyer_user.id,
            ticket_package_id=package.id,
            quantity=quantity,
            total_price=total_price,
            payment_status=PaymentStatus.COMPLETED,  # Quick sales are pre-paid
            purchased_at=datetime.now(UTC),
            purchaser_name=buyer_user.full_name,
            purchaser_email=buyer_user.email,
            purchaser_phone=buyer_user.phone,
            notes=f"Quick sale by {admin_user.email} via check-in. Payment method: {payment_method}. {notes or ''}".strip(),
        )

        self.db.add(purchase)
        await self.db.flush()

        return purchase

    async def _create_assigned_tickets(
        self, purchase_id: uuid.UUID, quantity: int
    ) -> list[AssignedTicket]:
        """Create assigned ticket records with QR codes."""
        tickets = []
        for i in range(quantity):
            # Generate unique QR code
            qr_code = f"{purchase_id}-{i+1}-{uuid.uuid4().hex[:8]}"
            
            ticket = AssignedTicket(
                ticket_purchase_id=purchase_id,
                ticket_number=i + 1,
                qr_code=qr_code,
                assignment_status="unassigned",
            )
            self.db.add(ticket)
            tickets.append(ticket)

        await self.db.flush()
        return tickets

    async def _create_registration(
        self,
        event_id: uuid.UUID,
        buyer_user: User,
        purchase_id: uuid.UUID,
        number_of_guests: int,
        check_in_immediately: bool,
    ) -> EventRegistration:
        """Create event registration record."""
        registration = EventRegistration(
            user_id=buyer_user.id,
            event_id=event_id,
            ticket_purchase_id=purchase_id,
            number_of_guests=number_of_guests,
            status=RegistrationStatus.CONFIRMED,
            check_in_time=datetime.now(UTC) if check_in_immediately else None,
        )

        self.db.add(registration)
        await self.db.flush()

        return registration

    async def _create_guests(
        self,
        registration_id: uuid.UUID,
        guests: list[QuickSaleGuestInfo],
        check_in_immediately: bool,
    ) -> list[RegistrationGuest]:
        """Create guest records for all attendees."""
        guest_records = []

        for idx, guest_info in enumerate(guests):
            # First guest is marked as primary
            is_primary = idx == 0
            
            # Try to find or create user by email if provided
            user_id = None
            if guest_info.email:
                result = await self.db.execute(
                    select(User).where(User.email == guest_info.email.lower())
                )
                existing_user = result.scalar_one_or_none()
                if existing_user:
                    user_id = existing_user.id
            
            guest = RegistrationGuest(
                registration_id=registration_id,
                user_id=user_id,
                name=guest_info.name,
                email=guest_info.email,
                phone=guest_info.phone,
                status=RegistrationStatus.CONFIRMED.value,
                is_primary=is_primary,
                checked_in=check_in_immediately,
                check_in_time=datetime.now(UTC) if check_in_immediately else None,
            )

            self.db.add(guest)
            guest_records.append(guest)

        if guest_records:
            await self.db.flush()

        return guest_records

    async def _create_audit_log(
        self,
        event_id: uuid.UUID,
        purchase: TicketPurchase,
        admin_user: User,
        action: str,
        payment_method: str = "cash",
    ) -> None:
        """Create audit log entry."""
        log = TicketAuditLog(
            event_id=event_id,
            purchase_id=purchase.id,
            admin_user_id=admin_user.id,
            action=action,
            details={
                "package_id": str(purchase.ticket_package_id),
                "quantity": purchase.quantity,
                "total_price": str(purchase.total_price),
                "payment_method": payment_method,
            },
        )

        self.db.add(log)
