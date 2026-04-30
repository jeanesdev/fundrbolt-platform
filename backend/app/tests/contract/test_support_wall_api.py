"""Contract tests for donate-now support wall APIs."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.donate_now_config import DonateNowPageConfig
from app.schemas.npo_donation import DonationCreateRequest
from app.services.npo_donation_service import NpoDonationService

pytestmark = pytest.mark.asyncio


async def _create_support_wall_donation(
    *,
    db_session: Any,
    npo: Any,
    donor: Any,
    idempotency_key: str,
    is_monthly: bool = False,
) -> None:
    config_result = await db_session.execute(
        select(DonateNowPageConfig).where(DonateNowPageConfig.npo_id == npo.id)
    )
    config = config_result.scalar_one_or_none()
    if config is None:
        config = DonateNowPageConfig(
            npo_id=npo.id,
            is_enabled=True,
        )
        db_session.add(config)
        await db_session.flush()

    await NpoDonationService.create_donation(
        db=db_session,
        npo=npo,
        config=config,
        donor=donor,
        request=DonationCreateRequest(
            amount_cents=5000,
            donor_name=f"{donor.first_name} {donor.last_name}",
            covers_processing_fee=True,
            is_monthly=is_monthly,
            support_wall_message="Testing support wall details",
            is_anonymous=False,
            show_amount=True,
            idempotency_key=idempotency_key,
        ),
    )
    await db_session.commit()


class TestSupportWallContract:
    """Contract tests for donor/public and admin support wall endpoints."""

    async def test_public_support_wall_includes_monthly_flag(
        self,
        client: AsyncClient,
        db_session: Any,
        test_approved_npo: Any,
        test_donor_user: Any,
    ) -> None:
        """Public support wall entries expose whether the donation is monthly."""

        await _create_support_wall_donation(
            db_session=db_session,
            npo=test_approved_npo,
            donor=test_donor_user,
            idempotency_key="support-wall-public-monthly",
            is_monthly=True,
        )

        response = await client.get(
            f"/api/v1/npos/{test_approved_npo.slug}/donate-now/support-wall"
        )

        assert response.status_code == 200
        body = response.json()
        assert body["entries"][0]["message"] == "Testing support wall details"
        assert body["entries"][0]["is_monthly"] is True

    async def test_admin_support_wall_lists_donation_details_and_approve_flow(
        self,
        npo_admin_client: AsyncClient,
        db_session: Any,
        test_approved_npo: Any,
        test_donor_user: Any,
    ) -> None:
        """Admin support wall includes donation detail columns and approve/hide actions."""

        await _create_support_wall_donation(
            db_session=db_session,
            npo=test_approved_npo,
            donor=test_donor_user,
            idempotency_key="support-wall-admin-details",
            is_monthly=True,
        )

        list_response = await npo_admin_client.get(
            f"/api/v1/admin/npos/{test_approved_npo.id}/donate-now/support-wall",
            params={"include_hidden": True},
        )

        assert list_response.status_code == 200
        body = list_response.json()
        entry = body["entries"][0]
        assert entry["donor_name"] == f"{test_donor_user.first_name} {test_donor_user.last_name}"
        assert entry["donor_email"] == test_donor_user.email
        assert (
            entry["public_display_name"]
            == f"{test_donor_user.first_name} {test_donor_user.last_name}"
        )
        assert entry["amount_cents"] == 5000
        assert entry["covers_processing_fee"] is True
        assert entry["processing_fee_cents"] > 0
        assert entry["total_charged_cents"] == 5145
        assert entry["is_monthly"] is True
        assert entry["donation_status"] == "captured"
        assert entry["moderation_status"] == "unreviewed"
        assert entry["is_reviewed"] is False

        hide_response = await npo_admin_client.post(
            f"/api/v1/admin/npos/{test_approved_npo.id}/donate-now/support-wall/{entry['id']}/hide"
        )
        assert hide_response.status_code == 204

        hidden_list_response = await npo_admin_client.get(
            f"/api/v1/admin/npos/{test_approved_npo.id}/donate-now/support-wall",
            params={"include_hidden": True},
        )
        hidden_entry = hidden_list_response.json()["entries"][0]
        assert hidden_entry["moderation_status"] == "hidden"
        assert hidden_entry["is_reviewed"] is True

        approve_response = await npo_admin_client.post(
            f"/api/v1/admin/npos/{test_approved_npo.id}/donate-now/support-wall/{entry['id']}/approve"
        )
        assert approve_response.status_code == 204

        approved_list_response = await npo_admin_client.get(
            f"/api/v1/admin/npos/{test_approved_npo.id}/donate-now/support-wall",
            params={"include_hidden": True},
        )
        approved_entry = approved_list_response.json()["entries"][0]
        assert approved_entry["moderation_status"] == "approved"
        assert approved_entry["is_reviewed"] is True

    async def test_admin_support_wall_bulk_moderation_updates_multiple_rows(
        self,
        npo_admin_client: AsyncClient,
        db_session: Any,
        test_approved_npo: Any,
        test_donor_user: Any,
    ) -> None:
        """Admin support wall supports bulk moderation actions."""

        await _create_support_wall_donation(
            db_session=db_session,
            npo=test_approved_npo,
            donor=test_donor_user,
            idempotency_key="support-wall-bulk-1",
        )
        await _create_support_wall_donation(
            db_session=db_session,
            npo=test_approved_npo,
            donor=test_donor_user,
            idempotency_key="support-wall-bulk-2",
            is_monthly=True,
        )

        list_response = await npo_admin_client.get(
            f"/api/v1/admin/npos/{test_approved_npo.id}/donate-now/support-wall",
            params={"include_hidden": True},
        )
        entry_ids = [entry["id"] for entry in list_response.json()["entries"][:2]]

        bulk_hide_response = await npo_admin_client.post(
            f"/api/v1/admin/npos/{test_approved_npo.id}/donate-now/support-wall/bulk-hide",
            json={"entry_ids": entry_ids},
        )
        assert bulk_hide_response.status_code == 204

        hidden_response = await npo_admin_client.get(
            f"/api/v1/admin/npos/{test_approved_npo.id}/donate-now/support-wall",
            params={"include_hidden": True},
        )
        hidden_entries = hidden_response.json()["entries"][:2]
        assert {entry["moderation_status"] for entry in hidden_entries} == {"hidden"}

        bulk_approve_response = await npo_admin_client.post(
            f"/api/v1/admin/npos/{test_approved_npo.id}/donate-now/support-wall/bulk-approve",
            json={"entry_ids": entry_ids},
        )
        assert bulk_approve_response.status_code == 204

        approved_response = await npo_admin_client.get(
            f"/api/v1/admin/npos/{test_approved_npo.id}/donate-now/support-wall",
            params={"include_hidden": True},
        )
        approved_entries = approved_response.json()["entries"][:2]
        assert {entry["moderation_status"] for entry in approved_entries} == {"approved"}
