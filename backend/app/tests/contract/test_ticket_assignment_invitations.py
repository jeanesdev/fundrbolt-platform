"""Contract tests for donor ticket assignment invitation endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_send_ticket_assignment_invitation_attempts_email_delivery(
    donor_client: AsyncClient,
    db_session: AsyncSession,
    test_donor_user: Any,
    test_approved_npo: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sending a ticket invitation should attempt transactional email delivery."""
    from app.models.event import Event, EventStatus
    from app.models.ticket_management import (
        AssignedTicket,
        TicketAssignment,
        TicketPackage,
        TicketPurchase,
    )
    from app.services import ticket_invitation_service as ticket_invitation_module

    class FakeEmailService:
        def __init__(self) -> None:
            self.calls: list[dict[str, Any]] = []

        async def send_ticket_assignment_invitation_email(self, **kwargs: Any) -> bool:
            self.calls.append(kwargs)
            return True

    fake_email_service = FakeEmailService()
    monkeypatch.setattr(
        ticket_invitation_module,
        "get_email_service",
        lambda: fake_email_service,
    )

    event = Event(
        npo_id=test_approved_npo.id,
        name="Invite Flow Gala",
        slug="invite-flow-gala",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=14),
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
        display_order=0,
        is_enabled=True,
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
        qr_code="INVITE-FLOW-1",
        assignment_status="assigned",
    )
    db_session.add(ticket)
    await db_session.flush()

    assignment = TicketAssignment(
        assigned_ticket_id=ticket.id,
        ticket_purchase_id=purchase.id,
        event_id=event.id,
        assigned_by_user_id=test_donor_user.id,
        guest_name="Guest Person",
        guest_email="guest@example.com",
        status="assigned",
        is_self_assignment=False,
    )
    db_session.add(assignment)
    await db_session.commit()

    response = await donor_client.post(
        f"/api/v1/tickets/assignments/{assignment.id}/invite",
        json={"personal_message": "Looking forward to seeing you there."},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["assignment_id"] == str(assignment.id)
    assert data["email_address"] == "guest@example.com"
    assert fake_email_service.calls, "Expected the invite flow to call the email service"
    assert fake_email_service.calls[0]["to_email"] == "guest@example.com"
    assert fake_email_service.calls[0]["event_name"] == "Invite Flow Gala"
    assert fake_email_service.calls[0]["personal_message"] == "Looking forward to seeing you there."


@pytest.mark.asyncio
async def test_resend_invitation_creates_new_token_and_inventory_reports_invited_status(
    donor_client: AsyncClient,
    db_session: AsyncSession,
    test_donor_user: Any,
    test_approved_npo: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Resending an invitation should not collide on token uniqueness and inventory should expose invited status."""
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
        name="Invite Resend Gala",
        slug="invite-resend-gala",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=14),
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
        display_order=0,
        is_enabled=True,
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
        qr_code="INVITE-RESEND-1",
        assignment_status="assigned",
    )
    db_session.add(ticket)
    await db_session.flush()

    assignment = TicketAssignment(
        assigned_ticket_id=ticket.id,
        ticket_purchase_id=purchase.id,
        event_id=event.id,
        assigned_by_user_id=test_donor_user.id,
        guest_name="Guest Person",
        guest_email="guest@example.com",
        status="assigned",
        is_self_assignment=False,
    )
    db_session.add(assignment)
    await db_session.commit()

    first_response = await donor_client.post(
        f"/api/v1/tickets/assignments/{assignment.id}/invite",
        json={"personal_message": "First invite"},
    )
    assert first_response.status_code == 201

    second_response = await donor_client.post(
        f"/api/v1/tickets/assignments/{assignment.id}/resend-invite"
    )
    assert second_response.status_code == 200

    invitations = (
        (
            await db_session.execute(
                select(TicketInvitation)
                .where(TicketInvitation.assignment_id == assignment.id)
                .order_by(TicketInvitation.sent_at.asc())
            )
        )
        .scalars()
        .all()
    )
    assert len(invitations) == 2
    assert invitations[0].invitation_token != invitations[1].invitation_token

    await db_session.refresh(assignment)
    assert assignment.status == "invited"
    assert assignment.invitation_count == 2

    inventory_response = await donor_client.get("/api/v1/tickets/my-inventory")
    assert inventory_response.status_code == 200
    inventory = inventory_response.json()
    matching_ticket: dict[str, Any] | None = None
    for event_summary in inventory["events"]:
        for purchase_summary in event_summary["purchases"]:
            for ticket_summary in purchase_summary["tickets"]:
                if ticket_summary["id"] == str(ticket.id):
                    matching_ticket = ticket_summary
                    break
            if matching_ticket is not None:
                break
        if matching_ticket is not None:
            break

    assert matching_ticket is not None
    assert matching_ticket["assignment_status"] == "invited"
    assert matching_ticket["assignment"]["status"] == "invited"
    assert matching_ticket["assignment"]["invitation_count"] == 2
    assert UUID(second_response.json()["invitation_id"]) == invitations[1].id


@pytest.mark.asyncio
async def test_cancelled_assignment_is_hidden_from_ticket_inventory(
    donor_client: AsyncClient,
    db_session: AsyncSession,
    test_donor_user: Any,
    test_approved_npo: Any,
) -> None:
    """Cancelled assignments should serialize as unassigned tickets in inventory."""
    from app.models.event import Event, EventStatus
    from app.models.ticket_management import AssignedTicket, TicketPackage, TicketPurchase

    event = Event(
        npo_id=test_approved_npo.id,
        name="Inventory Revoke Gala",
        slug="inventory-revoke-gala",
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
        display_order=0,
        is_enabled=True,
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
        qr_code="INVENTORY-REVOKE-1",
        assignment_status="unassigned",
    )
    db_session.add(ticket)
    await db_session.commit()

    assign_response = await donor_client.post(
        f"/api/v1/tickets/{ticket.id}/assign",
        json={
            "guest_name": "Inventory Guest",
            "guest_email": "inventory-guest@example.com",
        },
    )
    assert assign_response.status_code == 201

    cancel_response = await donor_client.delete(
        f"/api/v1/tickets/assignments/{assign_response.json()['id']}"
    )
    assert cancel_response.status_code == 204

    inventory_response = await donor_client.get("/api/v1/tickets/my-inventory")
    assert inventory_response.status_code == 200
    inventory = inventory_response.json()

    matching_ticket: dict[str, Any] | None = None
    for event_summary in inventory["events"]:
        for purchase_summary in event_summary["purchases"]:
            for ticket_summary in purchase_summary["tickets"]:
                if ticket_summary["id"] == str(ticket.id):
                    matching_ticket = ticket_summary
                    break
            if matching_ticket is not None:
                break
        if matching_ticket is not None:
            break

    assert matching_ticket is not None
    assert matching_ticket["assignment_status"] == "unassigned"
    assert matching_ticket["assignment"] is None
