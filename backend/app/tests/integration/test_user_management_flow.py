"""Integration tests for admin-driven user management flows."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog

pytestmark = pytest.mark.asyncio


async def test_super_admin_can_change_role_toggle_active_and_request_password_reset(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_super_admin_token: str,
    test_super_admin_user: Any,
    test_donor_user: Any,
    test_approved_npo: Any,
) -> None:
    headers = {"Authorization": f"Bearer {test_super_admin_token}"}

    role_response = await async_client.patch(
        f"/api/v1/users/{test_donor_user.id}/role",
        json={"role": "staff", "npo_id": str(test_approved_npo.id)},
        headers=headers,
    )
    assert role_response.status_code == 200, role_response.json()
    assert role_response.json()["role"] == "staff"

    deactivate_response = await async_client.post(
        f"/api/v1/users/{test_donor_user.id}/activate",
        json={"is_active": False},
        headers=headers,
    )
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["is_active"] is False

    login_blocked_response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": test_donor_user.email, "password": "TestPass123"},
    )
    assert login_blocked_response.status_code == 403

    reactivate_response = await async_client.post(
        f"/api/v1/users/{test_donor_user.id}/activate",
        json={"is_active": True},
        headers=headers,
    )
    assert reactivate_response.status_code == 200
    assert reactivate_response.json()["is_active"] is True

    login_success_response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": test_donor_user.email, "password": "TestPass123"},
    )
    assert login_success_response.status_code == 200

    reset_response = await async_client.post(
        "/api/v1/auth/password/reset/request",
        json={"email": test_donor_user.email},
    )
    assert reset_response.status_code == 200

    audit_result = await db_session.execute(select(AuditLog.action))
    actions = set(audit_result.scalars().all())
    assert {"role_changed", "account_deactivated", "account_reactivated"} <= actions
