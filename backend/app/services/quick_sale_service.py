"""Service for quick ticket sales at check-in."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.event import Event
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.registration_guest import RegistrationGuest
from app.models.role import Role
from app.models.ticket_management import (
    AssignedTicket,
    PaymentStatus,
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
from app.services.bidder_number_service import BidderNumberService

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
            request.address_line1,
            request.address_line2,
            request.city,
            request.state,
            request.postal_code,
            request.country,
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
            card_last_four=request.card_last_four,
            check_number=request.check_number,
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
            event_id=event_id,
            registration_id=registration.id,
            guests=request.guests,
            check_in_immediately=request.check_in_immediately,
            bidder_number=request.bidder_number,
            table_number=request.table_number,
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
                bidder_number=guest.bidder_number,
                table_number=guest.table_number,
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

    async def _get_or_create_user(
        self,
        name: str,
        email: str,
        phone: str | None,
        address_line1: str | None = None,
        address_line2: str | None = None,
        city: str | None = None,
        state: str | None = None,
        postal_code: str | None = None,
        country: str | None = None,
    ) -> User:
        """Get existing user by email or create a new minimal user account."""
        # Check if user exists
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            # Update address if provided and user exists
            if address_line1:
                user.address_line1 = address_line1
                user.address_line2 = address_line2
                user.city = city
                user.state = state
                user.postal_code = postal_code
                user.country = country
                await self.db.flush()
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
            address_line1=address_line1,
            address_line2=address_line2,
            city=city,
            state=state,
            postal_code=postal_code,
            country=country,
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
        card_last_four: str | None = None,
        check_number: str | None = None,
    ) -> TicketPurchase:
        """Create ticket purchase record."""
        total_price = package.price * quantity

        # Build notes with payment details
        payment_details = []
        if card_last_four:
            payment_details.append(f"Card ending in {card_last_four}")
        if check_number:
            payment_details.append(f"Check #{check_number}")

        notes_parts = [
            f"Quick sale by {admin_user.email} via check-in",
            f"Payment method: {payment_method}",
        ]
        if payment_details:
            notes_parts.append(", ".join(payment_details))
        if notes:
            notes_parts.append(notes)

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
            notes=". ".join(notes_parts),
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
            qr_code = f"{purchase_id}-{i + 1}-{uuid.uuid4().hex[:8]}"

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
        # Note: status and check_in_time are properties on RegistrationGuest, not EventRegistration
        registration = EventRegistration(
            user_id=buyer_user.id,
            event_id=event_id,
            ticket_purchase_id=purchase_id,
            number_of_guests=number_of_guests,
        )

        self.db.add(registration)
        await self.db.flush()

        return registration

    async def _create_guests(
        self,
        event_id: uuid.UUID,
        registration_id: uuid.UUID,
        guests: list[QuickSaleGuestInfo],
        check_in_immediately: bool,
        bidder_number: int | None,
        table_number: int | None,
    ) -> list[RegistrationGuest]:
        """Create guest records for all attendees."""
        guest_records = []

        # Fetch used bidder numbers once and allocate sequentially via BidderNumberService
        used_numbers = await BidderNumberService._get_used_bidder_numbers(self.db, event_id)
        if bidder_number is None:
            bidder_number = BidderNumberService._find_replacement_number(used_numbers)

        allocated_bidder_numbers: list[int] = []
        next_start = bidder_number
        for _ in guests:
            try:
                num = BidderNumberService._find_next_available_number_from(
                    used_numbers, next_start
                )
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Not enough bidder numbers available for all guests",
                )
            used_numbers.add(num)
            allocated_bidder_numbers.append(num)
            next_start = num + 1

        # Auto-assign table if not provided
        if table_number is None:
            table_number = await self._get_next_available_table(event_id, len(guests))

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
                bidder_number=allocated_bidder_numbers[idx],
                table_number=table_number,
                bidder_number_assigned_at=datetime.now(UTC),
            )

            self.db.add(guest)
            guest_records.append(guest)

        if guest_records:
            await self.db.flush()

        return guest_records

    async def _get_next_available_table(self, event_id: uuid.UUID, party_size: int) -> int | None:
        """Find the next available table that can fit the party size."""
        from app.models.event import Event
        from app.models.event_table import EventTable

        # Get event's default table capacity
        event_result = await self.db.execute(select(Event).where(Event.id == event_id))
        event = event_result.scalar_one_or_none()
        default_capacity = (event.max_guests_per_table if event else None) or 10

        # Get all tables for this event with their current occupancy
        stmt = (
            select(
                EventTable.table_number,
                EventTable.custom_capacity,
            )
            .where(EventTable.event_id == event_id)
            .order_by(EventTable.table_number)
        )
        result = await self.db.execute(stmt)
        tables = result.all()

        if not tables:
            logger.warning(f"No tables configured for event {event_id}, returning None")
            return None

        # Get current occupancy for each table
        occupancy_stmt = (
            select(
                RegistrationGuest.table_number,
                func.count(RegistrationGuest.id).label("count"),
            )
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.table_number.isnot(None),
                RegistrationGuest.status == RegistrationStatus.CONFIRMED.value,
            )
            .group_by(RegistrationGuest.table_number)
        )
        occupancy_result = await self.db.execute(occupancy_stmt)
        occupancy_map: dict[int, int] = {}
        for row in occupancy_result.all():
            tbl = row[0]
            cnt = row[1]
            if tbl is not None and cnt is not None:
                occupancy_map[int(tbl)] = int(cnt)

        # Find first table with enough space
        for table_number, custom_capacity in tables:
            capacity = (
                int(custom_capacity) if custom_capacity is not None else int(default_capacity)
            )
            current_occupancy = occupancy_map.get(int(table_number), 0)
            available_seats = capacity - current_occupancy

            if available_seats >= party_size:
                return int(table_number)

        logger.warning(
            f"No available tables for party size {party_size} at event {event_id}, returning None"
        )
        return None
