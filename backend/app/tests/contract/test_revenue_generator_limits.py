"""Contract tests for Revenue Generator purchase limits."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.registration_guest import RegistrationGuest
from app.models.revenue_generator_item import RevenueGeneratorItem
from app.models.user import User

pytestmark = pytest.mark.asyncio


async def _set_primary_bidder_number(
    db_session: AsyncSession,
    registration_id: Any,
    bidder_number: int,
) -> None:
    stmt = select(RegistrationGuest).where(
        RegistrationGuest.registration_id == registration_id,
        RegistrationGuest.is_primary.is_(True),
    )
    guest = (await db_session.execute(stmt)).scalar_one()
    guest.bidder_number = bidder_number
    await db_session.commit()


async def _create_registration_with_bidder(
    db_session: AsyncSession,
    event_id: Any,
    user: User,
    bidder_number: int,
) -> None:
    registration = EventRegistration(
        event_id=event_id,
        user_id=user.id,
        number_of_guests=1,
    )
    db_session.add(registration)
    await db_session.flush()

    guest = RegistrationGuest(
        registration_id=registration.id,
        user_id=user.id,
        name=f"{user.first_name} {user.last_name}",
        email=user.email,
        phone=user.phone,
        status=RegistrationStatus.CONFIRMED.value,
        is_primary=True,
        bidder_number=bidder_number,
    )
    db_session.add(guest)
    await db_session.commit()


async def _create_revenue_generator_item(
    db_session: AsyncSession,
    event_id: Any,
    *,
    name: str,
    price_per_entry: int,
    max_entries: int,
    max_entries_per_person: int,
) -> RevenueGeneratorItem:
    item = RevenueGeneratorItem(
        event_id=event_id,
        name=name,
        description="Test item",
        price_per_entry=price_per_entry,
        max_entries=max_entries,
        max_entries_per_person=max_entries_per_person,
        is_visible=True,
        is_open_for_entries=True,
        display_order=1,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


class TestRevenueGeneratorLimits:
    async def test_donor_purchase_respects_per_person_limit(
        self,
        super_admin_client: AsyncClient,
        donor_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        db_session: AsyncSession,
    ) -> None:
        await _set_primary_bidder_number(db_session, test_registration.id, bidder_number=410)

        item = await _create_revenue_generator_item(
            db_session,
            test_event.id,
            name="50/50",
            price_per_entry=25,
            max_entries=50,
            max_entries_per_person=2,
        )
        item_id = item.id

        first_purchase = await donor_client.post(
            f"/api/v1/donor/events/{test_event.id}/revenue-generators/{item_id}/entries"
        )
        assert first_purchase.status_code == 201
        assert first_purchase.json()["my_entry_count"] == 1

        second_purchase = await donor_client.post(
            f"/api/v1/donor/events/{test_event.id}/revenue-generators/{item_id}/entries"
        )
        assert second_purchase.status_code == 201
        assert second_purchase.json()["my_entry_count"] == 2

        third_purchase = await donor_client.post(
            f"/api/v1/donor/events/{test_event.id}/revenue-generators/{item_id}/entries"
        )
        assert third_purchase.status_code == 400
        third_detail = third_purchase.json().get("detail")
        third_message = (
            third_detail.get("message", "") if isinstance(third_detail, dict) else str(third_detail)
        )
        assert "maximum number of entries allowed" in third_message

    async def test_quick_entry_respects_per_person_and_total_limits(
        self,
        super_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        test_user_2: User,
        db_session: AsyncSession,
    ) -> None:
        await _set_primary_bidder_number(db_session, test_registration.id, bidder_number=410)
        await _create_registration_with_bidder(
            db_session,
            test_event.id,
            user=test_user_2,
            bidder_number=411,
        )

        create_response = await super_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/revenue-generators",
            json={
                "name": "Golden Ticket",
                "description": "Quick entry limits",
                "price_per_entry": 10,
                "max_entries": 2,
                "max_entries_per_person": 1,
            },
        )
        assert create_response.status_code == 201
        item_id = create_response.json()["id"]

        first_entry = await super_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/revenue-generators/entry",
            params={"item_id": item_id, "bidder_number": 410},
        )
        assert first_entry.status_code == 201

        duplicate_bidder = await super_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/revenue-generators/entry",
            params={"item_id": item_id, "bidder_number": 410},
        )
        assert duplicate_bidder.status_code == 422
        duplicate_detail = duplicate_bidder.json().get("detail")
        duplicate_message = (
            duplicate_detail.get("message", "")
            if isinstance(duplicate_detail, dict)
            else str(duplicate_detail)
        )
        assert "maximum number of entries allowed" in duplicate_message

        second_bidder = await super_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/revenue-generators/entry",
            params={"item_id": item_id, "bidder_number": 411},
        )
        assert second_bidder.status_code == 201

        total_limit = await super_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/revenue-generators/entry",
            params={"item_id": item_id, "bidder_number": 412},
        )
        assert total_limit.status_code == 422
        total_detail = total_limit.json().get("detail")
        total_message = (
            total_detail.get("message", "") if isinstance(total_detail, dict) else str(total_detail)
        )
        assert "maximum number of entries" in total_message
