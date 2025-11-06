"""
Contract tests for invitation acceptance endpoints.

Tests the API contract for:
- POST /api/v1/invitations/{id}/accept - Accept invitation with token

These tests ensure the API follows the contract defined in
contracts/npo-management-api.yaml
"""

import pytest
from fastapi import status

from app.models.npo import NPO


@pytest.mark.asyncio
class TestAcceptInvitationEndpoint:
    """Test POST /api/v1/invitations/{token}/accept"""

    async def test_accept_invitation_success(
        self,
        client,
        test_npo: NPO,
        test_invitation_token: str,
    ):
        """User can accept valid invitation"""
        response = await client.post(f"/api/v1/invitations/{test_invitation_token}/accept")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "member" in data
        assert data["member"]["npo_id"] == str(test_npo.id)
        assert "message" in data

    async def test_accept_invitation_invalid_token(
        self,
        client,
    ):
        """Rejects invalid token"""
        fake_token = "invalid_token"
        response = await client.post(f"/api/v1/invitations/{fake_token}/accept")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        detail = response.json()["detail"]
        message = detail if isinstance(detail, str) else detail.get("message", "")
        assert "not found" in message.lower() or "invalid" in message.lower()

    async def test_accept_invitation_expired_token(
        self,
        client,
        test_expired_invitation_token: str,
    ):
        """Rejects expired token"""
        response = await client.post(f"/api/v1/invitations/{test_expired_invitation_token}/accept")

        assert response.status_code == status.HTTP_410_GONE
        detail = response.json()["detail"]
        message = detail if isinstance(detail, str) else detail.get("message", "")
        assert "expired" in message.lower()

    async def test_accept_invitation_already_accepted(
        self,
        client,
        test_accepted_invitation_token: str,
    ):
        """Rejects already accepted invitation"""
        response = await client.post(f"/api/v1/invitations/{test_accepted_invitation_token}/accept")

        assert response.status_code == status.HTTP_409_CONFLICT
        detail = response.json()["detail"]
        message = detail if isinstance(detail, str) else detail.get("message", "")
        assert "already" in message.lower()

    async def test_accept_invitation_revoked(
        self,
        client,
        test_revoked_invitation_token: str,
    ):
        """Rejects revoked invitation"""
        response = await client.post(f"/api/v1/invitations/{test_revoked_invitation_token}/accept")

        assert response.status_code == status.HTTP_410_GONE
        detail = response.json()["detail"]
        message = detail if isinstance(detail, str) else detail.get("message", "")
        assert "revoked" in message.lower()

    async def test_accept_invitation_user_already_member(
        self,
        client,
        test_invitation_token_existing_member: str,
    ):
        """Rejects if user is already a member"""
        response = await client.post(
            f"/api/v1/invitations/{test_invitation_token_existing_member}/accept"
        )

        assert response.status_code == status.HTTP_409_CONFLICT
        detail = response.json()["detail"]
        message = detail if isinstance(detail, str) else detail.get("message", "")
        assert "already a member" in message.lower() or "already" in message.lower()
