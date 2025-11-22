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
from app.services.email_service import EmailService

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
                "status": registration.status.value,
                "created_at": registration.created_at.isoformat(),
            }

            if include_meal_selections:
                attendee["meal_selection"] = (
                    registrant_meal["food_option_name"] if registrant_meal else None
                )
                attendee["meal_description"] = (
                    registrant_meal["food_option_description"] if registrant_meal else None
                )

            attendees.append(attendee)  # type: ignore[arg-type]

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

        # Get all meal selections for this event
        meal_selections_result = await db.execute(
            select(MealSelection, FoodOption)
            .join(EventRegistration, MealSelection.registration_id == EventRegistration.id)
            .join(FoodOption, MealSelection.food_option_id == FoodOption.id)
            .where(EventRegistration.event_id == event_id)
        )
        meal_selections = meal_selections_result.all()

        # Count meals by food option
        meal_counts: dict[str, dict[str, Any]] = {}
        for _meal_selection, food_option in meal_selections:
            option_name = food_option.name
            if option_name not in meal_counts:
                meal_counts[option_name] = {
                    "food_option_id": str(food_option.id),
                    "name": option_name,
                    "description": food_option.description,
                    "count": 0,
                }
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
        registrant = guest.registration.user

        # Generate event registration URL
        event_url = f"/events/{event.slug or event.id}"

        # Send invitation email
        try:
            # Use existing NPO member invitation template as a base pattern
            # You may want to create a dedicated guest invitation email template
            subject = f"You're invited to {event.name}"

            body = f"""
Hello {guest.name},

You have been added as a guest by {registrant.first_name} {registrant.last_name} for the following event:

Event: {event.name}
Date: {event.event_datetime.strftime("%B %d, %Y at %I:%M %p")} ({event.timezone})
Venue: {event.venue_name}
{event.venue_address}

Event Details: {event_url}

We look forward to seeing you at the event!

Best regards,
The Augeo Team
            """.strip()

            html_body = f"""
<html>
<body>
    <p>Hello {guest.name},</p>

    <p>You have been added as a guest by <strong>{registrant.first_name} {registrant.last_name}</strong> for the following event:</p>

    <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #2563eb;">
        <p><strong>Event:</strong> {event.name}</p>
        <p><strong>Date:</strong> {event.event_datetime.strftime("%B %d, %Y at %I:%M %p")} ({event.timezone})</p>
        <p><strong>Venue:</strong> {event.venue_name}</p>
        <p>{event.venue_address}</p>
    </div>

    <p><a href="{event_url}" style="color: #2563eb;">View Event Details</a></p>

    <p>We look forward to seeing you at the event!</p>

    <p>Best regards,<br>The Augeo Team</p>
</body>
</html>
            """.strip()

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
