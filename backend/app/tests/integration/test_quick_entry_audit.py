"""Integration tests for quick-entry audit log behavior."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.registration_guest import RegistrationGuest

pytestmark = pytest.mark.asyncio


async def _assign_bidder_number(
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


async def _create_live_item(npo_admin_client: AsyncClient, event_id: Any) -> str:
    response = await npo_admin_client.post(
        f"/api/v1/events/{event_id}/auction-items",
        json={
            "title": "Audit Item",
            "description": "Audit test item",
            "auction_type": "live",
            "starting_bid": 100.0,
            "buy_now_enabled": False,
            "quantity_available": 1,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


class TestQuickEntryAudit:
    """Validate quick-entry create/delete/winner actions write audit logs."""

    async def test_live_quick_entry_actions_are_audited(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_registration: Any,
        db_session: AsyncSession,
        test_npo_admin_user: Any,
    ) -> None:
        """Creates, deletes, and assigns winner while writing audit records."""
        await _assign_bidder_number(db_session, test_registration.id, bidder_number=513)
        item_id = await _create_live_item(npo_admin_client, test_event.id)

        create_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/live-auction/bids",
            json={"item_id": item_id, "amount": 400, "bidder_number": 513},
        )
        assert create_response.status_code == 201
        bid_id = create_response.json()["id"]

        winner_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/live-auction/items/{item_id}/winner",
            json={"confirm": True},
        )
        assert winner_response.status_code == 200

        delete_response = await npo_admin_client.delete(
            f"/api/v1/admin/events/{test_event.id}/quick-entry/live-auction/bids/{bid_id}"
        )
        assert delete_response.status_code == 204

        logs_stmt = (
            select(AuditLog)
            .where(
                AuditLog.user_id == test_npo_admin_user.id,
                AuditLog.action.in_(
                    [
                        "quick_entry_live_bid_created",
                        "quick_entry_live_winner_assigned",
                        "quick_entry_live_bid_deleted",
                    ]
                ),
            )
            .order_by(AuditLog.created_at.asc())
        )
        logs_result = await db_session.execute(logs_stmt)
        logs = [
            log
            for log in logs_result.scalars().all()
            if (log.event_metadata or {}).get("event_id") == str(test_event.id)
        ]

        actions = [log.action for log in logs]
        assert "quick_entry_live_bid_created" in actions
        assert "quick_entry_live_winner_assigned" in actions
        assert "quick_entry_live_bid_deleted" in actions
        assert all(log.event_metadata is not None for log in logs)
        assert all(log.event_metadata.get("event_id") == str(test_event.id) for log in logs)
