"""Admin Guest Service - Business logic for admin guest management operations."""

import csv
import io
import logging
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event, FoodOption
from app.models.event_registration import EventRegistration
from app.models.meal_selection import MealSelection
from app.models.registration_guest import RegistrationGuest
from app.services.bidder_number_service import BidderNumberService
from app.services.email_service import EmailService, _create_email_html_template

logger = logging.getLogger(__name__)


class AdminGuestService:
    """Service for admin guest management operations."""

    @staticmethod
    async def get_event_attendees(
        db: AsyncSession,
        event_id: UUID,
        include_meal_selections: bool = False,
        format_csv: bool = False,
    ) -> list[dict[str, Any]] | str:
        """
        Get all attendees (registrants + guests) for an event.

        Args:
            db: Database session
            event_id: Event UUID
            include_meal_selections: Whether to include meal selection data
            format_csv: Whether to return CSV format (for export)

        Returns:
            List of attendee dictionaries or CSV string

        Raises:
            HTTPException: If event not found
        """
        # Verify event exists
        event_result = await db.execute(select(Event).where(Event.id == event_id))
        event = event_result.scalar_one_or_none()

        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with ID {event_id} not found",
            )

        # Get all registrations for the event with related data
        registrations_result = await db.execute(
            select(EventRegistration)
            .where(EventRegistration.event_id == event_id)
            .options(
                selectinload(EventRegistration.user),
                selectinload(EventRegistration.guests),
                selectinload(EventRegistration.meal_selections).selectinload(
                    MealSelection.food_option
                ),
            )
        )
        registrations = registrations_result.scalars().all()

        attendees = []

        # Process each registration
        for registration in registrations:
            # Add registrant as first attendee
            registrant_meal = None
            if include_meal_selections:
                # Find registrant's meal (guest_id is NULL)
                for meal in registration.meal_selections:
                    if meal.guest_id is None:
                        registrant_meal = {
                            "food_option_name": meal.food_option.name,
                            "food_option_description": meal.food_option.description,
                        }
                        break

            attendee = {
                "id": str(registration.id),
                "registration_id": str(registration.id),
                "attendee_type": "registrant",
                "name": f"{registration.user.first_name} {registration.user.last_name}",
                "email": registration.user.email,
                "phone": registration.user.phone or "",
                "number_of_guests": registration.number_of_guests,
                "ticket_type": registration.ticket_type or "",
                "status": registration.status.value
                if hasattr(registration.status, "value")
                else str(registration.status),
                "created_at": registration.created_at.isoformat(),
            }

            if include_meal_selections:
                attendee["meal_selection"] = (
                    registrant_meal["food_option_name"] if registrant_meal else None
                )
                attendee["meal_description"] = (
                    registrant_meal["food_option_description"] if registrant_meal else None
                )

            attendees.append(attendee)

            # Add guests
            for guest in registration.guests:
                guest_meal = None
                if include_meal_selections:
                    # Find guest's meal
                    for meal in registration.meal_selections:
                        if meal.guest_id == guest.id:
                            guest_meal = {
                                "food_option_name": meal.food_option.name,
                                "food_option_description": meal.food_option.description,
                            }
                            break

                guest_attendee = {
                    "id": str(guest.id),
                    "registration_id": str(registration.id),
                    "attendee_type": "guest",
                    "name": guest.name,
                    "email": guest.email or "",
                    "phone": guest.phone or "",
                    "guest_of": f"{registration.user.first_name} {registration.user.last_name}",
                    "status": "confirmed",
                }

                if include_meal_selections:
                    guest_attendee["meal_selection"] = (
                        guest_meal["food_option_name"] if guest_meal else None
                    )
                    guest_attendee["meal_description"] = (
                        guest_meal["food_option_description"] if guest_meal else None
                    )

                from typing import cast

                attendees.append(cast(dict[str, object], guest_attendee))

        # Convert to CSV if requested
        if format_csv:
            return AdminGuestService._format_attendees_csv(attendees, include_meal_selections)

        return attendees

    @staticmethod
    def _format_attendees_csv(
        attendees: list[dict[str, Any]], include_meal_selections: bool
    ) -> str:
        """
        Format attendee list as CSV string.

        Args:
            attendees: List of attendee dictionaries
            include_meal_selections: Whether to include meal columns

        Returns:
            CSV formatted string
        """
        if not attendees:
            return ""

        output = io.StringIO()

        # Define CSV columns
        if include_meal_selections:
            fieldnames = [
                "name",
                "email",
                "phone",
                "attendee_type",
                "guest_of",
                "ticket_type",
                "meal_selection",
                "status",
                "created_at",
            ]
        else:
            fieldnames = [
                "name",
                "email",
                "phone",
                "attendee_type",
                "guest_of",
                "ticket_type",
                "status",
                "created_at",
            ]

        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(attendees)

        return output.getvalue()

    @staticmethod
    async def get_meal_summary(
        db: AsyncSession,
        event_id: UUID,
    ) -> dict[str, Any]:
        """
        Get meal selection summary for an event.

        Returns count of each meal option selected.

        Args:
            db: Database session
            event_id: Event UUID

        Returns:
            Dictionary with meal counts and event metadata

        Raises:
            HTTPException: If event not found
        """
        # Verify event exists
        event_result = await db.execute(
            select(Event).where(Event.id == event_id).options(selectinload(Event.food_options))
        )
        event = event_result.scalar_one_or_none()

        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with ID {event_id} not found",
            )

        # Get all registrations count
        registrations_result = await db.execute(
            select(func.count(EventRegistration.id)).where(EventRegistration.event_id == event_id)
        )
        total_registrations = registrations_result.scalar() or 0

        # Initialize meal counts with all food options (even if count is 0)
        meal_counts: dict[str, dict[str, Any]] = {}
        for food_option in event.food_options:
            meal_counts[food_option.name] = {
                "food_option_id": str(food_option.id),
                "name": food_option.name,
                "description": food_option.description,
                "count": 0,
            }

        # Get all meal selections for this event and increment counts
        meal_selections_result = await db.execute(
            select(MealSelection, FoodOption)
            .join(EventRegistration, MealSelection.registration_id == EventRegistration.id)
            .join(FoodOption, MealSelection.food_option_id == FoodOption.id)
            .where(EventRegistration.event_id == event_id)
        )
        meal_selections = meal_selections_result.all()

        # Count meals by food option
        for _meal_selection, food_option in meal_selections:
            option_name = food_option.name
            if option_name in meal_counts:
                meal_counts[option_name]["count"] += 1

        # Calculate total attendees (registrants + guests)
        guests_result = await db.execute(
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration)
            .where(EventRegistration.event_id == event_id)
        )
        total_guests = guests_result.scalar() or 0
        total_attendees = total_registrations + total_guests

        # Calculate total meal selections
        total_meal_selections = sum(m["count"] for m in meal_counts.values())

        return {
            "event_id": str(event_id),
            "event_name": event.name,
            "total_registrations": total_registrations,
            "total_attendees": total_attendees,
            "total_meal_selections": total_meal_selections,
            "meal_counts": list(meal_counts.values()),
        }

    @staticmethod
    async def send_guest_invitation(
        db: AsyncSession,
        guest_id: UUID,
        email_service: EmailService,
    ) -> bool:
        """
        Send registration invitation email to a guest.

        Args:
            db: Database session
            guest_id: Guest UUID
            email_service: Email service instance

        Returns:
            True if email sent successfully

        Raises:
            HTTPException: If guest not found or email fails
        """
        # Get guest with registration and event details
        guest_result = await db.execute(
            select(RegistrationGuest)
            .where(RegistrationGuest.id == guest_id)
            .options(
                selectinload(RegistrationGuest.registration).selectinload(EventRegistration.event),
                selectinload(RegistrationGuest.registration).selectinload(EventRegistration.user),
            )
        )
        guest = guest_result.scalar_one_or_none()

        if not guest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Guest with ID {guest_id} not found",
            )

        if not guest.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Guest does not have an email address",
            )

        event = guest.registration.event

        # Generate registration URL for the donor PWA
        registration_url = (
            f"http://localhost:5174/events/{event.slug or event.id}/register?guest={guest.id}"
        )
        event_url = f"http://localhost:5174/events/{event.slug or event.id}"

        # Send invitation email
        try:
            subject = f"You're Invited to {event.name}"

            # Build body paragraphs
            body_paragraphs = [
                f"Hello {guest.name},",
                f"You have been invited to attend <strong>{event.name}</strong>.",
                f"<strong>Date:</strong> {event.event_datetime.strftime('%B %d, %Y at %I:%M %p')} ({event.timezone})<br>"
                f"<strong>Venue:</strong> {event.venue_name}<br>"
                f"{event.venue_address}",
                "To confirm your attendance, you'll need to create your Fundrbolt account (or log in if you already have one), "
                "complete your registration, and select your meal preferences.",
                "Click the button below to get started:",
            ]

            # Plain text version
            plain_body_parts = [
                f"Hello {guest.name},",
                "",
                f"You have been invited to attend {event.name}.",
                "",
                f"Event: {event.name}",
                f"Date: {event.event_datetime.strftime('%B %d, %Y at %I:%M %p')} ({event.timezone})",
                f"Venue: {event.venue_name}",
                f"{event.venue_address}",
                "",
                "To confirm your attendance, you'll need to:",
                "1. Create your Fundrbolt account (or log in if you already have one)",
                "2. Complete your registration and select your meal preferences",
                "3. RSVP for the event",
                "",
                "Click the link below to get started:",
                registration_url,
                "",
                "This invitation is specifically for you. Please complete your registration to confirm your attendance.",
                "",
                "Best regards,",
                "The Fundrbolt Team",
            ]

            body = "\n".join(plain_body_parts)

            # HTML version using professional template
            html_body = _create_email_html_template(
                heading=f"You're Invited to {event.name}!",
                body_paragraphs=body_paragraphs,
                cta_text="Complete Registration",
                cta_url=registration_url,
                footer_text=(
                    "This invitation is specifically for you. Please complete your registration to confirm your attendance. "
                    f'<a href="{event_url}" style="color: #2563eb;">View event details</a>'
                ),
            )

            await email_service._send_email_with_retry(
                to_email=guest.email,
                subject=subject,
                body=body,
                html_body=html_body,
                email_type="guest_invitation",
            )

            logger.info(f"Guest invitation email sent to {guest.email} for event {event.id}")
            return True

        except Exception as e:
            logger.error(f"Failed to send guest invitation email: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to send invitation email: {str(e)}",
            )

    @staticmethod
    async def invite_guest_to_event(
        db: AsyncSession,
        event_id: UUID,
        guest_data: dict[str, Any],
        invited_by_user: Any,
        email_service: Any,
    ) -> Any:
        """
        Invite a new guest to an event (admin-initiated).

        Creates an admin registration if needed, adds the guest, and sends invitation.

        Args:
            db: Database session
            event_id: Event UUID
            guest_data: Guest information (name, email, phone)
            invited_by_user: Admin user creating the invitation
            email_service: Email service instance

        Returns:
            Created guest record

        Raises:
            HTTPException: If event not found or guest creation fails
        """
        # Verify event exists
        event_result = await db.execute(select(Event).where(Event.id == event_id))
        event = event_result.scalar_one_or_none()

        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with ID {event_id} not found",
            )

        # Find or create an admin registration for this event
        # Look for an existing admin-created registration
        admin_reg_result = await db.execute(
            select(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                EventRegistration.user_id == invited_by_user.id,
            )
            .limit(1)
        )
        admin_registration = admin_reg_result.scalar_one_or_none()

        if not admin_registration:
            # Create a new admin registration
            from app.models.event_registration import RegistrationStatus

            admin_registration = EventRegistration(
                user_id=invited_by_user.id,
                event_id=event_id,
                status=RegistrationStatus.PENDING,  # Pending until guest confirms
                ticket_type="admin_invite",
                number_of_guests=1,
            )
            db.add(admin_registration)
            await db.flush()  # Get the ID without committing
        else:
            # Update guest count
            admin_registration.number_of_guests = (admin_registration.number_of_guests or 0) + 1

        # Create the guest record
        guest = RegistrationGuest(
            registration_id=admin_registration.id,
            name=guest_data.get("name"),
            email=guest_data.get("email"),
            phone=guest_data.get("phone"),
            invited_by_admin=True,
        )
        db.add(guest)
        await db.commit()
        await db.refresh(guest)

        # Load relationships for email
        await db.refresh(admin_registration, ["user"])

        # Send invitation email
        email_sent = False
        try:
            # Generate registration URL for the donor PWA
            registration_url = (
                f"http://localhost:5174/events/{event.slug or event.id}/register?guest={guest.id}"
            )
            event_url = f"http://localhost:5174/events/{event.slug or event.id}"

            subject = f"You're Invited to {event.name}"

            # Get custom message if provided
            custom_message = guest_data.get("custom_message", "").strip()

            # Build body paragraphs
            body_paragraphs = [
                f"Hello {guest.name},",
                f"You have been invited to attend <strong>{event.name}</strong>.",
            ]

            # Add custom message if provided
            if custom_message:
                body_paragraphs.append(custom_message)

            # Add event details
            body_paragraphs.extend(
                [
                    f"<strong>Date:</strong> {event.event_datetime.strftime('%B %d, %Y at %I:%M %p')} ({event.timezone})<br>"
                    f"<strong>Venue:</strong> {event.venue_name}<br>"
                    f"{event.venue_address}",
                    "To confirm your attendance, you'll need to create your Fundrbolt account (or log in if you already have one), "
                    "complete your registration, and select your meal preferences.",
                    "Click the button below to get started:",
                ]
            )

            # Plain text version
            plain_body_parts = [
                f"Hello {guest.name},",
                "",
                f"You have been invited to attend {event.name}.",
            ]

            if custom_message:
                plain_body_parts.extend(["", custom_message])

            plain_body_parts.extend(
                [
                    "",
                    f"Event: {event.name}",
                    f"Date: {event.event_datetime.strftime('%B %d, %Y at %I:%M %p')} ({event.timezone})",
                    f"Venue: {event.venue_name}",
                    f"{event.venue_address}",
                    "",
                    "To confirm your attendance, you'll need to:",
                    "1. Create your Fundrbolt account (or log in if you already have one)",
                    "2. Complete your registration and select your meal preferences",
                    "3. RSVP for the event",
                    "",
                    "Click the link below to get started:",
                    registration_url,
                    "",
                    "This invitation is specifically for you. Please complete your registration to confirm your attendance.",
                    "",
                    "Best regards,",
                    "The Fundrbolt Team",
                ]
            )

            body = "\n".join(plain_body_parts)

            # HTML version using professional template
            html_body = _create_email_html_template(
                heading=f"You're Invited to {event.name}!",
                body_paragraphs=body_paragraphs,
                cta_text="Complete Registration",
                cta_url=registration_url,
                footer_text=(
                    "This invitation is specifically for you. Please complete your registration to confirm your attendance. "
                    f'<a href="{event_url}" style="color: #2563eb;">View event details</a>'
                ),
            )

            logger.info(f"Attempting to send invitation email to {guest.email}")
            logger.info(f"Email subject: {subject}")
            logger.info(f"Registration URL: {registration_url}")

            await email_service._send_email_with_retry(
                to_email=guest.email,
                subject=subject,
                body=body,
                html_body=html_body,
                email_type="admin_guest_invitation",
            )

            # Update invitation sent timestamp
            guest.invitation_sent_at = func.now()
            email_sent = True

            logger.info(
                f"Admin invitation sent to {guest.email} for event {event.id} by {invited_by_user.email}"
            )

        except Exception as e:
            logger.error(f"Failed to send admin invitation email: {str(e)}")
            logger.exception(e)
            # Don't fail the whole operation if email fails
            # The guest is still created but email_sent will be False

        await db.commit()

        # Return guest with email status
        return guest, email_sent

    @staticmethod
    async def delete_guest(
        db: AsyncSession,
        guest_id: UUID,
    ) -> None:
        """
        Delete a guest and their meal selections.

        Args:
            db: Database session
            guest_id: Guest UUID

        Raises:
            HTTPException: If guest not found
        """
        # Verify guest exists
        guest_result = await db.execute(
            select(RegistrationGuest).where(RegistrationGuest.id == guest_id)
        )
        guest = guest_result.scalar_one_or_none()

        if not guest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Guest with ID {guest_id} not found",
            )

        # Release bidder number if assigned
        if guest.bidder_number is not None:
            bidder_number = guest.bidder_number
            await BidderNumberService.handle_registration_cancellation(db, guest_id)
            logger.info(f"Released bidder number {bidder_number} for deleted guest {guest_id}")

        # Delete guest (meal selections will cascade)
        await db.delete(guest)
        await db.commit()

        logger.info(f"Deleted guest {guest_id} ({guest.name})")
