"""Service for ticket invitation management.

T010 — Manages invitation emails and guest registration via HMAC-signed tokens.
"""

import base64
import hashlib
import hmac
import json
import os
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest
from app.models.ticket_management import (
    AssignedTicket,
    AssignmentStatus,
    OptionResponse,
    TicketAssignment,
    TicketAuditLog,
    TicketInvitation,
)
from app.models.user import User
from app.schemas.ticket_purchasing import (
    InvitationRegisterRequest,
    InvitationRegisterResponse,
    InvitationSendResponse,
    InvitationValidateResponse,
)

logger = get_logger(__name__)
settings = get_settings()

MAX_INVITATIONS_PER_ASSIGNMENT = 5


class TicketInvitationService:
    """Async service for managing invitation emails and guest registration."""

    _secret: str = os.environ.get("INVITATION_SECRET", "dev-secret-key")

    # ------------------------------------------------------------------
    # Token helpers
    # ------------------------------------------------------------------

    @classmethod
    def _generate_token(
        cls,
        assignment_id: uuid.UUID,
        guest_email: str,
        event_id: uuid.UUID,
        expires_at: datetime,
    ) -> str:
        """Generate an HMAC-signed invitation token."""
        payload = json.dumps(
            {
                "aid": str(assignment_id),
                "email": guest_email,
                "eid": str(event_id),
                "exp": expires_at.isoformat(),
            }
        )
        encoded = base64.urlsafe_b64encode(payload.encode()).decode()
        sig = hmac.new(cls._secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        return f"{encoded}.{sig}"

    @classmethod
    def _verify_token(cls, token: str) -> dict[str, str] | None:
        """Verify an HMAC-signed token and return the payload, or ``None``."""
        parts = token.split(".", 1)
        if len(parts) != 2:
            return None
        encoded, sig = parts
        expected = hmac.new(cls._secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        try:
            payload: dict[str, str] = json.loads(base64.urlsafe_b64decode(encoded))
        except (json.JSONDecodeError, ValueError):
            return None
        return payload

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @staticmethod
    async def send_invitation(
        db: AsyncSession,
        assignment_id: uuid.UUID,
        personal_message: str | None,
        user_id: uuid.UUID,
    ) -> InvitationSendResponse:
        """Send an invitation email for a ticket assignment.

        Args:
            db: Async database session.
            assignment_id: The ticket assignment to invite.
            personal_message: Optional message from the purchaser.
            user_id: The authenticated purchaser's user id.

        Returns:
            InvitationSendResponse with invitation details.

        Raises:
            HTTPException 404: Assignment not found or not owned by user.
            HTTPException 400: Assignment not in a valid status for inviting.
            HTTPException 429: Rate limit exceeded (max 5 per assignment).
        """
        # Load assignment with purchase (for ownership check) and event
        stmt = (
            select(TicketAssignment)
            .where(TicketAssignment.id == assignment_id)
            .options(
                selectinload(TicketAssignment.ticket_purchase),
                selectinload(TicketAssignment.event),
            )
        )
        result = await db.execute(stmt)
        assignment = result.scalar_one_or_none()

        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found",
            )

        # Verify assignment belongs to the user's purchase
        if assignment.ticket_purchase.user_id != user_id:
            logger.warning(
                "Invitation denied: user does not own purchase",
                extra={
                    "user_id": str(user_id),
                    "assignment_id": str(assignment_id),
                    "purchase_user_id": str(assignment.ticket_purchase.user_id),
                },
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found",
            )

        # Status must be 'assigned' or 'invited'
        if assignment.status not in (
            AssignmentStatus.ASSIGNED.value,
            AssignmentStatus.INVITED.value,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot send invitation for assignment with status: {assignment.status}",
            )

        # Rate limit: max 5 invitations per assignment
        if assignment.invitation_count >= MAX_INVITATIONS_PER_ASSIGNMENT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Maximum of {MAX_INVITATIONS_PER_ASSIGNMENT} invitations "
                    f"per assignment has been reached"
                ),
            )

        # Compute token expiry: event date + 24 hours
        event: Event = assignment.event
        expires_at = event.event_datetime + timedelta(hours=24)

        # Generate HMAC-signed token
        token = TicketInvitationService._generate_token(
            assignment_id=assignment.id,
            guest_email=assignment.guest_email,
            event_id=event.id,
            expires_at=expires_at,
        )

        now = datetime.now(UTC)

        # Create TicketInvitation record
        invitation = TicketInvitation(
            assignment_id=assignment.id,
            email_address=assignment.guest_email,
            invitation_token=token,
            token_expires_at=expires_at,
            sent_at=now,
        )
        db.add(invitation)

        # Update assignment status and tracking fields
        assignment.status = AssignmentStatus.INVITED.value
        assignment.invitation_sent_at = now
        assignment.invitation_count = assignment.invitation_count + 1

        await db.flush()
        await db.refresh(invitation)

        # Placeholder: log the invitation URL instead of sending email
        invitation_url = f"{settings.frontend_donor_url}/invitations/{token}"
        logger.info(
            "Ticket invitation sent",
            extra={
                "assignment_id": str(assignment_id),
                "email": assignment.guest_email,
                "invitation_id": str(invitation.id),
                "invitation_url": invitation_url,
                "personal_message": personal_message,
            },
        )

        # Audit log: ticket_invitation_sent
        audit = TicketAuditLog(
            entity_type="ticket_invitation",
            entity_id=invitation.id,
            coordinator_id=user_id,
            field_name="ticket_invitation_sent",
            old_value=None,
            new_value=json.dumps(
                {
                    "assignment_id": str(assignment_id),
                    "email": assignment.guest_email,
                    "invitation_count": assignment.invitation_count,
                }
            ),
        )
        db.add(audit)

        await db.commit()

        return InvitationSendResponse(
            invitation_id=invitation.id,
            assignment_id=assignment.id,
            email_address=assignment.guest_email,
            sent_at=now,
            invitation_count=assignment.invitation_count,
        )

    @staticmethod
    async def resend_invitation(
        db: AsyncSession,
        assignment_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> InvitationSendResponse:
        """Resend an invitation for an existing ticket assignment.

        Identical to :meth:`send_invitation` but called without a new personal
        message.  The 5-per-assignment rate limit still applies.
        """
        return await TicketInvitationService.send_invitation(
            db=db,
            assignment_id=assignment_id,
            personal_message=None,
            user_id=user_id,
        )

    @staticmethod
    async def validate_token(
        db: AsyncSession,
        token: str,
    ) -> InvitationValidateResponse:
        """Validate an invitation token and return event/guest details.

        Args:
            db: Async database session.
            token: The HMAC-signed invitation token.

        Returns:
            InvitationValidateResponse describing token validity.
        """
        payload = TicketInvitationService._verify_token(token)
        if payload is None:
            logger.warning("Invalid invitation token signature")
            return InvitationValidateResponse(valid=False)

        # Parse payload fields
        try:
            assignment_id = uuid.UUID(payload["aid"])
            expires_str = payload["exp"]
            expires_at = datetime.fromisoformat(expires_str)
        except (KeyError, ValueError) as exc:
            logger.warning(
                "Malformed invitation token payload",
                extra={"error": str(exc)},
            )
            return InvitationValidateResponse(valid=False)

        # Check expiry
        if datetime.now(UTC) > expires_at:
            logger.info(
                "Invitation token expired",
                extra={"assignment_id": str(assignment_id)},
            )
            return InvitationValidateResponse(valid=False, expired=True)

        # Look up assignment + event
        stmt = (
            select(TicketAssignment)
            .where(TicketAssignment.id == assignment_id)
            .options(selectinload(TicketAssignment.event))
        )
        result = await db.execute(stmt)
        assignment = result.scalar_one_or_none()

        if assignment is None:
            return InvitationValidateResponse(valid=False)

        event: Event = assignment.event

        # Already registered?
        if assignment.status == AssignmentStatus.REGISTERED.value:
            return InvitationValidateResponse(
                valid=False,
                already_registered=True,
                event_name=event.name,
                event_date=event.event_datetime,
                event_slug=event.slug,
                guest_name=assignment.guest_name,
                guest_email=assignment.guest_email,
                assignment_id=assignment.id,
            )

        return InvitationValidateResponse(
            valid=True,
            event_name=event.name,
            event_date=event.event_datetime,
            event_slug=event.slug,
            guest_name=assignment.guest_name,
            guest_email=assignment.guest_email,
            assignment_id=assignment.id,
        )

    @staticmethod
    async def register_via_invitation(
        db: AsyncSession,
        token: str,
        user_id: uuid.UUID,
        request: InvitationRegisterRequest,
    ) -> InvitationRegisterResponse:
        """Complete guest registration using an invitation token.

        Args:
            db: Async database session.
            token: HMAC-signed invitation token.
            user_id: Authenticated user completing registration.
            request: Registration details (phone, meal, custom responses).

        Returns:
            InvitationRegisterResponse on success.

        Raises:
            HTTPException 400: Token invalid / expired / already registered.
            HTTPException 403: User email does not match invitation.
        """
        # Validate token
        validation = await TicketInvitationService.validate_token(db, token)

        if not validation.valid:
            if validation.expired:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invitation token has expired",
                )
            if validation.already_registered:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This invitation has already been registered",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid invitation token",
            )

        # Fetch user to verify email match
        user_stmt = select(User).where(User.id == user_id)
        user_result = await db.execute(user_stmt)
        user = user_result.scalar_one_or_none()

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not found",
            )

        if user.email.lower() != (validation.guest_email or "").lower():
            logger.warning(
                "Invitation email mismatch",
                extra={
                    "user_email": user.email,
                    "invitation_email": validation.guest_email,
                    "assignment_id": str(validation.assignment_id),
                },
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your email does not match the invitation",
            )

        assignment_id = validation.assignment_id
        assert assignment_id is not None  # guaranteed by valid=True  # noqa: S101

        # Re-load assignment with relationships for update
        stmt = (
            select(TicketAssignment)
            .where(TicketAssignment.id == assignment_id)
            .options(
                selectinload(TicketAssignment.event),
                selectinload(TicketAssignment.assigned_ticket),
            )
        )
        result = await db.execute(stmt)
        assignment = result.scalar_one_or_none()

        if assignment is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignment no longer exists",
            )

        event: Event = assignment.event

        # Create EventRegistration
        registration = EventRegistration(
            user_id=user_id,
            event_id=event.id,
            ticket_purchase_id=assignment.ticket_purchase_id,
            number_of_guests=1,
        )
        db.add(registration)
        await db.flush()

        # Create RegistrationGuest
        guest = RegistrationGuest(
            registration_id=registration.id,
            user_id=user_id,
            name=assignment.guest_name,
            email=assignment.guest_email,
            phone=request.phone,
            is_primary=True,
            status="confirmed",
        )
        db.add(guest)

        # Create OptionResponse entries for custom_responses
        for option_id_str, response_value in request.custom_responses.items():
            try:
                option_uuid = uuid.UUID(option_id_str)
            except ValueError:
                logger.warning(
                    "Skipping invalid option_id in custom_responses",
                    extra={"option_id": option_id_str},
                )
                continue

            option_response = OptionResponse(
                ticket_purchase_id=assignment.ticket_purchase_id,
                custom_option_id=option_uuid,
                response_value=response_value,
            )
            db.add(option_response)

        now = datetime.now(UTC)

        # Update assignment
        assignment.status = AssignmentStatus.REGISTERED.value
        assignment.registered_at = now
        assignment.assignee_user_id = user_id
        assignment.registration_id = registration.id

        # Update AssignedTicket.assignment_status
        assigned_ticket: AssignedTicket = assignment.assigned_ticket
        assigned_ticket.assignment_status = "registered"

        # Update the most recent TicketInvitation for this assignment
        inv_stmt = (
            select(TicketInvitation)
            .where(TicketInvitation.assignment_id == assignment_id)
            .order_by(TicketInvitation.sent_at.desc())
            .limit(1)
        )
        inv_result = await db.execute(inv_stmt)
        latest_invitation = inv_result.scalar_one_or_none()
        if latest_invitation is not None:
            latest_invitation.registered_at = now

        await db.commit()

        logger.info(
            "Guest registered via invitation",
            extra={
                "assignment_id": str(assignment_id),
                "user_id": str(user_id),
                "registration_id": str(registration.id),
                "event_id": str(event.id),
            },
        )

        # Audit log: ticket_invitation_registered
        audit = TicketAuditLog(
            entity_type="ticket_invitation",
            entity_id=assignment_id,
            coordinator_id=user_id,
            field_name="ticket_invitation_registered",
            old_value=None,
            new_value=json.dumps(
                {
                    "assignment_id": str(assignment_id),
                    "registration_id": str(registration.id),
                    "event_id": str(event.id),
                }
            ),
        )
        db.add(audit)

        return InvitationRegisterResponse(
            registration_id=registration.id,
            event_id=event.id,
            event_slug=event.slug,
            status="registered",
        )
