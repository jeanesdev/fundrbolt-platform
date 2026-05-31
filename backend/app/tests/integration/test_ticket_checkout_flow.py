"""Scenario-driven integration tests for ticket browsing and checkout."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event, EventStatus
from app.models.payment_transaction import PaymentTransaction
from app.models.ticket_management import (
    PromoCode,
    PromoCodeApplication,
    TicketAuditLog,
    TicketPackage,
    TicketPurchase,
)

pytestmark = pytest.mark.asyncio


async def test_ticket_cart_validation_and_checkout_create_inventory(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_approved_npo: Any,
    test_npo_admin_user: Any,
    test_donor_token: str,
    test_donor_user: Any,
) -> None:
    event = Event(
        npo_id=test_approved_npo.id,
        name="Checkout Flow Gala",
        slug="checkout-flow-gala",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=14),
        timezone="America/New_York",
        venue_name="FundrBolt Hall",
        max_tickets_per_donor=4,
        version=1,
        created_by=test_npo_admin_user.id,
        updated_by=test_npo_admin_user.id,
    )
    db_session.add(event)
    await db_session.flush()

    package = TicketPackage(
        event_id=event.id,
        created_by=test_npo_admin_user.id,
        name="General Admission",
        description="Single seat",
        price=Decimal("100.00"),
        seats_per_package=1,
        quantity_limit=10,
        sold_count=0,
        is_enabled=True,
        display_order=0,
    )
    promo = PromoCode(
        event_id=event.id,
        created_by=test_npo_admin_user.id,
        code="SAVE10",
        discount_type="percentage",
        discount_value=Decimal("10.00"),
        used_count=0,
        is_active=True,
        version=1,
    )
    db_session.add_all([package, promo])
    await db_session.commit()

    public_response = await async_client.get(f"/api/v1/events/{event.slug}/tickets")
    assert public_response.status_code == 200
    public_packages = public_response.json()
    assert len(public_packages) == 1
    assert public_packages[0]["name"] == "General Admission"

    donor_headers = {"Authorization": f"Bearer {test_donor_token}"}
    validate_response = await async_client.post(
        f"/api/v1/events/{event.id}/tickets/validate-cart",
        json={
            "items": [{"package_id": str(package.id), "quantity": 2}],
            "promo_code": "SAVE10",
        },
        headers=donor_headers,
    )
    assert validate_response.status_code == 200
    validation = validate_response.json()
    assert Decimal(validation["subtotal"]) == Decimal("200.00")
    assert Decimal(validation["discount"]) == Decimal("20.00")
    assert Decimal(validation["total"]) == Decimal("180.00")
    assert validation["promo_code_applied"] == "SAVE10"

    checkout_response = await async_client.post(
        f"/api/v1/events/{event.id}/tickets/checkout",
        json={
            "items": [{"package_id": str(package.id), "quantity": 2}],
            "promo_code": "SAVE10",
        },
        headers=donor_headers,
    )
    assert checkout_response.status_code == 201, checkout_response.json()
    checkout_data = checkout_response.json()
    assert checkout_data["success"] is True
    assert Decimal(checkout_data["total_charged"]) == Decimal("180.00")
    assert len(checkout_data["purchases"]) == 1
    assert len(checkout_data["purchases"][0]["ticket_numbers"]) == 2

    purchase_result = await db_session.execute(
        select(TicketPurchase).where(
            TicketPurchase.event_id == event.id,
            TicketPurchase.user_id == test_donor_user.id,
        )
    )
    purchase = purchase_result.scalar_one()
    assert purchase.quantity == 2
    assert purchase.total_price == Decimal("200.00")

    await db_session.refresh(package)
    assert package.sold_count == 2
    await db_session.refresh(promo)
    assert promo.used_count == 1

    promo_application_result = await db_session.execute(
        select(PromoCodeApplication).where(PromoCodeApplication.ticket_purchase_id == purchase.id)
    )
    promo_application = promo_application_result.scalar_one()
    assert promo_application.discount_amount == Decimal("20.00")

    audit_result = await db_session.execute(
        select(TicketAuditLog).where(TicketAuditLog.entity_id == purchase.id)
    )
    assert audit_result.scalar_one_or_none() is not None

    inventory_response = await async_client.get(
        "/api/v1/tickets/my-inventory",
        headers=donor_headers,
    )
    assert inventory_response.status_code == 200
    inventory = inventory_response.json()
    assert inventory["total_tickets"] == 2
    assert inventory["total_unassigned"] == 2


async def test_payment_session_is_idempotent_for_pending_transactions(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_active_event: Event,
    test_donor_token: str,
    test_donor_user: Any,
) -> None:
    idempotency_key = f"integration-{uuid.uuid4().hex}"
    donor_headers = {"Authorization": f"Bearer {test_donor_token}"}
    payload = {
        "event_id": str(test_active_event.id),
        "line_items": [
            {"type": "ticket", "label": "General Admission", "amount": "125.00"},
        ],
        "save_profile": False,
        "return_url": "http://localhost:5174/checkout/complete",
        "idempotency_key": idempotency_key,
    }

    first_response = await async_client.post(
        "/api/v1/payments/session",
        json=payload,
        headers=donor_headers,
    )
    assert first_response.status_code == 201, first_response.json()

    second_response = await async_client.post(
        "/api/v1/payments/session",
        json=payload,
        headers=donor_headers,
    )
    assert second_response.status_code == 201, second_response.json()

    first_data = first_response.json()
    second_data = second_response.json()
    assert first_data["transaction_id"] == second_data["transaction_id"]
    assert first_data["hpf_url"] == second_data["hpf_url"]

    transaction_result = await db_session.execute(
        select(PaymentTransaction).where(
            PaymentTransaction.user_id == test_donor_user.id,
            PaymentTransaction.idempotency_key == idempotency_key,
        )
    )
    transactions = transaction_result.scalars().all()
    assert len(transactions) == 1
