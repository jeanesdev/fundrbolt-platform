"""Contract tests for self-registration via ticket assignments."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_self_register_accepts_verified_communications_email(
    donor_client: AsyncClient,
    db_session: AsyncSession,
    test_donor_user: Any,
    test_approved_npo: Any,
) -> None:
    """Donors can self-register when assigning a ticket to their verified communications email."""
    from app.models.event import Event, EventStatus
    from app.models.ticket_management import AssignedTicket, TicketPackage, TicketPurchase

    test_donor_user.communications_email = "donor+events@test.com"
    test_donor_user.communications_email_verified = True
    await db_session.commit()
    await db_session.refresh(test_donor_user)

    event = Event(
        npo_id=test_approved_npo.id,
        name="Communications Email Gala",
        slug="communications-email-gala",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=30),
        timezone="America/New_York",
        venue_name="FundrBolt Hall",
        version=1,
        created_by=test_donor_user.id,
        updated_by=test_donor_user.id,
    )
    db_session.add(event)
    await db_session.flush()

    package = TicketPackage(
        event_id=event.id,
        created_by=test_donor_user.id,
        name="General Admission",
        description="Single seat",
        price=Decimal("125.00"),
        seats_per_package=1,
        quantity_limit=None,
        sold_count=0,
        is_enabled=True,
        display_order=0,
    )
    db_session.add(package)
    await db_session.flush()

    purchase = TicketPurchase(
        user_id=test_donor_user.id,
        event_id=event.id,
        ticket_package_id=package.id,
        quantity=1,
        total_price=Decimal("125.00"),
        payment_status="completed",
        purchaser_name=test_donor_user.full_name,
        purchaser_email=test_donor_user.email,
        purchaser_phone=test_donor_user.phone,
    )
    db_session.add(purchase)
    await db_session.flush()

    ticket = AssignedTicket(
        ticket_purchase_id=purchase.id,
        ticket_number=1,
        qr_code="COMM-EMAIL-1",
        assignment_status="unassigned",
    )
    db_session.add(ticket)
    await db_session.commit()

    assign_response = await donor_client.post(
        f"/api/v1/tickets/{ticket.id}/assign",
        json={
            "guest_name": test_donor_user.full_name,
            "guest_email": test_donor_user.communications_email,
        },
    )

    assert assign_response.status_code == 201
    assignment = assign_response.json()
    assert assignment["is_self_assignment"] is True

    register_response = await donor_client.post(
        f"/api/v1/tickets/assignments/{assignment['id']}/self-register",
        json={"phone": test_donor_user.phone},
    )

    assert register_response.status_code == 201
    data = register_response.json()
    assert data["assignment_id"] == assignment["id"]
    assert data["event_id"] == str(event.id)
    assert data["status"] == "registered"


@pytest.mark.asyncio
async def test_self_register_recovers_stale_self_assignment_flag(
    donor_client: AsyncClient,
    db_session: AsyncSession,
    test_donor_user: Any,
    test_approved_npo: Any,
) -> None:
    """Self-registration should work for older assignments whose self flag was stored incorrectly."""
    from app.models.event import Event, EventStatus
    from app.models.ticket_management import (
        AssignedTicket,
        TicketAssignment,
        TicketPackage,
        TicketPurchase,
    )

    test_donor_user.communications_email = "donor+recover@test.com"
    test_donor_user.communications_email_verified = True
    await db_session.commit()
    await db_session.refresh(test_donor_user)

    event = Event(
        npo_id=test_approved_npo.id,
        name="Recovered Self Assignment Gala",
        slug="recovered-self-assignment-gala",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=15),
        timezone="America/New_York",
        venue_name="FundrBolt Hall",
        version=1,
        created_by=test_donor_user.id,
        updated_by=test_donor_user.id,
    )
    db_session.add(event)
    await db_session.flush()

    package = TicketPackage(
        event_id=event.id,
        created_by=test_donor_user.id,
        name="General Admission",
        description="Single seat",
        price=Decimal("125.00"),
        seats_per_package=1,
        quantity_limit=None,
        sold_count=0,
        is_enabled=True,
        display_order=0,
    )
    db_session.add(package)
    await db_session.flush()

    purchase = TicketPurchase(
        user_id=test_donor_user.id,
        event_id=event.id,
        ticket_package_id=package.id,
        quantity=1,
        total_price=Decimal("125.00"),
        payment_status="completed",
        purchaser_name=test_donor_user.full_name,
        purchaser_email=test_donor_user.email,
        purchaser_phone=test_donor_user.phone,
    )
    db_session.add(purchase)
    await db_session.flush()

    ticket = AssignedTicket(
        ticket_purchase_id=purchase.id,
        ticket_number=1,
        qr_code="RECOVER-SELF-1",
        assignment_status="assigned",
    )
    db_session.add(ticket)
    await db_session.flush()

    assignment = TicketAssignment(
        assigned_ticket_id=ticket.id,
        ticket_purchase_id=purchase.id,
        event_id=event.id,
        assigned_by_user_id=test_donor_user.id,
        guest_name=test_donor_user.full_name,
        guest_email=test_donor_user.communications_email,
        status="assigned",
        is_self_assignment=False,
    )
    db_session.add(assignment)
    await db_session.commit()

    register_response = await donor_client.post(
        f"/api/v1/tickets/assignments/{assignment.id}/self-register",
        json={"phone": test_donor_user.phone},
    )

    assert register_response.status_code == 201

    await db_session.refresh(assignment)
    assert assignment.is_self_assignment is True
    assert assignment.status == "registered"


@pytest.mark.asyncio
async def test_purchaser_can_cancel_self_registration(
    donor_client: AsyncClient,
    db_session: AsyncSession,
    test_donor_user: Any,
    test_approved_npo: Any,
) -> None:
    """Donors can cancel a completed self-registration from their owned ticket."""
    from app.models.event import Event, EventStatus
    from app.models.ticket_management import (
        AssignedTicket,
        TicketAssignment,
        TicketPackage,
        TicketPurchase,
    )

    event = Event(
        npo_id=test_approved_npo.id,
        name="Self Registration Cancel Gala",
        slug="self-registration-cancel-gala",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=30),
        timezone="America/New_York",
        venue_name="FundrBolt Hall",
        version=1,
        created_by=test_donor_user.id,
        updated_by=test_donor_user.id,
    )
    db_session.add(event)
    await db_session.flush()

    package = TicketPackage(
        event_id=event.id,
        created_by=test_donor_user.id,
        name="General Admission",
        description="Single seat",
        price=Decimal("125.00"),
        seats_per_package=1,
        quantity_limit=None,
        sold_count=0,
        is_enabled=True,
        display_order=0,
    )
    db_session.add(package)
    await db_session.flush()

    purchase = TicketPurchase(
        user_id=test_donor_user.id,
        event_id=event.id,
        ticket_package_id=package.id,
        quantity=1,
        total_price=Decimal("125.00"),
        payment_status="completed",
        purchaser_name=test_donor_user.full_name,
        purchaser_email=test_donor_user.email,
        purchaser_phone=test_donor_user.phone,
    )
    db_session.add(purchase)
    await db_session.flush()

    ticket = AssignedTicket(
        ticket_purchase_id=purchase.id,
        ticket_number=1,
        qr_code="CANCEL-SELF-1",
        assignment_status="unassigned",
    )
    db_session.add(ticket)
    await db_session.commit()

    assign_response = await donor_client.post(
        f"/api/v1/tickets/{ticket.id}/assign",
        json={
            "guest_name": test_donor_user.full_name,
            "guest_email": test_donor_user.email,
        },
    )

    assert assign_response.status_code == 201
    assignment = assign_response.json()

    register_response = await donor_client.post(
        f"/api/v1/tickets/assignments/{assignment['id']}/self-register",
        json={"phone": test_donor_user.phone},
    )

    assert register_response.status_code == 201

    cancel_response = await donor_client.post(
        f"/api/v1/tickets/assignments/{assignment['id']}/cancel-registration"
    )

    assert cancel_response.status_code == 204

    reassign_response = await donor_client.post(
        f"/api/v1/tickets/{ticket.id}/assign",
        json={
            "guest_name": "New Guest",
            "guest_email": "new-guest@example.com",
        },
    )

    assert reassign_response.status_code == 201
    reassign_data = reassign_response.json()
    assert reassign_data["id"] == assignment["id"]
    assert reassign_data["guest_name"] == "New Guest"
    assert reassign_data["guest_email"] == "new-guest@example.com"
    assert reassign_data["status"] == "assigned"
    assert reassign_data["is_self_assignment"] is False

    await db_session.refresh(ticket)
    assert ticket.assignment_status == "assigned"

    assignment_row = await db_session.get(TicketAssignment, assignment["id"])
    assert assignment_row is not None
    assert assignment_row.status == "assigned"
    assert assignment_row.guest_name == "New Guest"
    assert assignment_row.guest_email == "new-guest@example.com"
    assert assignment_row.cancelled_at is None
    assert assignment_row.cancelled_by is None


@pytest.mark.asyncio
async def test_purchaser_cancelling_registered_guest_sends_cancellation_email(
    donor_client: AsyncClient,
    db_session: AsyncSession,
    test_donor_user: Any,
    test_approved_npo: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Revoking a registered guest ticket should notify the guest by email."""
    from app.models.event import Event, EventStatus
    from app.models.event_registration import EventRegistration
    from app.models.ticket_management import (
        AssignedTicket,
        TicketAssignment,
        TicketPackage,
        TicketPurchase,
    )
    from app.services import ticket_assignment_service as ticket_assignment_module

    class FakeEmailService:
        def __init__(self) -> None:
            self.calls: list[dict[str, Any]] = []

        async def send_ticket_registration_cancelled_email(self, **kwargs: Any) -> bool:
            self.calls.append(kwargs)
            return True

    fake_email_service = FakeEmailService()
    monkeypatch.setattr(
        ticket_assignment_module,
        "get_email_service",
        lambda: fake_email_service,
    )

    event = Event(
        npo_id=test_approved_npo.id,
        name="Registered Guest Cancellation Gala",
        slug="registered-guest-cancellation-gala",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=30),
        timezone="America/New_York",
        venue_name="FundrBolt Hall",
        venue_address="123 Main St",
        version=1,
        created_by=test_donor_user.id,
        updated_by=test_donor_user.id,
    )
    db_session.add(event)
    await db_session.flush()

    package = TicketPackage(
        event_id=event.id,
        created_by=test_donor_user.id,
        name="General Admission",
        description="Single seat",
        price=Decimal("125.00"),
        seats_per_package=1,
        quantity_limit=None,
        sold_count=0,
        is_enabled=True,
        display_order=0,
    )
    db_session.add(package)
    await db_session.flush()

    purchase = TicketPurchase(
        user_id=test_donor_user.id,
        event_id=event.id,
        ticket_package_id=package.id,
        quantity=1,
        total_price=Decimal("125.00"),
        payment_status="completed",
        purchaser_name=test_donor_user.full_name,
        purchaser_email=test_donor_user.email,
        purchaser_phone=test_donor_user.phone,
    )
    db_session.add(purchase)
    await db_session.flush()

    ticket = AssignedTicket(
        ticket_purchase_id=purchase.id,
        ticket_number=1,
        qr_code="REGISTERED-GUEST-CANCEL-1",
        assignment_status="registered",
    )
    db_session.add(ticket)
    await db_session.flush()

    registration = EventRegistration(
        user_id=test_donor_user.id,
        event_id=event.id,
        ticket_purchase_id=purchase.id,
        number_of_guests=1,
    )
    registration.status = "confirmed"
    db_session.add(registration)
    await db_session.flush()

    assignment = TicketAssignment(
        assigned_ticket_id=ticket.id,
        ticket_purchase_id=purchase.id,
        event_id=event.id,
        assigned_by_user_id=test_donor_user.id,
        guest_name="Registered Guest",
        guest_email="registered-guest@example.com",
        status="registered",
        is_self_assignment=False,
        registration_id=registration.id,
    )
    db_session.add(assignment)
    await db_session.commit()

    cancel_response = await donor_client.post(
        f"/api/v1/tickets/assignments/{assignment.id}/cancel-registration"
    )

    assert cancel_response.status_code == 204
    assert len(fake_email_service.calls) == 1
    assert fake_email_service.calls[0]["to_email"] == "registered-guest@example.com"
    assert fake_email_service.calls[0]["guest_name"] == "Registered Guest"
    assert fake_email_service.calls[0]["event_name"] == "Registered Guest Cancellation Gala"
    assert fake_email_service.calls[0]["revoked_by_name"] == test_donor_user.full_name
    assert fake_email_service.calls[0]["revoked_by_email"] == test_donor_user.email


