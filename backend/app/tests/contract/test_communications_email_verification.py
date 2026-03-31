"""Contract tests for communications email verification endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


class TestCommunicationsEmailVerificationContract:
    """Verify communications email request/confirm contract behavior."""

    @pytest.mark.asyncio
    async def test_request_verification_returns_deep_link_to_otp_screen(
        self,
        donor_client: AsyncClient,
    ) -> None:
        """Requesting comms-email verification should return the donor OTP deep link."""
        with patch(
            "app.services.email_service.get_email_service",
            return_value=type(
                "EmailServiceStub",
                (),
                {"send_communications_email_otp": AsyncMock(return_value=True)},
            )(),
        ):
            response = await donor_client.post(
                "/api/v1/users/me/communications-email/request-verification",
                json={"email": "alerts@example.com"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Verification code sent to alerts@example.com"
        assert (
            data["verification_url"]
            == "http://localhost:5174/complete-profile?step=otp&email=alerts%40example.com"
        )
