"""Contract tests for admin ticket package APIs."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


async def test_custom_options_list_returns_package_options(
    npo_admin_client: AsyncClient,
    db_session: AsyncSession,
    test_event: Any,
) -> None:
    """Admin package custom options endpoint returns persisted options."""
    from app.models.ticket_management import CustomTicketOption, OptionType, TicketPackage

    package = TicketPackage(
        event_id=test_event.id,
        created_by=test_event.created_by,
        name="General Admission",
        description="Single seat",
        price=Decimal("100.00"),
        seats_per_package=1,
        quantity_limit=None,
        sold_count=0,
        is_enabled=True,
        display_order=0,
    )
    db_session.add(package)
    await db_session.flush()

    db_session.add_all(
        [
            CustomTicketOption(
                ticket_package_id=package.id,
                option_label="Meal Preference",
                option_type=OptionType.MULTI_SELECT,
                choices=["Beef", "Chicken", "Vegan"],
                is_required=True,
                display_order=0,
            ),
            CustomTicketOption(
                ticket_package_id=package.id,
                option_label="Handicap?",
                option_type=OptionType.BOOLEAN,
                choices=None,
                is_required=False,
                display_order=1,
            ),
        ]
    )
    await db_session.commit()

    response = await npo_admin_client.get(f"/api/v1/admin/packages/{package.id}/options")

    assert response.status_code == 200
    data = response.json()
    assert [option["option_label"] for option in data] == [
        "Meal Preference",
        "Handicap?",
    ]
    assert data[0]["choices"] == ["Beef", "Chicken", "Vegan"]
    assert data[1]["option_type"] == "boolean"


async def test_ticket_package_reads_refresh_signed_image_urls(
    npo_admin_client: AsyncClient,
    db_session: AsyncSession,
    test_event: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Admin package reads should refresh image URLs instead of returning stale SAS tokens."""
    from app.models.ticket_management import TicketPackage
    from app.services.media_service import MediaService

    package = TicketPackage(
        event_id=test_event.id,
        created_by=test_event.created_by,
        name="General Admission",
        description="Single seat",
        price=Decimal("100.00"),
        seats_per_package=1,
        quantity_limit=None,
        sold_count=0,
        is_enabled=True,
        display_order=0,
        image_url=(
            "https://fundrbolt.blob.core.windows.net/npo-assets/"
            "ticket-package-images/event_123/package_456_deadbeef.png?se=expired"
        ),
    )
    db_session.add(package)
    await db_session.commit()

    monkeypatch.setattr(
        MediaService,
        "generate_read_sas_url",
        staticmethod(
            lambda blob_name, expiry_hours=24: f"https://signed.example/{blob_name}?fresh=1"
        ),
    )

    get_response = await npo_admin_client.get(
        f"/api/v1/admin/events/{test_event.id}/packages/{package.id}"
    )
    list_response = await npo_admin_client.get(f"/api/v1/admin/events/{test_event.id}/packages")

    assert get_response.status_code == 200
    assert list_response.status_code == 200
    assert (
        get_response.json()["image_url"]
        == "https://signed.example/ticket-package-images/event_123/package_456_deadbeef.png?fresh=1"
    )
    assert (
        list_response.json()[0]["image_url"]
        == "https://signed.example/ticket-package-images/event_123/package_456_deadbeef.png?fresh=1"
    )
