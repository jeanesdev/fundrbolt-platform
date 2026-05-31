"""Scenario-driven integration tests for auth and GDPR flows."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent import ConsentAction, ConsentAuditLog, ConsentStatus, UserConsent
from app.models.user import User

pytestmark = pytest.mark.asyncio


async def test_donor_can_accept_export_and_request_deletion(
    async_client: AsyncClient,
    db_session: AsyncSession,
    user_auth_headers: dict[str, str],
    published_legal_documents: dict[str, str],
    test_donor_user: User,
) -> None:
    accept_payload = {
        "tos_document_id": published_legal_documents["tos_id"],
        "privacy_document_id": published_legal_documents["privacy_id"],
    }
    accept_response = await async_client.post(
        "/api/v1/consent/accept",
        json=accept_payload,
        headers=user_auth_headers,
    )
    assert accept_response.status_code == 201

    export_response = await async_client.post(
        "/api/v1/consent/data-export",
        json={"email": test_donor_user.email},
        headers=user_auth_headers,
    )
    assert export_response.status_code == 202

    deletion_response = await async_client.post(
        "/api/v1/consent/data-deletion",
        json={"confirmation": True},
        headers=user_auth_headers,
    )
    assert deletion_response.status_code == 202

    consent_result = await db_session.execute(
        select(UserConsent).where(UserConsent.user_id == test_donor_user.id)
    )
    consents = consent_result.scalars().all()
    assert consents[-1].status in {ConsentStatus.ACTIVE, ConsentStatus.WITHDRAWN}

    audit_result = await db_session.execute(
        select(ConsentAuditLog.action).where(ConsentAuditLog.user_id == test_donor_user.id)
    )
    actions = set(audit_result.scalars().all())
    assert ConsentAction.CONSENT_GIVEN in actions
    assert ConsentAction.DATA_EXPORT_REQUESTED in actions
    assert ConsentAction.DATA_DELETION_REQUESTED in actions

    await db_session.refresh(test_donor_user)
    assert test_donor_user.is_active is False

    login_response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": test_donor_user.email, "password": "TestPass123"},
    )
    assert login_response.status_code == 403


async def test_donor_can_withdraw_consent_and_is_blocked_from_future_login(
    async_client: AsyncClient,
    db_session: AsyncSession,
    user_auth_headers: dict[str, str],
    published_legal_documents: dict[str, str],
    test_donor_user: User,
) -> None:
    await async_client.post(
        "/api/v1/consent/accept",
        json={
            "tos_document_id": published_legal_documents["tos_id"],
            "privacy_document_id": published_legal_documents["privacy_id"],
        },
        headers=user_auth_headers,
    )

    withdraw_response = await async_client.post(
        "/api/v1/consent/withdraw",
        headers=user_auth_headers,
    )
    assert withdraw_response.status_code == 200

    consent_result = await db_session.execute(
        select(UserConsent)
        .where(UserConsent.user_id == test_donor_user.id)
        .order_by(UserConsent.created_at.desc())
    )
    latest_consent = consent_result.scalars().first()
    assert latest_consent is not None
    assert latest_consent.status == ConsentStatus.WITHDRAWN
    assert latest_consent.withdrawn_at is not None

    audit_result = await db_session.execute(
        select(ConsentAuditLog).where(
            ConsentAuditLog.user_id == test_donor_user.id,
            ConsentAuditLog.action == ConsentAction.CONSENT_WITHDRAWN,
        )
    )
    assert audit_result.scalar_one_or_none() is not None

    await db_session.refresh(test_donor_user)
    assert test_donor_user.is_active is False
