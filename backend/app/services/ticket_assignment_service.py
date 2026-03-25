"""Ticket Assignment Service — assignment, registration, and inventory for donor tickets."""

import json
import logging
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.meal_selection import MealSelection
from app.models.registration_guest import RegistrationGuest
from app.models.ticket_management import (
    AssignedTicket,
    AssignmentStatus,
    OptionResponse,
    TicketAssignment,
    TicketAuditLog,
    TicketPurchase,
)
from app.models.user import User
from app.schemas.ticket_purchasing import (
    AssignmentSummary,
    AssignTicketResponse,
    EventTicketSummary,
    PurchaseDetail,
    SelfRegisterRequest,
    SelfRegisterResponse,
    TicketDetail,
    TicketInventoryResponse,
)
from app.services.email_service import get_email_service

logger = logging.getLogger(__name__)


class TicketAssignmentService:
    """Service for ticket assignment, self-registration, and inventory queries."""

    # ------------------------------------------------------------------
    # assign_ticket
    # ------------------------------------------------------------------

    @staticmethod
    async def assign_ticket(
        db: AsyncSession,
        assigned_ticket_id: uuid.UUID,
        guest_name: str,
        guest_email: str,
        user_id: uuid.UUID,
    ) -> AssignTicketResponse:
        """Assign a ticket to a guest.

        Args:
            db: Async database session.
            assigned_ticket_id: The individual ticket to assign.
            guest_name: Name of the guest.
            guest_email: Email of the guest.
            user_id: Authenticated user (must own the purchase).

        Returns:
            AssignTicketResponse with the created assignment details.

        Raises:
            HTTPException 404: Ticket not found or not owned by user.
            HTTPException 409: Ticket already assigned.
        """
        ticket = await _load_assigned_ticket(db, assigned_ticket_id)
        _verify_ticket_ownership(ticket, user_id)

        if ticket.assignment_status != "unassigned":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ticket is already assigned",
            )

        # Detect self-assignment using the donor's preferred contact email.
        user = await _load_user(db, user_id)
        guest_email_normalized = guest_email.strip().lower()
        is_self = guest_email_normalized in {
            user.email.lower(),
            user.contact_email.lower(),
        }

        existing_assignment_result = await db.execute(
            select(TicketAssignment).where(
                TicketAssignment.assigned_ticket_id == assigned_ticket_id
            )
        )
        assignment = existing_assignment_result.scalar_one_or_none()

        if assignment is not None:
            if assignment.status != "cancelled":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ticket is already assigned",
                )

            assignment.ticket_purchase_id = ticket.ticket_purchase_id
            assignment.event_id = ticket.ticket_purchase.event_id
            assignment.assigned_by_user_id = user_id
            assignment.guest_name = guest_name
            assignment.guest_email = guest_email
            assignment.status = "assigned"
            assignment.is_self_assignment = is_self
            assignment.assignee_user_id = None
            assignment.registration_id = None
            assignment.invitation_sent_at = None
            assignment.invitation_count = 0
            assignment.registered_at = None
            assignment.cancelled_at = None
            assignment.cancelled_by = None
        else:
            assignment = TicketAssignment(
                assigned_ticket_id=assigned_ticket_id,
                ticket_purchase_id=ticket.ticket_purchase_id,
                event_id=ticket.ticket_purchase.event_id,
                assigned_by_user_id=user_id,
                guest_name=guest_name,
                guest_email=guest_email,
                status="assigned",
                is_self_assignment=is_self,
            )
            db.add(assignment)

        ticket.assignment_status = "assigned"

        await db.flush()
        await db.refresh(assignment)

        logger.info(
            "Ticket %s assigned to %s (self=%s) by user %s",
            assigned_ticket_id,
            guest_email,
            is_self,
            user_id,
        )

        # Audit log: ticket_assigned
        audit = TicketAuditLog(
            entity_type="ticket_assignment",
            entity_id=assignment.id,
            coordinator_id=user_id,
            field_name="ticket_assigned",
            old_value=None,
            new_value=json.dumps(
                {
                    "assigned_ticket_id": str(assigned_ticket_id),
                    "guest_name": guest_name,
                    "guest_email": guest_email,
                    "is_self_assignment": is_self,
                }
            ),
        )
        db.add(audit)

        return AssignTicketResponse.model_validate(assignment)

    # ------------------------------------------------------------------
    # update_assignment
    # ------------------------------------------------------------------

    @staticmethod
    async def update_assignment(
        db: AsyncSession,
        assignment_id: uuid.UUID,
        guest_name: str | None,
        guest_email: str | None,
        user_id: uuid.UUID,
    ) -> AssignTicketResponse:
        """Update an existing ticket assignment.

        Only allowed when the assignment status is still 'assigned'.

        Args:
            db: Async database session.
            assignment_id: The assignment to update.
            guest_name: New guest name (optional).
            guest_email: New guest email (optional).
            user_id: Authenticated user (must own the purchase).

        Returns:
            Updated AssignTicketResponse.

        Raises:
            HTTPException 404: Assignment not found or not owned by user.
            HTTPException 409: Assignment is no longer editable.
        """
        assignment = await _load_assignment(db, assignment_id)
        _verify_assignment_ownership(assignment, user_id)

        if assignment.status != "assigned":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Assignment can only be updated while in 'assigned' status",
            )

        if guest_name is not None:
            assignment.guest_name = guest_name
        if guest_email is not None:
            assignment.guest_email = guest_email

            # Re-check self-assignment when email changes
            user = await _load_user(db, user_id)
            guest_email_normalized = guest_email.strip().lower()
            assignment.is_self_assignment = guest_email_normalized in {
                user.email.lower(),
                user.contact_email.lower(),
            }

        await db.flush()
        await db.refresh(assignment)

        logger.info("Assignment %s updated by user %s", assignment_id, user_id)

        return AssignTicketResponse.model_validate(assignment)

    # ------------------------------------------------------------------
    # cancel_assignment
    # ------------------------------------------------------------------

    @staticmethod
    async def cancel_assignment(
        db: AsyncSession,
        assignment_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        """Cancel a ticket assignment (before the guest registers).

        Args:
            db: Async database session.
            assignment_id: The assignment to cancel.
            user_id: Authenticated user (must own the purchase).

        Raises:
            HTTPException 404: Assignment not found or not owned by user.
            HTTPException 409: Assignment is already registered and cannot be cancelled here.
        """
        assignment = await _load_assignment(db, assignment_id)
        _verify_assignment_ownership(assignment, user_id)

        if assignment.status not in ("assigned", "invited"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only assignments in 'assigned' or 'invited' status can be cancelled",
            )

        assignment.status = "cancelled"
        assignment.cancelled_at = datetime.now(UTC)
        assignment.cancelled_by = "purchaser"

        # Free the ticket slot
        ticket_result = await db.execute(
            select(AssignedTicket).where(AssignedTicket.id == assignment.assigned_ticket_id)
        )
        ticket = ticket_result.scalar_one()
        ticket.assignment_status = "unassigned"

        await db.flush()

        logger.info("Assignment %s cancelled by purchaser %s", assignment_id, user_id)

        # Audit log: ticket_assignment_cancelled
        audit = TicketAuditLog(
            entity_type="ticket_assignment",
            entity_id=assignment_id,
            coordinator_id=user_id,
            field_name="ticket_assignment_cancelled",
            old_value="assigned",
            new_value=json.dumps(
                {
                    "assignment_id": str(assignment_id),
                    "cancelled_by": "purchaser",
                }
            ),
        )
        db.add(audit)

    # ------------------------------------------------------------------
    # self_register
    # ------------------------------------------------------------------

    @staticmethod
    async def self_register(
        db: AsyncSession,
        assignment_id: uuid.UUID,
        user_id: uuid.UUID,
        request: SelfRegisterRequest,
    ) -> SelfRegisterResponse:
        """Complete self-registration for a ticket the purchaser assigned to themselves.

        Creates an EventRegistration and RegistrationGuest, then marks the
        assignment as 'registered'.

        Args:
            db: Async database session.
            assignment_id: The self-assignment to register.
            user_id: Authenticated user.
            request: Registration details (phone, meal, custom responses).

        Returns:
            SelfRegisterResponse with registration and event IDs.

        Raises:
            HTTPException 404: Assignment not found.
            HTTPException 403: Not a self-assignment or wrong user.
            HTTPException 409: Assignment is not in a registrable state.
        """
        assignment = await _load_assignment(db, assignment_id)

        user = await _load_user(db, user_id)
        if not assignment.is_self_assignment and _assignment_matches_user_identity(
            assignment, user
        ):
            assignment.is_self_assignment = True

        if not assignment.is_self_assignment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only self-assignments can use this endpoint",
            )

        _verify_assignment_ownership(assignment, user_id)

        if assignment.status not in ("assigned", "invited"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Assignment must be in 'assigned' or 'invited' status to register",
            )

        event_id = assignment.event_id

        # Upsert EventRegistration (donor may already be registered via another ticket)
        reg_result = await db.execute(
            select(EventRegistration).where(
                EventRegistration.user_id == user_id,
                EventRegistration.event_id == event_id,
            )
        )
        registration = reg_result.scalar_one_or_none()

        if registration is None:
            registration = EventRegistration(
                user_id=user_id,
                event_id=event_id,
                ticket_purchase_id=assignment.ticket_purchase_id,
                number_of_guests=1,
            )
            registration.status = "confirmed"
            db.add(registration)
            await db.flush()
            logger.info(
                "Created EventRegistration %s for user %s event %s",
                registration.id,
                user_id,
                event_id,
            )

        primary_guest_result = await db.execute(
            select(RegistrationGuest).where(
                RegistrationGuest.registration_id == registration.id,
                RegistrationGuest.is_primary.is_(True),
            )
        )
        primary_guest = primary_guest_result.scalar_one_or_none()

        if primary_guest is not None and primary_guest.name is None and primary_guest.email is None:
            guest = primary_guest
            guest.user_id = user_id
            guest.name = assignment.guest_name
            guest.email = assignment.guest_email
            guest.phone = request.phone
            guest.status = "confirmed"
        else:
            guest = RegistrationGuest(
                registration_id=registration.id,
                user_id=user_id,
                name=assignment.guest_name,
                email=assignment.guest_email,
                phone=request.phone,
                status="confirmed",
                is_primary=False,
            )
            db.add(guest)
        await db.flush()

        # Meal selection
        if request.meal_selection_id is not None:
            meal = MealSelection(
                registration_id=registration.id,
                guest_id=guest.id,
                food_option_id=request.meal_selection_id,
            )
            db.add(meal)

        # Custom option responses
        for option_id_str, response_value in request.custom_responses.items():
            option_response = OptionResponse(
                ticket_purchase_id=assignment.ticket_purchase_id,
                custom_option_id=uuid.UUID(option_id_str),
                response_value=response_value,
            )
            db.add(option_response)

        # Update assignment
        now = datetime.now(UTC)
        assignment.status = "registered"
        assignment.registered_at = now
        assignment.assignee_user_id = user_id
        assignment.registration_id = registration.id

        # Update ticket status
        ticket_result = await db.execute(
            select(AssignedTicket).where(AssignedTicket.id == assignment.assigned_ticket_id)
        )
        ticket = ticket_result.scalar_one()
        ticket.assignment_status = "registered"

        await db.flush()

        logger.info(
            "Self-registration completed: assignment %s → registration %s",
            assignment_id,
            registration.id,
        )

        # Audit log: ticket_self_registered
        audit = TicketAuditLog(
            entity_type="ticket_assignment",
            entity_id=assignment.id,
            coordinator_id=user_id,
            field_name="ticket_self_registered",
            old_value=None,
            new_value=json.dumps(
                {
                    "assignment_id": str(assignment_id),
                    "registration_id": str(registration.id),
                    "event_id": str(event_id),
                }
            ),
        )
        db.add(audit)

        return SelfRegisterResponse(
            registration_id=registration.id,
            assignment_id=assignment.id,
            event_id=event_id,
            status="registered",
        )

    # ------------------------------------------------------------------
    # cancel_registration
    # ------------------------------------------------------------------

    @staticmethod
    async def cancel_registration(
        db: AsyncSession,
        assignment_id: uuid.UUID,
        user_id: uuid.UUID,
        actor_type: str,
    ) -> None:
        """Cancel a completed registration tied to a ticket assignment.

        Args:
            db: Async database session.
            assignment_id: The assignment whose registration to cancel.
            user_id: Authenticated user (guest or purchaser).
            actor_type: Who is cancelling — 'guest' or 'purchaser'.

        Raises:
            HTTPException 404: Assignment not found.
            HTTPException 403: User is not authorised to cancel.
            HTTPException 409: Assignment is not in 'registered' status.
        """
        assignment = await _load_assignment(db, assignment_id)

        if assignment.status != "registered":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only registered assignments can have their registration cancelled",
            )

        # Verify caller is either the guest or the purchaser
        is_purchaser = assignment.ticket_purchase.user_id == user_id
        is_guest = assignment.assignee_user_id == user_id
        if not (is_purchaser or is_guest):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the guest or the purchaser can cancel this registration",
            )

        revoked_guest_email = assignment.guest_email
        revoked_guest_name = assignment.guest_name
        registered_user_id = assignment.assignee_user_id
        event_result = await db.execute(select(Event).where(Event.id == assignment.event_id))
        event = event_result.scalar_one()

        # Soft-delete the RegistrationGuest (if linked)
        if assignment.registration_id is not None:
            guest_result = await db.execute(
                select(RegistrationGuest).where(
                    RegistrationGuest.registration_id == assignment.registration_id,
                    RegistrationGuest.user_id == assignment.assignee_user_id,
                )
            )
            guest_candidates = guest_result.scalars().all()
            guest = _select_registration_guest_for_cancellation(assignment, guest_candidates)
            if guest is not None:
                guest.status = "cancelled"

                active_non_primary_remaining = any(
                    candidate.id != guest.id
                    and not candidate.is_primary
                    and candidate.status != "cancelled"
                    for candidate in guest_candidates
                )
                if not active_non_primary_remaining:
                    primary_guest = next(
                        (candidate for candidate in guest_candidates if candidate.is_primary),
                        None,
                    )
                    if primary_guest is not None and primary_guest.id != guest.id:
                        primary_guest.status = "cancelled"

                logger.info(
                    "RegistrationGuest %s soft-deleted for assignment %s",
                    guest.id,
                    assignment_id,
                )

        # Update assignment
        assignment.status = "cancelled"
        assignment.cancelled_at = datetime.now(UTC)
        assignment.cancelled_by = actor_type
        assignment.assignee_user_id = None
        assignment.registration_id = None

        # Free the ticket slot
        ticket_result = await db.execute(
            select(AssignedTicket).where(AssignedTicket.id == assignment.assigned_ticket_id)
        )
        ticket = ticket_result.scalar_one()
        ticket.assignment_status = "unassigned"

        await db.flush()

        if actor_type == "purchaser":
            revoked_by_user = await _load_user(db, user_id)
            revoked_by_email = _preferred_contact_email(revoked_by_user)

            if registered_user_id is not None:
                registered_user_result = await db.execute(
                    select(User).where(User.id == registered_user_id)
                )
                registered_user = registered_user_result.scalar_one_or_none()
                if registered_user is not None:
                    revoked_guest_email = _preferred_contact_email(registered_user)

            if revoked_guest_email.lower() != revoked_by_email.lower():
                event_datetime_text = event.event_datetime.strftime("%B %d, %Y at %I:%M %p")
                if event.timezone:
                    event_datetime_text = f"{event_datetime_text} ({event.timezone})"

                event_logo_url: str | None = None
                if event.logo_url:
                    from app.api.v1.event_media_urls import get_signed_asset_url

                    event_logo_url = get_signed_asset_url(event.logo_url)

                email_service = get_email_service()
                try:
                    await email_service.send_ticket_registration_cancelled_email(
                        to_email=revoked_guest_email,
                        guest_name=revoked_guest_name,
                        event_name=event.name,
                        event_datetime_text=event_datetime_text,
                        venue_name=event.venue_name,
                        venue_address=event.venue_address,
                        revoked_by_name=revoked_by_user.full_name,
                        revoked_by_email=revoked_by_email,
                        event_logo_url=event_logo_url,
                    )
                except Exception:
                    logger.exception(
                        "Failed to send ticket registration cancellation email",
                        extra={
                            "assignment_id": str(assignment_id),
                            "recipient_email": revoked_guest_email,
                            "revoked_by_user_id": str(user_id),
                        },
                    )

        logger.info(
            "Registration cancelled for assignment %s by %s (user %s)",
            assignment_id,
            actor_type,
            user_id,
        )

    # ------------------------------------------------------------------
    # get_purchases
    # ------------------------------------------------------------------

    @staticmethod
    async def get_purchases(
        db: AsyncSession,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> list[PurchaseDetail]:
        """Return all ticket purchases for a user within a single event.

        Args:
            db: Async database session.
            event_id: Event to scope the query.
            user_id: Owner of the purchases.

        Returns:
            List of PurchaseDetail with nested ticket and assignment info.
        """
        result = await db.execute(
            select(TicketPurchase)
            .where(
                TicketPurchase.user_id == user_id,
                TicketPurchase.event_id == event_id,
            )
            .options(
                selectinload(TicketPurchase.ticket_package),
                selectinload(TicketPurchase.assigned_tickets).selectinload(
                    AssignedTicket.assignment
                ),
            )
            .order_by(TicketPurchase.purchased_at.desc())
        )
        purchases = result.scalars().all()

        return [_purchase_to_detail(p) for p in purchases]

    # ------------------------------------------------------------------
    # get_inventory
    # ------------------------------------------------------------------

    @staticmethod
    async def get_inventory(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> TicketInventoryResponse:
        """Return a full ticket inventory for the donor, grouped by event.

        Args:
            db: Async database session.
            user_id: Owner of the purchases.

        Returns:
            TicketInventoryResponse with per-event summaries and totals.
        """
        result = await db.execute(
            select(TicketPurchase)
            .where(TicketPurchase.user_id == user_id)
            .options(
                selectinload(TicketPurchase.ticket_package),
                selectinload(TicketPurchase.assigned_tickets).selectinload(
                    AssignedTicket.assignment
                ),
                selectinload(TicketPurchase.event),
            )
            .order_by(TicketPurchase.purchased_at.desc())
        )
        purchases = result.scalars().all()

        # Group purchases by event
        events_map: dict[uuid.UUID, list[TicketPurchase]] = {}
        event_objs: dict[uuid.UUID, Event] = {}
        for purchase in purchases:
            eid = purchase.event_id
            events_map.setdefault(eid, []).append(purchase)
            if eid not in event_objs:
                event_objs[eid] = purchase.event

        event_summaries: list[EventTicketSummary] = []
        total_tickets = 0
        total_assigned = 0
        total_registered = 0
        total_unassigned = 0

        for eid, event_purchases in events_map.items():
            ev = event_objs[eid]
            details = [_purchase_to_detail(p) for p in event_purchases]

            ev_total = 0
            ev_assigned = 0
            ev_registered = 0
            ev_unassigned = 0
            for detail in details:
                for t in detail.tickets:
                    ev_total += 1
                    if t.assignment_status == "registered":
                        ev_registered += 1
                    elif t.assignment_status in {"assigned", "invited"}:
                        ev_assigned += 1
                    else:
                        ev_unassigned += 1

            event_summaries.append(
                EventTicketSummary(
                    event_id=eid,
                    event_name=ev.name,
                    event_slug=ev.slug,
                    event_date=ev.event_datetime,
                    total_tickets=ev_total,
                    assigned_count=ev_assigned,
                    registered_count=ev_registered,
                    unassigned_count=ev_unassigned,
                    purchases=details,
                )
            )

            total_tickets += ev_total
            total_assigned += ev_assigned
            total_registered += ev_registered
            total_unassigned += ev_unassigned

        return TicketInventoryResponse(
            events=event_summaries,
            total_tickets=total_tickets,
            total_assigned=total_assigned,
            total_registered=total_registered,
            total_unassigned=total_unassigned,
        )


# ======================================================================
# Private helpers
# ======================================================================


async def _load_assigned_ticket(
    db: AsyncSession,
    assigned_ticket_id: uuid.UUID,
) -> AssignedTicket:
    """Fetch an AssignedTicket with its parent purchase, or raise 404."""
    result = await db.execute(
        select(AssignedTicket)
        .where(AssignedTicket.id == assigned_ticket_id)
        .options(selectinload(AssignedTicket.ticket_purchase))
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned ticket not found",
        )
    return ticket


async def _load_assignment(
    db: AsyncSession,
    assignment_id: uuid.UUID,
) -> TicketAssignment:
    """Fetch a TicketAssignment with its parent purchase, or raise 404."""
    result = await db.execute(
        select(TicketAssignment)
        .where(TicketAssignment.id == assignment_id)
        .options(selectinload(TicketAssignment.ticket_purchase))
    )
    assignment = result.scalar_one_or_none()
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket assignment not found",
        )
    return assignment


async def _load_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    """Fetch a User by ID, or raise 404."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


def _assignment_matches_user_identity(assignment: TicketAssignment, user: User) -> bool:
    """Return True when an assignment email belongs to the purchaser's own identity."""
    assignment_email = assignment.guest_email.strip().lower()
    return assignment_email in {
        user.email.strip().lower(),
        user.contact_email.strip().lower(),
    }


def _select_registration_guest_for_cancellation(
    assignment: TicketAssignment,
    guest_candidates: Sequence[RegistrationGuest],
) -> RegistrationGuest | None:
    """Pick the guest row that belongs to the assignment being cancelled.

    Older self-registration records can contain both a primary guest row and a
    non-primary guest row for the same user. Prefer the non-primary row that
    matches the assignment identity, then fall back to any active non-primary
    row, then finally the primary guest.
    """

    active_candidates = [guest for guest in guest_candidates if guest.status != "cancelled"]
    if not active_candidates:
        return None

    normalized_email = assignment.guest_email.strip().lower()
    matching_non_primary = next(
        (
            guest
            for guest in active_candidates
            if not guest.is_primary
            and (guest.email or "").strip().lower() == normalized_email
            and guest.name == assignment.guest_name
        ),
        None,
    )
    if matching_non_primary is not None:
        return matching_non_primary

    fallback_non_primary = next(
        (guest for guest in active_candidates if not guest.is_primary),
        None,
    )
    if fallback_non_primary is not None:
        return fallback_non_primary

    return next((guest for guest in active_candidates if guest.is_primary), None)


def _verify_ticket_ownership(ticket: AssignedTicket, user_id: uuid.UUID) -> None:
    """Raise 404 if the ticket's purchase does not belong to the given user."""
    if ticket.ticket_purchase.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned ticket not found",
        )


