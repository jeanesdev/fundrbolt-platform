"""Admin Guest Service - Business logic for admin guest management operations."""

import csv
import io
import logging
import secrets
import uuid as _uuid_module
from decimal import Decimal
from typing import Any
from urllib.parse import quote
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.donor_label import DonorLabel
from app.models.donor_label_assignment import DonorLabelAssignment
from app.models.event import Event, FoodOption
from app.models.event_registration import EventRegistration
from app.models.meal_selection import MealSelection
from app.models.npo import NPO
from app.models.npo_branding import NPOBranding
from app.models.payment_profile import PaymentProfile
from app.models.registration_guest import RegistrationGuest
from app.models.role import Role
from app.models.ticket_management import (
    AssignedTicket,
    PaymentStatus,
    TicketPackage,
    TicketPurchase,
)
from app.models.user import User
from app.services.bidder_number_service import BidderNumberService
from app.services.email_service import EmailService, _create_email_html_template
from app.services.password_service import PasswordService
from app.services.redis_service import RedisService

logger = logging.getLogger(__name__)
settings = get_settings()


class AdminGuestService:
    """Service for admin guest management operations."""

    @staticmethod
    async def _ensure_guest_account_and_setup_url(
        db: AsyncSession,
        guest_email: str | None,
        guest_name: str | None,
        redirect_path: str,
    ) -> tuple[str, UUID | None]:
        """Ensure a donor account exists for the guest and return a setup URL plus user ID.

        If the email has no account, creates an inactive donor account.
        If the account is already active, returns the sign-in URL with a redirect.
        Returns the event URL directly when no email is provided.

        Returns:
            (cta_url, user_id) — user_id is None when no email was provided or
            when the account already exists and is active.
        """
        if not guest_email:
            return f"{settings.frontend_donor_url}{redirect_path}", None

        existing_result = await db.execute(select(User).where(User.email == guest_email.lower()))
        user = existing_result.scalar_one_or_none()

        if user is None:
            donor_role_result = await db.execute(select(Role).where(Role.name == "donor"))
            donor_role = donor_role_result.scalar_one_or_none()
            if donor_role:
                name_parts = (guest_name or "").strip().split(None, 1)
                pre_first = name_parts[0] if name_parts else guest_email.split("@")[0]
                pre_last = name_parts[1] if len(name_parts) > 1 else ""
                user = User(
                    email=guest_email.lower(),
                    first_name=pre_first,
                    last_name=pre_last,
                    password_hash=hash_password(f"Tmp{secrets.token_urlsafe(10)}1"),
                    role_id=donor_role.id,
                    must_change_password=True,
                    email_verified=False,
                    is_active=False,
                )
                db.add(user)
                await db.flush()
                logger.info(
                    "Pre-created donor account for admin guest invitation",
                    extra={"email": guest_email},
                )

        if user is not None and not user.is_active and user.must_change_password:
            setup_token = PasswordService.generate_reset_token()
            token_hash = PasswordService.hash_token(setup_token)
            await RedisService.store_password_reset_token(token_hash, user.id)
            encoded_redirect = quote(redirect_path, safe="")
            return (
                f"{settings.frontend_donor_url}/password-reset-confirm"
                f"?token={setup_token}&redirect={encoded_redirect}",
                user.id,
            )

        # Account already exists and is active — issue a magic link so the user
        # can log in from the invitation without needing to know their password.
        if user is not None:
            magic_token = PasswordService.generate_reset_token()
            token_hash = PasswordService.hash_token(magic_token)
            await RedisService.store_magic_link_token(token_hash, user.id)
            encoded_redirect = quote(redirect_path, safe="")
            return (
                f"{settings.frontend_donor_url}/magic-login"
                f"?token={magic_token}&redirect={encoded_redirect}",
                None,
            )

        # No email or no donor role — fall back to event URL directly
        return f"{settings.frontend_donor_url}{redirect_path}", None

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

        # Load user IDs that have a saved payment profile for this event's NPO
        # in a single query to avoid N+1 issues.
        npo_id_result = await db.execute(select(Event.npo_id).where(Event.id == event_id))
        npo_id_row = npo_id_result.scalar_one_or_none()
        users_with_profile: set[str] = set()
        if npo_id_row is not None:
            profile_result = await db.execute(
                select(PaymentProfile.user_id)
                .where(
                    PaymentProfile.npo_id == npo_id_row,
                    PaymentProfile.deleted_at.is_(None),
                )
                .distinct()
            )
            users_with_profile = {str(row[0]) for row in profile_result.fetchall()}

        # Load donor labels for all users in this NPO in a single query
        user_donor_labels: dict[str, list[dict[str, Any]]] = {}
        if npo_id_row is not None:
            labels_result = await db.execute(
                select(
                    DonorLabelAssignment.user_id, DonorLabel.id, DonorLabel.name, DonorLabel.color
                )
                .join(DonorLabel, DonorLabelAssignment.label_id == DonorLabel.id)
                .where(DonorLabel.npo_id == npo_id_row)
            )
            for row in labels_result.fetchall():
                uid = str(row[0])
                if uid not in user_donor_labels:
                    user_donor_labels[uid] = []
                user_donor_labels[uid].append({"id": str(row[1]), "name": row[2], "color": row[3]})

        # Collect all user IDs and batch-query profile picture URLs
        all_user_ids: set[UUID] = set()
        for registration in registrations:
            if registration.user:
                all_user_ids.add(registration.user.id)
            for guest in registration.guests:
                if guest.user_id:
                    all_user_ids.add(guest.user_id)
        user_profile_pics: dict[str, str | None] = {}
        if all_user_ids:
            pic_result = await db.execute(
                select(User.id, User.profile_picture_url).where(
                    User.id.in_(all_user_ids),
                    User.profile_picture_url.isnot(None),
                )
            )
            for pic_row in pic_result.fetchall():
                user_profile_pics[str(pic_row[0])] = pic_row[1]

        attendees = []

        # Process each registration
        for registration in registrations:
            if registration.user is None:
                logger.warning(
                    "Skipping registration without user",
                    extra={"registration_id": str(registration.id)},
                )
                continue

            primary_guest = next(
                (guest for guest in registration.guests if guest.is_primary),
                None,
            )

            if primary_guest:
                registrant_meal = None
                if include_meal_selections:
                    for meal in registration.meal_selections:
                        if meal.guest_id == primary_guest.id or meal.guest_id is None:
                            if meal.food_option is None:
                                continue
                            registrant_meal = {
                                "food_option_name": meal.food_option.name,
                                "food_option_description": meal.food_option.description,
                            }
                            break

                reg_user_id = str(registration.user.id)
                attendee = {
                    "id": str(primary_guest.id),
                    "registration_id": str(registration.id),
                    "attendee_type": "registrant",
                    "user_id": reg_user_id,
                    "name": primary_guest.name
                    or f"{registration.user.first_name} {registration.user.last_name}",
                    "email": primary_guest.email or registration.user.email,
                    "phone": primary_guest.phone or (registration.user.phone or ""),
                    "number_of_guests": registration.number_of_guests,
                    "bidder_number": primary_guest.bidder_number,
                    "table_number": primary_guest.table_number,
                    "is_table_captain": primary_guest.is_table_captain,
                    "checked_in": bool(primary_guest.check_in_time),
                    "check_in_time": (
                        primary_guest.check_in_time.isoformat()
                        if primary_guest.check_in_time
                        else None
                    ),
                    "has_payment_profile": reg_user_id in users_with_profile,
                    "profile_picture_url": user_profile_pics.get(reg_user_id),
                    "status": primary_guest.status,
                    "created_at": primary_guest.created_at.isoformat(),
                    "donor_labels": user_donor_labels.get(reg_user_id, []),
                }

                if include_meal_selections:
                    attendee["meal_selection"] = (
                        registrant_meal["food_option_name"] if registrant_meal else None
                    )
                    attendee["meal_description"] = (
                        registrant_meal["food_option_description"] if registrant_meal else None
                    )

                attendees.append(attendee)
            else:
                registrant_meal = None
                if include_meal_selections:
                    for meal in registration.meal_selections:
                        if meal.guest_id is None:
                            if meal.food_option is None:
                                continue
                            registrant_meal = {
                                "food_option_name": meal.food_option.name,
                                "food_option_description": meal.food_option.description,
                            }
                            break

                reg_user_id = str(registration.user.id)
                attendee = {
                    "id": str(registration.id),
                    "registration_id": str(registration.id),
                    "attendee_type": "registrant",
                    "user_id": reg_user_id,
                    "name": f"{registration.user.first_name} {registration.user.last_name}",
                    "email": registration.user.email,
                    "phone": registration.user.phone or "",
                    "number_of_guests": registration.number_of_guests,
                    "bidder_number": None,
                    "table_number": None,
                    "is_table_captain": False,
                    "checked_in": False,
                    "check_in_time": None,
                    "has_payment_profile": reg_user_id in users_with_profile,
                    "profile_picture_url": user_profile_pics.get(reg_user_id),
                    "status": registration.status,
                    "created_at": registration.created_at.isoformat(),
                    "donor_labels": user_donor_labels.get(reg_user_id, []),
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
                if guest.is_primary:
                    continue
                guest_meal = None
                if include_meal_selections:
                    # Find guest's meal
                    for meal in registration.meal_selections:
                        if meal.guest_id == guest.id:
                            if meal.food_option is None:
                                continue
                            guest_meal = {
                                "food_option_name": meal.food_option.name,
                                "food_option_description": meal.food_option.description,
                            }
                            break

                guest_user_id = str(guest.user_id) if guest.user_id else None
                guest_attendee = {
                    "id": str(guest.id),
                    "registration_id": str(registration.id),
                    "attendee_type": "guest",
                    "user_id": guest_user_id,
                    "name": guest.name,
                    "email": guest.email or "",
                    "phone": guest.phone or "",
                    "guest_of": f"{registration.user.first_name} {registration.user.last_name}",
                    "bidder_number": guest.bidder_number,
                    "table_number": guest.table_number,
                    "is_table_captain": guest.is_table_captain,
                    "checked_in": bool(guest.check_in_time),
                    "check_in_time": (
                        guest.check_in_time.isoformat() if guest.check_in_time else None
                    ),
                    "has_payment_profile": bool(
                        guest_user_id and guest_user_id in users_with_profile
                    ),
                    "profile_picture_url": user_profile_pics.get(guest_user_id)
                    if guest_user_id
                    else None,
                    "status": guest.status or "confirmed",
                    "donor_labels": user_donor_labels.get(guest_user_id, [])
                    if guest_user_id
                    else [],
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

        meal_counts = {
            food_option.name: {
                "food_option_id": str(food_option.id),
                "name": food_option.name,
                "description": food_option.description,
                "count": 0,
            }
            for food_option in event.food_options
        }

        # Get total registration count (primary guests)
        registrations_result = await db.execute(
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.is_primary.is_(True),
            )
        )
        total_registrations: int = int(registrations_result.scalar_one() or 0)

        # Active attendees exclude cancelled guests
        active_registrations_result = await db.execute(
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.is_primary.is_(True),
                RegistrationGuest.status != "cancelled",
            )
        )
        active_registrations: int = int(active_registrations_result.scalar_one() or 0)

        active_guests_result = await db.execute(
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.is_primary.is_(False),
                RegistrationGuest.status != "cancelled",
            )
        )
        active_guests: int = int(active_guests_result.scalar_one() or 0)

        total_active_attendees = active_registrations + active_guests

        # Get all meal selections for this event and increment counts
        meal_selections_result = await db.execute(
            select(MealSelection, FoodOption)
            .join(EventRegistration, MealSelection.registration_id == EventRegistration.id)
            .join(FoodOption, MealSelection.food_option_id == FoodOption.id)
            .join(RegistrationGuest, MealSelection.guest_id == RegistrationGuest.id)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.status != "cancelled",
            )
        )
        meal_selections = meal_selections_result.all()

        # Count meals by food option
        for _meal_selection, food_option in meal_selections:
            option_name = food_option.name
            if option_name in meal_counts:
                current_count = int(meal_counts[option_name]["count"] or 0)
                meal_counts[option_name]["count"] = current_count + 1

        # Calculate total attendees (primary + guests)
        guests_result = await db.execute(
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.is_primary.is_(False),
            )
        )
        total_guests: int = int(guests_result.scalar_one() or 0)
        total_attendees = total_registrations + total_guests

        # Calculate total meal selections
        total_meal_selections = 0
        for meal in meal_counts.values():
            total_meal_selections += int(meal["count"] or 0)

        return {
            "event_id": str(event_id),
            "event_name": event.name,
            "total_registrations": total_registrations,
            "total_attendees": total_attendees,
            "total_active_attendees": total_active_attendees,
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
        # Get guest with registration and event details (including event media for logo)
        guest_result = await db.execute(
            select(RegistrationGuest)
            .where(RegistrationGuest.id == guest_id)
            .options(
                selectinload(RegistrationGuest.registration)
                .selectinload(EventRegistration.event)
                .selectinload(Event.media),
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

        # Resolve logo: event logo → NPO branding → (template fallback)
        from app.api.v1.event_media_urls import resolve_event_logo_url  # noqa: PLC0415

        event_logo_url: str | None = resolve_event_logo_url(event)
        npo_branding_result = await db.execute(
            select(NPOBranding.logo_url).where(NPOBranding.npo_id == event.npo_id)
        )
        npo_logo_url: str | None = npo_branding_result.scalar_one_or_none()
        header_logo_url = event_logo_url or npo_logo_url

        # Fetch NPO name for email sign-off
        npo_name_result = await db.execute(select(NPO.name).where(NPO.id == event.npo_id))
        npo_name: str | None = npo_name_result.scalar_one_or_none()
        team_name = f"The {npo_name} Team" if npo_name else "The FundrBolt Team"

        # Route through profile completion first, then event page
        after_profile_path = f"/events/{event.slug or event.id}"
        profile_redirect = f"/complete-profile?redirect={quote(after_profile_path, safe='')}"
        cta_url, _ = await AdminGuestService._ensure_guest_account_and_setup_url(
            db, guest.email, guest.name, profile_redirect
        )
        event_url = f"{settings.frontend_donor_url}/events/{event.slug or event.id}"

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
                "Click the button below to set up your account and complete your registration.",
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
                "Click the link below to set up your account and complete your registration:",
                cta_url,
                "",
                "This invitation is specifically for you. Please complete your registration to confirm your attendance.",
                "",
                "Best regards,",
                team_name,
            ]

            body = "\n".join(plain_body_parts)

            # HTML version using professional template
            html_body = _create_email_html_template(
                heading=f"You're Invited to {event.name}!",
                body_paragraphs=body_paragraphs,
                cta_text="Complete Account Setup",
                cta_url=cta_url,
                footer_text=(
                    "This invitation is specifically for you. Please complete your registration to confirm your attendance. "
                    f'<a href="{event_url}" style="color: #2563eb;">View event details</a>'
                ),
                logo_url=header_logo_url,
                npo_name=npo_name,
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
        When ticket_package_id + is_comped are provided, creates a $0 ticket purchase.

        Args:
            db: Database session
            event_id: Event UUID
            guest_data: Guest information (name, email, phone, ticket_package_id,
                        ticket_quantity, is_comped, custom_message)
            invited_by_user: Admin user creating the invitation
            email_service: Email service instance

        Returns:
            Created guest record

        Raises:
            HTTPException: If event not found or guest creation fails
        """
        from app.api.v1.event_media_urls import resolve_event_logo_url  # noqa: PLC0415

        # Verify event exists — load media for logo resolution
        event_result = await db.execute(
            select(Event).where(Event.id == event_id).options(selectinload(Event.media))
        )
        event = event_result.scalar_one_or_none()

        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with ID {event_id} not found",
            )

        # Resolve logo: event logo → NPO branding → (template fallback)
        event_logo_url: str | None = resolve_event_logo_url(event)
        npo_branding_result = await db.execute(
            select(NPOBranding.logo_url).where(NPOBranding.npo_id == event.npo_id)
        )
        npo_logo_url: str | None = npo_branding_result.scalar_one_or_none()
        header_logo_url = event_logo_url or npo_logo_url

        # Fetch NPO name for email sign-off
        npo_name_result = await db.execute(select(NPO.name).where(NPO.id == event.npo_id))
        npo_name: str | None = npo_name_result.scalar_one_or_none()
        team_name = f"The {npo_name} Team" if npo_name else "The FundrBolt Team"

        # Extract ticket invitation data
        raw_pkg_id: str | None = guest_data.get("ticket_package_id")
        ticket_package_id: UUID | None = UUID(raw_pkg_id) if raw_pkg_id else None
        ticket_quantity: int = max(1, int(guest_data.get("ticket_quantity") or 1))

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
            admin_registration = EventRegistration(
                user_id=invited_by_user.id,
                event_id=event_id,
                number_of_guests=1,
            )
            db.add(admin_registration)
            await db.flush()  # Get the ID without committing
        else:
            # Update guest count
            admin_registration.number_of_guests = (admin_registration.number_of_guests or 0) + 1

        existing_primary_result = await db.execute(
            select(RegistrationGuest)
            .where(RegistrationGuest.registration_id == admin_registration.id)
            .where(RegistrationGuest.is_primary.is_(True))
            .limit(1)
        )
        has_primary = existing_primary_result.scalar_one_or_none() is not None

        # Create the guest record
        guest = RegistrationGuest(
            registration_id=admin_registration.id,
            name=guest_data.get("name"),
            email=guest_data.get("email"),
            phone=guest_data.get("phone"),
            invited_by_admin=True,
            is_primary=not has_primary,
        )
        db.add(guest)
        await db.commit()
        await db.refresh(guest)

        # Load relationships for email
        await db.refresh(admin_registration, ["user"])

        # Send invitation email
        email_sent = False
        try:
            # Determine where to send the user after completing their profile.
            # With a comped package: straight to ticket management (/tickets).
            # Without a package: ticket purchase page for the event.
            if ticket_package_id:
                after_profile_path = "/tickets"
            else:
                after_profile_path = f"/events/{event.slug or event.id}/tickets"

            profile_redirect = f"/complete-profile?redirect={quote(after_profile_path, safe='')}"
            cta_url, new_user_id = await AdminGuestService._ensure_guest_account_and_setup_url(
                db, guest.email, guest.name, profile_redirect
            )
            event_url = f"{settings.frontend_donor_url}/events/{event.slug or event.id}"

            # Create comped ticket purchase for the pre-created user
            if ticket_package_id and new_user_id:
                pkg_result = await db.execute(
                    select(TicketPackage).where(TicketPackage.id == ticket_package_id)
                )
                package = pkg_result.scalar_one_or_none()
                if package:
                    purchase = TicketPurchase(
                        event_id=event_id,
                        ticket_package_id=package.id,
                        user_id=new_user_id,
                        quantity=ticket_quantity,
                        total_price=Decimal("0.00"),
                        payment_status=PaymentStatus.COMPLETED,
                    )
                    db.add(purchase)
                    await db.flush()
                    total_seats = ticket_quantity * package.seats_per_package
                    for i in range(total_seats):
                        qr = f"{purchase.id}-{i + 1}-{_uuid_module.uuid4().hex[:8]}"
                        db.add(
                            AssignedTicket(
                                ticket_purchase_id=purchase.id,
                                ticket_number=i + 1,
                                qr_code=qr,
                                assignment_status="unassigned",
                            )
                        )
                    package.sold_count += ticket_quantity
                    logger.info(
                        "Created comped ticket purchase",
                        extra={
                            "user_id": str(new_user_id),
                            "package_id": str(ticket_package_id),
                            "quantity": ticket_quantity,
                        },
                    )

            subject = f"You're Invited to {event.name}"

            # Get custom message if provided
            custom_message = guest_data.get("custom_message", "").strip()

            # Build ticket blurb for body
            ticket_blurb: str | None = None
            if ticket_package_id and package is not None:
                seat_count = ticket_quantity * package.seats_per_package
                ticket_blurb = (
                    f"You have been granted <strong>{seat_count} complimentary "
                    f"{'seat' if seat_count == 1 else 'seats'}</strong> "
                    f"({package.name}). Your tickets will be waiting in your account."
                )
            elif ticket_package_id:
                ticket_blurb = "You are invited to purchase tickets for this event."

            # Build body paragraphs
            body_paragraphs = [
                f"Hello {guest.name},",
                f"You have been invited to attend <strong>{event.name}</strong>.",
            ]

            # Add custom message if provided
            if custom_message:
                body_paragraphs.append(custom_message)

            if ticket_blurb:
                body_paragraphs.append(ticket_blurb)

            # Add event details
            body_paragraphs.extend(
                [
                    f"<strong>Date:</strong> {event.event_datetime.strftime('%B %d, %Y at %I:%M %p')} ({event.timezone})<br>"
                    f"<strong>Venue:</strong> {event.venue_name}<br>"
                    f"{event.venue_address}",
                    "Click the button below to set up your account and complete your registration.",
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
                    "Click the link below to set up your account and complete your registration:",
                    cta_url,
                    "",
                    "This invitation is specifically for you. Please complete your registration to confirm your attendance.",
                    "",
                    "Best regards,",
                    team_name,
                ]
            )

            body = "\n".join(plain_body_parts)

            # HTML version using professional template
            html_body = _create_email_html_template(
                heading=f"You're Invited to {event.name}!",
                body_paragraphs=body_paragraphs,
                cta_text="Complete Account Setup",
                cta_url=cta_url,
                footer_text=(
                    "This invitation is specifically for you. Please complete your registration to confirm your attendance. "
                    f'<a href="{event_url}" style="color: #2563eb;">View event details</a>'
                ),
                logo_url=header_logo_url,
                npo_name=npo_name,
            )

            logger.info(
                f"Attempting to send invitation email to {guest.email}",
                extra={"cta_url": cta_url},
            )

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
        cancellation_reason: str | None = None,
        cancellation_note: str | None = None,
    ) -> None:
        """
        Cancel (soft delete) a guest and remove their meal selections.

        Args:
            db: Database session
            guest_id: Guest UUID
            cancellation_reason: Optional cancellation reason
            cancellation_note: Optional cancellation note

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

        # Remove guest meal selections
        await db.execute(delete(MealSelection).where(MealSelection.guest_id == guest.id))

        # Soft cancel guest
        guest.status = "cancelled"
        guest.cancellation_reason = cancellation_reason
        guest.cancellation_note = cancellation_note

        await db.commit()

        logger.info(
            f"Cancelled guest {guest_id} ({guest.name}) reason={cancellation_reason} "
            f"note={cancellation_note}"
        )
