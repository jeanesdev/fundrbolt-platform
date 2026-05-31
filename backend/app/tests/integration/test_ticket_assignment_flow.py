"""Scenario-driven integration tests for ticket assignment lifecycle."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event, EventStatus
from app.models.ticket_management import (
    AssignedTicket,
    TicketAssignment,
    TicketPackage,
    TicketPurchase,
)

pytestmark = pytest.mark.asyncio


async def test_ticket_assignment_self_register_cancel_and_reassign(
    donor_client: AsyncClient,
    db_session: AsyncSession,
    test_donor_user: Any,
    test_approved_npo: Any,
) -> None:
    test_donor_user.communications_email = "donor+assignments@test.com"
    test_donor_user.communications_email_verified = True
    await db_session.commit()
    await db_session.refresh(test_donor_user)

    event = Event(
        npo_id=test_approved_npo.id,
        name="Ticket Assignment Gala",
        slug="ticket-assignment-gala",
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
        quantity=2,
        total_price=Decimal("250.00"),
        payment_status="completed",
        purchaser_name=test_donor_user.full_name,
        purchaser_email=test_donor_user.email,
        purchaser_phone=test_donor_user.phone,
    )
    db_session.add(purchase)
    await db_session.flush()

    first_ticket = AssignedTicket(
        ticket_purchase_id=purchase.id,
        ticket_number=1,
        qr_code="ASSIGN-FLOW-1",
        assignment_status="unassigned",
    )
    second_ticket = AssignedTicket(
        ticket_purchase_id=purchase.id,
        ticket_number=2,
        qr_code="ASSIGN-FLOW-2",
        assignment_status="unassigned",
    )
    db_session.add_all([first_ticket, second_ticket])
    await db_session.commit()

    assign_response = await donor_client.post(
        f"/api/v1/tickets/{first_ticket.id}/assign",
        json={
            "guest_name": test_donor_user.full_name,
            "guest_email": test_donor_user.communications_email,
        },
    )
    assert assign_response.status_code == 201, assign_response.json()
    assignment = assign_response.json()
    assert assignment["is_self_assignment"] is True

    register_response = await donor_client.post(
        f"/api/v1/tickets/assignments/{assignment['id']}/self-register",
        json={"phone": test_donor_user.phone},
    )
    assert register_response.status_code == 201
    assert register_response.json()["status"] == "registered"

    cancel_registration_response = await donor_client.post(
        f"/api/v1/tickets/assignments/{assignment['id']}/cancel-registration"
    )
    assert cancel_registration_response.status_code == 204

    second_assignment_response = await donor_client.post(
        f"/api/v1/tickets/{second_ticket.id}/assign",
        json={
            "guest_name": "Original Guest",
            "guest_email": "original-guest@example.com",
        },
    )
    assert second_assignment_response.status_code == 201, second_assignment_response.json()
    second_assignment = second_assignment_response.json()

    update_response = await donor_client.patch(
        f"/api/v1/tickets/assignments/{second_assignment['id']}",
        json={
            "guest_name": "Updated Guest",
            "guest_email": "updated-guest@example.com",
        },
    )
    assert update_response.status_code == 200, update_response.json()
    assert update_response.json()["guest_name"] == "Updated Guest"
    assert update_response.json()["status"] == "assigned"

    cancel_assignment_response = await donor_client.delete(
        f"/api/v1/tickets/assignments/{second_assignment['id']}"
    )
    assert cancel_assignment_response.status_code == 204

    await db_session.refresh(second_ticket)
    assert second_ticket.assignment_status == "unassigned"

    assignment_result = await db_session.execute(
        select(TicketAssignment).where(TicketAssignment.id == second_assignment["id"])
    )
    assignment_row = assignment_result.scalar_one()
    assert assignment_row.cancelled_at is not None