def _verify_assignment_ownership(assignment: TicketAssignment, user_id: uuid.UUID) -> None:
    """Raise 404 if the assignment's purchase does not belong to the given user."""
    if assignment.ticket_purchase.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket assignment not found",
        )


def _preferred_contact_email(user: User) -> str:
    """Return the user's preferred outbound email address."""
    if user.communications_email and user.communications_email_verified:
        return user.communications_email
    return user.email


def _ticket_to_detail(ticket: AssignedTicket) -> TicketDetail:
    """Map an AssignedTicket ORM instance to a TicketDetail schema."""
    assignment_status = ticket.assignment_status
    assignment_summary: AssignmentSummary | None = None
    if ticket.assignment is not None:
        assignment_status = ticket.assignment.status
        if assignment_status != AssignmentStatus.CANCELLED.value:
            assignment_summary = AssignmentSummary(
                id=ticket.assignment.id,
                guest_name=ticket.assignment.guest_name,
                guest_email=ticket.assignment.guest_email,
                status=ticket.assignment.status,
                is_self_assignment=ticket.assignment.is_self_assignment,
                invitation_sent_at=ticket.assignment.invitation_sent_at,
                invitation_count=ticket.assignment.invitation_count,
                registered_at=ticket.assignment.registered_at,
            )
        else:
            assignment_status = "unassigned"

    return TicketDetail(
        id=ticket.id,
        ticket_number=ticket.ticket_number,
        qr_code=ticket.qr_code,
        assignment_status=assignment_status,
        assignment=assignment_summary,
    )


def _purchase_to_detail(purchase: TicketPurchase) -> PurchaseDetail:
    """Map a TicketPurchase ORM instance to a PurchaseDetail schema."""
    tickets = [_ticket_to_detail(t) for t in purchase.assigned_tickets]
    return PurchaseDetail(
        id=purchase.id,
        package_name=purchase.ticket_package.name,
        package_id=purchase.ticket_package_id,
        quantity=purchase.quantity,
        total_price=purchase.total_price,
        purchased_at=purchase.purchased_at,
        payment_status=purchase.payment_status.value
        if hasattr(purchase.payment_status, "value")
        else str(purchase.payment_status),
        tickets=tickets,
    )
