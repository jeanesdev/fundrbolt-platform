"""Integration tests for GDPR-specific flows."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent import ConsentAction, ConsentAuditLog

pytestmark = pytest.mark.asyncio


async def test_data_export_and_withdrawal_create_audit_entries(
    async_client: AsyncClient,
    db_session: AsyncSession,
    user_auth_headers: dict[str, str],
    published_legal_documents: dict[str, str],
) -> None:
    accept_response = await async_client.post(
        "/api/v1/consent/accept",
        json={
            "tos_document_id": published_legal_documents["tos_id"],
            "privacy_document_id": published_legal_documents["privacy_id"],
        },
        headers=user_auth_headers,
    )
    assert accept_response.status_code == 201

    export_response = await async_client.post(
        "/api/v1/consent/data-export",
        json={},
        headers=user_auth_headers,
    )
    assert export_response.status_code == 202

    withdraw_response = await async_client.post(
        "/api/v1/consent/withdraw",
        headers=user_auth_headers,
    )
    assert withdraw_response.status_code == 200

    audit_result = await db_session.execute(select(ConsentAuditLog.action))
    actions = set(audit_result.scalars().all())
    assert ConsentAction.DATA_EXPORT_REQUESTED in actions
    assert ConsentAction.CONSENT_WITHDRAWN in actions
