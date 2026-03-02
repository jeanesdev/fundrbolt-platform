"""Guest management service for donor-facing operations."""

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest
from app.models.user import User
from app.schemas.registration_guest import (
    RegistrationGuestCreateRequest,
    RegistrationGuestUpdateRequest,
)
from app.services.bidder_number_service import BidderNumberService

logger = logging.getLogger(__name__)


class GuestService:
    """Service for registration guest operations."""

    @staticmethod
    async def add_guest(
        db: AsyncSession,
        guest_data: RegistrationGuestCreateRequest,
        current_user: User,
    ) -> RegistrationGuest:
        """
        Add a guest to an event registration.

        Args:
            db: Database session
            guest_data: Guest creation data
            current_user: User adding the guest

        Returns:
            Created RegistrationGuest object

        Raises:
            HTTPException: If registration not found or unauthorized
        """
        # Verify registration exists and user owns it
        registration_result = await db.execute(
            select(EventRegistration).where(EventRegistration.id == guest_data.registration_id)
        )
        registration = registration_result.scalar_one_or_none()

        if not registration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Registration with ID {guest_data.registration_id} not found",
            )

        if registration.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only add guests to your own registrations",
            )

        # Create guest record
        guest = RegistrationGuest(
            registration_id=guest_data.registration_id,
            name=guest_data.name,
            email=guest_data.email,
            phone=guest_data.phone,
        )

        db.add(guest)
        await db.flush()  # Flush to get guest ID before bidder number assignment

        # Get event from registration to check if seating is configured
        event_result = await db.execute(
            select(Event)
            .join(EventRegistration)
            .where(EventRegistration.id == guest_data.registration_id)
        )
        event = event_result.scalar_one()

        # Automatically assign bidder number if seating is configured
        if event.table_count is not None and event.max_guests_per_table is not None:
            try:
                bidder_number = await BidderNumberService.assign_bidder_number(
                    db, event.id, guest.id
                )
                logger.info(
                    f"Automatically assigned bidder number {bidder_number} to guest {guest.id} "
                    f"for event {event.id}"
                )
            except ValueError as e:
                # Log error but don't fail guest creation
                logger.warning(
                    f"Failed to auto-assign bidder number for guest {guest.id}: {str(e)}"
                )

        await db.commit()
        await db.refresh(guest)

        logger.info(
            f"Guest added to registration {registration.id}: name={guest.name}, email={guest.email}"
        )
        return guest

    @staticmethod
    async def update_guest(
        db: AsyncSession,
        guest_id: uuid.UUID,
        guest_data: RegistrationGuestUpdateRequest,
        current_user: User,
    ) -> RegistrationGuest:
        """
        Update guest information.

        Args:
            db: Database session
            guest_id: Guest ID
            guest_data: Update data
            current_user: User performing the update

        Returns:
            Updated RegistrationGuest object

        Raises:
            HTTPException: If guest not found or unauthorized
        """
        # Get guest with registration
        result = await db.execute(select(RegistrationGuest).where(RegistrationGuest.id == guest_id))
        guest = result.scalar_one_or_none()

        if not guest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Guest with ID {guest_id} not found",
            )

        # Verify ownership
        registration_result = await db.execute(
            select(EventRegistration).where(EventRegistration.id == guest.registration_id)
        )
        registration = registration_result.scalar_one_or_none()

        if not registration or registration.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update guests from your own registrations",
            )

        # Update fields
        if guest_data.name is not None:
            guest.name = guest_data.name

        if guest_data.email is not None:
            guest.email = guest_data.email

        if guest_data.phone is not None:
            guest.phone = guest_data.phone

        await db.commit()
        await db.refresh(guest)

        logger.info(f"Guest updated: {guest_id}")
        return guest

    @staticmethod
    async def remove_guest(
        db: AsyncSession,
        guest_id: uuid.UUID,
        current_user: User,
    ) -> None:
        """
        Remove a guest from a registration.

        Args:
            db: Database session
            guest_id: Guest ID
            current_user: User performing the removal

        Raises:
            HTTPException: If guest not found or unauthorized
        """
        # Get guest with registration
        result = await db.execute(select(RegistrationGuest).where(RegistrationGuest.id == guest_id))
        guest = result.scalar_one_or_none()

        if not guest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Guest with ID {guest_id} not found",
            )

        # Verify ownership
        registration_result = await db.execute(
            select(EventRegistration).where(EventRegistration.id == guest.registration_id)
        )
        registration = registration_result.scalar_one_or_none()

        if not registration or registration.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only remove guests from your own registrations",
            )

        await db.delete(guest)
        await db.commit()

        logger.info(f"Guest removed: {guest_id}")

    @staticmethod
    async def get_registration_guests(
        db: AsyncSession,
        registration_id: uuid.UUID,
    ) -> list[RegistrationGuest]:
        """
        Get all guests for a registration.

        Args:
            db: Database session
            registration_id: Registration ID

        Returns:
            List of RegistrationGuest objects
        """
        result = await db.execute(
            select(RegistrationGuest)
            .where(RegistrationGuest.registration_id == registration_id)
            .order_by(RegistrationGuest.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def link_guest_to_user(
        db: AsyncSession,
        guest_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> RegistrationGuest:
        """
        Link a guest record to a user account (when guest creates their own account).

        Args:
            db: Database session
            guest_id: Guest ID
            user_id: User ID to link

        Returns:
            Updated RegistrationGuest object

        Raises:
            HTTPException: If guest not found or already linked
        """
        # Get guest
        result = await db.execute(select(RegistrationGuest).where(RegistrationGuest.id == guest_id))
        guest = result.scalar_one_or_none()

        if not guest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Guest with ID {guest_id} not found",
            )

        if guest.user_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Guest is already linked to a user account",
            )

        # Link guest to user
        guest.user_id = user_id

        await db.commit()
        await db.refresh(guest)

        logger.info(f"Guest {guest_id} linked to user {user_id}")
        return guest
