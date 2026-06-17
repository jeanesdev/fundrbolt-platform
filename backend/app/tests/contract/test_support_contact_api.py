"""Contract tests for authenticated support message submission."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_support_contact_sends_backend_email(
    authenticated_client: AsyncClient,
) -> None:
    """Support form submissions are sent by the backend email service."""
    payload = {
        "reason": "bug",
        "subject": "Need help with billing",
        "message": "Please review my recent invoice and payment status.",
    }

    with patch("app.api.v1.support.get_email_service") as mock_get_email_service:
        mock_email_service = MagicMock()
        mock_email_service._send_email_with_retry = AsyncMock(return_value=None)
        mock_get_email_service.return_value = mock_email_service

        response = await authenticated_client.post(
            "/api/v1/support/contact",
            json=payload,
        )

    assert response.status_code == 204, response.text
    mock_email_service._send_email_with_retry.assert_awaited_once()
    call_kwargs = mock_email_service._send_email_with_retry.await_args.kwargs
    assert call_kwargs["to_email"] == "support@fundrbolt.com"
    assert call_kwargs["subject"] == "[Report a bug/issue] Need help with billing"
    assert "From:" in call_kwargs["body"]
    assert "Need help with billing" in call_kwargs["body"]