@pytest.mark.asyncio
async def test_cancelled_assignment_invalidates_existing_invitation_token(
    donor_client: AsyncClient,
    db_session: AsyncSession,
    test_donor_user: Any,
    test_approved_npo: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Guests should not be able to use an invite after the purchaser revokes the ticket."""
    from app.models.event import Event, EventStatus
    from app.models.ticket_management import (
        AssignedTicket,
        TicketAssignment,
        TicketInvitation,
        TicketPackage,
        TicketPurchase,
    )
    from app.services import ticket_invitation_service as ticket_invitation_module

    class FakeEmailService:
        async def send_ticket_assignment_invitation_email(self, **kwargs: Any) -> bool:
            return True

    monkeypatch.setattr(
        ticket_invitation_module,
        "get_email_service",
        lambda: FakeEmailService(),
    )

    event = Event(
        npo_id=test_approved_npo.id,
        name="Cancelled Invite Gala",
        slug="cancelled-invite-gala",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=30),
        timezone="America/New_York",
        venue_name="FundrBolt Hall",
        version=1,
        created_by=test_donor_user.id,
        updated_by=test_donor_user.id,
    )
    db_session.add(event)
    await db_session.flush()

    package = TicketPackage(
        event_id=event.id,
        created_by=test_donor_user.id,
        name="General Admission",
        description="Single seat",
        price=Decimal("125.00"),
        seats_per_package=1,
        quantity_limit=None,
        sold_count=0,
        is_enabled=True,
        display_order=0,
    )
    db_session.add(package)
    await db_session.flush()

    purchase = TicketPurchase(
        user_id=test_donor_user.id,
        event_id=event.id,
        ticket_package_id=package.id,
        quantity=1,
        total_price=Decimal("125.00"),
        payment_status="completed",
        purchaser_name=test_donor_user.full_name,
        purchaser_email=test_donor_user.email,
        purchaser_phone=test_donor_user.phone,
    )
    db_session.add(purchase)
    await db_session.flush()

    ticket = AssignedTicket(
        ticket_purchase_id=purchase.id,
        ticket_number=1,
        qr_code="CANCELLED-INVITE-1",
        assignment_status="unassigned",
    )
    db_session.add(ticket)
    await db_session.commit()

    assign_response = await donor_client.post(
        f"/api/v1/tickets/{ticket.id}/assign",
        json={
            "guest_name": "Cancelled Invite Guest",
            "guest_email": "cancelled-invite-guest@example.com",
        },
    )
    assert assign_response.status_code == 201
    assignment = assign_response.json()

    invite_response = await donor_client.post(
        f"/api/v1/tickets/assignments/{assignment['id']}/invite",
        json={"personal_message": "Please join us."},
    )
    assert invite_response.status_code == 201

    invitation = (
        (
            await db_session.execute(
                select(TicketInvitation)
                .join(TicketAssignment, TicketAssignment.id == TicketInvitation.assignment_id)
                .where(TicketAssignment.id == assignment["id"])
                .order_by(TicketInvitation.sent_at.desc())
                .limit(1)
            )
        )
        .scalars()
        .one()
    )

    cancel_response = await donor_client.delete(f"/api/v1/tickets/assignments/{assignment['id']}")
    assert cancel_response.status_code == 204

    validate_response = await donor_client.get(
        f"/api/v1/invitations/{invitation.invitation_token}/validate"
    )
    assert validate_response.status_code == 200
    assert validate_response.json()["valid"] is False
