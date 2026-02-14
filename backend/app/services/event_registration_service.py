"""Event Registration Service - Business logic for donor event registration."""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event, EventStatus
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.npo import NPO
from app.models.registration_guest import RegistrationGuest
from app.models.ticket_management import TicketPurchase
from app.models.user import User
from app.schemas.event_registration import (
    EventRegistrationCreateRequest,
    EventRegistrationUpdateRequest,
)
from app.schemas.event_with_branding import RegisteredEventWithBranding
from app.services.bidder_number_service import BidderNumberService

logger = logging.getLogger(__name__)


class EventRegistrationService:
    """Service for event registration operations."""

    @staticmethod
    async def create_registration(
        db: AsyncSession,
        registration_data: EventRegistrationCreateRequest,
        current_user: User,
    ) -> EventRegistration:
        """
        Create a new event registration for a donor.

        Args:
            db: Database session
            registration_data: Registration creation data
            current_user: User creating the registration

        Returns:
            Created EventRegistration object

        Raises:
            HTTPException: If event not found, already registered, or validation fails
        """
        # Verify event exists and is active
        event_result = await db.execute(select(Event).where(Event.id == registration_data.event_id))
        event = event_result.scalar_one_or_none()

        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with ID {registration_data.event_id} not found",
            )

        if event.status == EventStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot register for draft events",
            )

        # Check if user is already registered for this event
        existing = await EventRegistrationService.check_duplicate(
            db, current_user.id, registration_data.event_id
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You are already registered for this event",
            )

        ticket_purchase_id: uuid.UUID | None = None
        if registration_data.ticket_purchase_id:
            purchase_result = await db.execute(
                select(TicketPurchase).where(
                    TicketPurchase.id == registration_data.ticket_purchase_id
                )
            )
            purchase = purchase_result.scalar_one_or_none()
            if not purchase:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Ticket purchase not found",
                )
            if purchase.event_id != registration_data.event_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ticket purchase does not match event",
                )
            if purchase.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Ticket purchase does not belong to current user",
                )
            ticket_purchase_id = purchase.id

        # Create registration
        registration = EventRegistration(
            user_id=current_user.id,
            event_id=registration_data.event_id,
            ticket_purchase_id=ticket_purchase_id,
            number_of_guests=registration_data.number_of_guests,
        )

        db.add(registration)
        await db.flush()

        primary_guest = RegistrationGuest(
            registration_id=registration.id,
            user_id=current_user.id,
            name=f"{current_user.first_name} {current_user.last_name}",
            email=current_user.email,
            phone=current_user.phone,
            status=RegistrationStatus.CONFIRMED.value,
            is_primary=True,
        )
        db.add(primary_guest)

        await db.commit()
        await db.refresh(registration, ["user", "event", "guests", "meal_selections"])

        logger.info(
            f"Event registration created: user {current_user.id} "
            f"registered for event {event.id} with {registration.number_of_guests} guests"
        )
        return registration

    @staticmethod
    async def check_duplicate(
        db: AsyncSession,
        user_id: uuid.UUID,
        event_id: uuid.UUID,
    ) -> EventRegistration | None:
        """
        Check if user is already registered for an event.

        Args:
            db: Database session
            user_id: User ID
            event_id: Event ID

        Returns:
            Existing EventRegistration or None
        """
        result = await db.execute(
            select(EventRegistration)
            .join(
                RegistrationGuest,
                RegistrationGuest.registration_id == EventRegistration.id,
            )
            .where(
                and_(
                    EventRegistration.user_id == user_id,
                    EventRegistration.event_id == event_id,
                    RegistrationGuest.is_primary.is_(True),
                    RegistrationGuest.status != RegistrationStatus.CANCELLED.value,
                )
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_registrations(
        db: AsyncSession,
        user_id: uuid.UUID,
        status_filter: RegistrationStatus | None = None,
        page: int = 1,
        per_page: int = 10,
    ) -> tuple[list[EventRegistration], int]:
        """
        Get all registrations for a user with optional filtering.

        Args:
            db: Database session
            user_id: User ID
            status_filter: Optional status filter
            page: Page number (1-indexed)
            per_page: Results per page

        Returns:
            Tuple of (registrations, total_count)
        """
        query = (
            select(EventRegistration)
            .join(
                RegistrationGuest,
                and_(
                    RegistrationGuest.registration_id == EventRegistration.id,
                    RegistrationGuest.is_primary.is_(True),
                ),
            )
            .where(EventRegistration.user_id == user_id)
            .options(
                selectinload(EventRegistration.event),
                selectinload(EventRegistration.guests),
                selectinload(EventRegistration.meal_selections),
            )
        )

        if status_filter:
            query = query.where(RegistrationGuest.status == status_filter.value)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()

        # Get paginated results
        query = query.order_by(EventRegistration.created_at.desc())
        query = query.offset((page - 1) * per_page).limit(per_page)

        result = await db.execute(query)
        registrations = result.scalars().all()

        return list(registrations), total

    @staticmethod
    async def get_registered_events_with_branding(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[RegisteredEventWithBranding]:
        """
        Get events user is registered for with resolved branding.

        Returns events sorted with upcoming events first (ascending by date),
        then past events (descending by date). Branding resolves via
        fallback chain: event → NPO → system defaults.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            List of RegisteredEventWithBranding objects
        """
        # Default branding colors (system fallback)
        DEFAULT_PRIMARY = "#3B82F6"
        DEFAULT_SECONDARY = "#9333EA"
        DEFAULT_BACKGROUND = "#FFFFFF"
        DEFAULT_ACCENT = "#3B82F6"

        now = datetime.now(UTC)
        upcoming_cutoff = now + timedelta(days=30)

        # Query registrations with event, NPO, and branding data
        query = (
            select(EventRegistration)
            .join(
                RegistrationGuest,
                and_(
                    RegistrationGuest.registration_id == EventRegistration.id,
                    RegistrationGuest.is_primary.is_(True),
                ),
            )
            .where(
                and_(
                    EventRegistration.user_id == user_id,
                    RegistrationGuest.status.in_(
                        [
                            RegistrationStatus.PENDING.value,
                            RegistrationStatus.CONFIRMED.value,
                            RegistrationStatus.WAITLISTED.value,
                        ]
                    ),
                )
            )
            .options(
                selectinload(EventRegistration.event).options(
                    selectinload(Event.npo).options(selectinload(NPO.branding)),
                    selectinload(Event.media),
                ),
            )
        )

        result = await db.execute(query)
        registrations = result.scalars().all()

        # Transform to RegisteredEventWithBranding objects
        events_with_branding: list[RegisteredEventWithBranding] = []

        for reg in registrations:
            event = reg.event
            npo = event.npo
            npo_branding = npo.branding if npo else None

            # Resolve thumbnail: first event media, then NPO logo
            thumbnail_url: str | None = None
            if event.media and len(event.media) > 0:
                thumbnail_url = event.media[0].file_url
            elif event.logo_url:
                thumbnail_url = event.logo_url
            elif npo_branding and npo_branding.logo_url:
                thumbnail_url = npo_branding.logo_url

            # Resolve colors with fallback chain: event → NPO → defaults
            primary_color = (
                event.primary_color
                or (npo_branding.primary_color if npo_branding else None)
                or DEFAULT_PRIMARY
            )
            secondary_color = (
                event.secondary_color
                or (npo_branding.secondary_color if npo_branding else None)
                or DEFAULT_SECONDARY
            )
            background_color = (
                event.background_color
                or (npo_branding.background_color if npo_branding else None)
                or DEFAULT_BACKGROUND
            )
            accent_color = (
                event.accent_color
                or (npo_branding.accent_color if npo_branding else None)
                or DEFAULT_ACCENT
            )

            # Determine is_past and is_upcoming
            event_dt = event.event_datetime
            if event_dt.tzinfo is None:
                # Assume UTC if no timezone
                event_dt = event_dt.replace(tzinfo=UTC)

            is_past = event_dt < now
            is_upcoming = not is_past and event_dt <= upcoming_cutoff

            events_with_branding.append(
                RegisteredEventWithBranding(
                    id=event.id,
                    name=event.name,
                    slug=event.slug,
                    event_datetime=event.event_datetime,
                    timezone=event.timezone or "UTC",
                    is_past=is_past,
                    is_upcoming=is_upcoming,
                    thumbnail_url=thumbnail_url,
                    primary_color=primary_color,
                    secondary_color=secondary_color,
                    background_color=background_color,
                    accent_color=accent_color,
                    npo_name=npo.name if npo else "Unknown Organization",
                    npo_logo_url=npo_branding.logo_url if npo_branding else None,
                )
            )

        # Sort: upcoming events first (ascending by date), then past (descending)
        # Separate into upcoming and past lists for cleaner sorting
        upcoming_events = [e for e in events_with_branding if not e.is_past]
        past_events = [e for e in events_with_branding if e.is_past]

        # Sort upcoming by date ascending (soonest first)
        upcoming_events.sort(key=lambda e: e.event_datetime)
        # Sort past by date descending (most recent first)
        past_events.sort(key=lambda e: e.event_datetime, reverse=True)

        # Return upcoming first, then past
        return upcoming_events + past_events

    @staticmethod
    async def get_event_registrations(
        db: AsyncSession,
        event_id: uuid.UUID,
        status_filter: RegistrationStatus | None = None,
        page: int = 1,
        per_page: int = 10,
    ) -> tuple[list[EventRegistration], int]:
        """
        Get all registrations for an event with optional filtering.

        Args:
            db: Database session
            event_id: Event ID
            status_filter: Optional status filter
            page: Page number (1-indexed)
            per_page: Results per page

        Returns:
            Tuple of (registrations, total_count)
        """
        query = (
            select(EventRegistration)
            .join(
                RegistrationGuest,
                and_(
                    RegistrationGuest.registration_id == EventRegistration.id,
                    RegistrationGuest.is_primary.is_(True),
                ),
            )
            .where(EventRegistration.event_id == event_id)
            .options(
                selectinload(EventRegistration.user),
                selectinload(EventRegistration.guests),
                selectinload(EventRegistration.meal_selections),
            )
        )

        if status_filter:
            query = query.where(RegistrationGuest.status == status_filter.value)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()

        # Get paginated results
        query = query.order_by(EventRegistration.created_at.asc())
        query = query.offset((page - 1) * per_page).limit(per_page)

        result = await db.execute(query)
        registrations = result.scalars().all()

        return list(registrations), total

    @staticmethod
    async def update_registration(
        db: AsyncSession,
        registration_id: uuid.UUID,
        registration_data: EventRegistrationUpdateRequest,
        current_user: User,
    ) -> EventRegistration:
        """
        Update an existing event registration.

        Args:
            db: Database session
            registration_id: Registration ID
            registration_data: Update data
            current_user: User performing the update

        Returns:
            Updated EventRegistration object

        Raises:
            HTTPException: If registration not found or unauthorized
        """
        # Get registration
        result = await db.execute(
            select(EventRegistration)
            .where(EventRegistration.id == registration_id)
            .options(
                selectinload(EventRegistration.event),
                selectinload(EventRegistration.guests),
            )
        )
        registration = result.scalar_one_or_none()

        if not registration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Registration with ID {registration_id} not found",
            )

        # Check ownership
        if registration.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own registrations",
            )

        if registration_data.ticket_purchase_id is not None:
            if registration_data.ticket_purchase_id:
                purchase_result = await db.execute(
                    select(TicketPurchase).where(
                        TicketPurchase.id == registration_data.ticket_purchase_id
                    )
                )
                purchase = purchase_result.scalar_one_or_none()
                if not purchase:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Ticket purchase not found",
                    )
                if purchase.event_id != registration.event_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Ticket purchase does not match event",
                    )
                if purchase.user_id != registration.user_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Ticket purchase does not belong to current user",
                    )
                registration.ticket_purchase_id = purchase.id
            else:
                registration.ticket_purchase_id = None

        # Update fields
        if registration_data.number_of_guests is not None:
            registration.number_of_guests = registration_data.number_of_guests

        if registration_data.status is not None:
            primary_guest = next(
                (guest for guest in registration.guests if guest.is_primary),
                None,
            )
            if not primary_guest:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Primary guest record is missing",
                )
            current_status = RegistrationStatus(primary_guest.status)
            EventRegistrationService._validate_status_transition(
                current_status, registration_data.status
            )
            primary_guest.status = registration_data.status.value

        await db.commit()
        await db.refresh(registration, ["user", "event", "guests", "meal_selections"])

        logger.info(f"Event registration updated: {registration_id} by user {current_user.id}")
        return registration

    @staticmethod
    async def cancel_registration(
        db: AsyncSession,
        registration_id: uuid.UUID,
        current_user: User,
        cancellation_reason: str | None = None,
        cancellation_note: str | None = None,
    ) -> EventRegistration:
        """Cancel an event registration (soft delete), logging reason/note."""
        return await EventRegistrationService._cancel_registration(
            db,
            registration_id,
            current_user,
            cancellation_reason=cancellation_reason,
            cancellation_note=cancellation_note,
            enforce_owner=True,
        )

    @staticmethod
    async def cancel_registration_admin(
        db: AsyncSession,
        registration_id: uuid.UUID,
        current_user: User,
        cancellation_reason: str | None = None,
        cancellation_note: str | None = None,
    ) -> EventRegistration:
        """Cancel a registration as an admin (no ownership check)."""
        return await EventRegistrationService._cancel_registration(
            db,
            registration_id,
            current_user,
            cancellation_reason=cancellation_reason,
            cancellation_note=cancellation_note,
            enforce_owner=False,
        )

    @staticmethod
    async def _cancel_registration(
        db: AsyncSession,
        registration_id: uuid.UUID,
        current_user: User,
        cancellation_reason: str | None,
        cancellation_note: str | None,
        enforce_owner: bool,
    ) -> EventRegistration:
        """Internal cancellation helper with optional ownership enforcement."""
        result = await db.execute(
            select(EventRegistration)
            .where(EventRegistration.id == registration_id)
            .options(
                selectinload(EventRegistration.event),
                selectinload(EventRegistration.guests),
            )
        )
        registration = result.scalar_one_or_none()

        if not registration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Registration with ID {registration_id} not found",
            )

        if enforce_owner and registration.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only cancel your own registrations",
            )

        primary_guest = next(
            (guest for guest in registration.guests if guest.is_primary),
            None,
        )
        if not primary_guest:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Primary guest record is missing",
            )

        if primary_guest.status == RegistrationStatus.CANCELLED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration is already cancelled",
            )

        event_dt = registration.event.event_datetime
        if event_dt.tzinfo is None:
            event_dt = event_dt.replace(tzinfo=UTC)
        if event_dt <= datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel registration after event has started",
            )

        for guest in registration.guests:
            guest.status = RegistrationStatus.CANCELLED.value
            guest.cancellation_reason = cancellation_reason
            guest.cancellation_note = cancellation_note
            if guest.bidder_number is not None:
                await BidderNumberService.handle_registration_cancellation(db, guest.id)
                logger.info(
                    f"Released bidder number {guest.bidder_number} for guest {guest.id} "
                    f"due to registration cancellation"
                )

        await db.commit()
        await db.refresh(registration)

        logger.info(
            f"Event registration cancelled: {registration_id} by user {current_user.id} "
            f"reason={cancellation_reason} note={cancellation_note}"
        )
        return registration

    @staticmethod
    def _validate_status_transition(
        current_status: RegistrationStatus,
        new_status: RegistrationStatus,
    ) -> None:
        """
        Validate that a status transition is allowed.

        Args:
            current_status: Current registration status
            new_status: Proposed new status

        Raises:
            HTTPException: If transition is invalid
        """
        # Define valid transitions
        valid_transitions = {
            RegistrationStatus.PENDING: [
                RegistrationStatus.CONFIRMED,
                RegistrationStatus.CANCELLED,
            ],
            RegistrationStatus.CONFIRMED: [RegistrationStatus.CANCELLED],
            RegistrationStatus.CANCELLED: [],  # No transitions from cancelled
            RegistrationStatus.WAITLISTED: [
                RegistrationStatus.CONFIRMED,
                RegistrationStatus.CANCELLED,
            ],
        }

        if new_status not in valid_transitions.get(current_status, []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition from {current_status} to {new_status}",
            )

    @staticmethod
    async def get_registration_by_id(
        db: AsyncSession,
        registration_id: uuid.UUID,
    ) -> EventRegistration | None:
        """
        Get a registration by ID with all related data.

        Args:
            db: Database session
            registration_id: Registration ID

        Returns:
            EventRegistration or None if not found
        """
        result = await db.execute(
            select(EventRegistration)
            .where(EventRegistration.id == registration_id)
            .options(
                selectinload(EventRegistration.user),
                selectinload(EventRegistration.event),
                selectinload(EventRegistration.guests),
                selectinload(EventRegistration.meal_selections),
            )
        )
        return result.scalar_one_or_none()
