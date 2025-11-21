"""Event Registration Service - Business logic for donor event registration."""

import logging
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event, EventStatus
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.user import User
from app.schemas.event_registration import (
    EventRegistrationCreateRequest,
    EventRegistrationUpdateRequest,
)

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

        # Create registration
        registration = EventRegistration(
            user_id=current_user.id,
            event_id=registration_data.event_id,
            number_of_guests=registration_data.number_of_guests,
            ticket_type=registration_data.ticket_type,
            status=RegistrationStatus.CONFIRMED,
        )

        db.add(registration)
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
            select(EventRegistration).where(
                and_(
                    EventRegistration.user_id == user_id,
                    EventRegistration.event_id == event_id,
                    EventRegistration.status != RegistrationStatus.CANCELLED,
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
            .where(EventRegistration.user_id == user_id)
            .options(
                selectinload(EventRegistration.event),
                selectinload(EventRegistration.guests),
                selectinload(EventRegistration.meal_selections),
            )
        )

        if status_filter:
            query = query.where(EventRegistration.status == status_filter)

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
            .where(EventRegistration.event_id == event_id)
            .options(
                selectinload(EventRegistration.user),
                selectinload(EventRegistration.guests),
                selectinload(EventRegistration.meal_selections),
            )
        )

        if status_filter:
            query = query.where(EventRegistration.status == status_filter)

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
            .options(selectinload(EventRegistration.event))
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

        # Update fields
        if registration_data.number_of_guests is not None:
            registration.number_of_guests = registration_data.number_of_guests

        if registration_data.ticket_type is not None:
            registration.ticket_type = registration_data.ticket_type

        if registration_data.status is not None:
            # Validate state transition
            EventRegistrationService._validate_status_transition(
                registration.status, registration_data.status
            )
            registration.status = registration_data.status

        await db.commit()
        await db.refresh(registration, ["user", "event", "guests", "meal_selections"])

        logger.info(f"Event registration updated: {registration_id} by user {current_user.id}")
        return registration

    @staticmethod
    async def cancel_registration(
        db: AsyncSession,
        registration_id: uuid.UUID,
        current_user: User,
    ) -> EventRegistration:
        """
        Cancel an event registration (soft delete).

        Args:
            db: Database session
            registration_id: Registration ID
            current_user: User performing the cancellation

        Returns:
            Cancelled EventRegistration object

        Raises:
            HTTPException: If registration not found or unauthorized
        """
        # Get registration
        result = await db.execute(
            select(EventRegistration)
            .where(EventRegistration.id == registration_id)
            .options(selectinload(EventRegistration.event))
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
                detail="You can only cancel your own registrations",
            )

        # Check if already cancelled
        if registration.status == RegistrationStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration is already cancelled",
            )

        # Validate can cancel (before event starts)
        if registration.event.event_datetime <= datetime.now():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel registration after event has started",
            )

        # Soft delete by setting status to cancelled
        registration.status = RegistrationStatus.CANCELLED

        await db.commit()
        await db.refresh(registration)

        logger.info(f"Event registration cancelled: {registration_id} by user {current_user.id}")
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
