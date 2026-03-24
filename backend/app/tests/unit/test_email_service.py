"""Unit tests for EmailService branding behavior."""

from unittest.mock import AsyncMock

import pytest

from app.services.email_service import EmailService, _create_email_html_template


def test_email_template_defaults_to_fundrbolt_logo() -> None:
    """Shared HTML template should use the logo header by default."""
    html = _create_email_html_template(
        heading="Test Heading",
        body_paragraphs=["Body copy"],
    )

    assert "fundrbolt-logo-white-gold.png" in html
    assert '<img src="' in html
    assert ">FundrBolt</h1>" not in html


@pytest.mark.asyncio
async def test_send_welcome_email_includes_logo_in_html_body() -> None:
    """Welcome emails should render with the FundrBolt logo header."""
    service = EmailService()
    service._send_email_with_retry = AsyncMock(return_value=True)  # type: ignore[method-assign]

    await service.send_welcome_email(
        to_email="test@example.com",
        user_name="Taylor",
    )

    service._send_email_with_retry.assert_awaited_once()  # type: ignore[attr-defined]
    html_body = service._send_email_with_retry.await_args.kwargs["html_body"]  # type: ignore[attr-defined]

    assert "fundrbolt-logo-white-gold.png" in html_body
    assert '<img src="' in html_body
    assert "Welcome to FundrBolt, Taylor!" in html_body


@pytest.mark.asyncio
async def test_send_password_reset_email_uses_confirm_route() -> None:
    """Password reset emails should link to the confirm route that exists in the frontend."""
    service = EmailService()
    service._send_email_with_retry = AsyncMock(return_value=True)  # type: ignore[method-assign]

    await service.send_password_reset_email(
        to_email="test@example.com",
        reset_token="abc123",
        user_name="Taylor",
    )

    service._send_email_with_retry.assert_awaited_once()  # type: ignore[attr-defined]
    html_body = service._send_email_with_retry.await_args.args[4]  # type: ignore[attr-defined]

    assert "/password-reset-confirm?token=abc123" in html_body
    assert "/reset-password?token=abc123" not in html_body


@pytest.mark.asyncio
async def test_send_npo_application_submitted_email_includes_review_acknowledgement() -> None:
    """Applicant acknowledgement should clearly say the organisation is under review."""
    service = EmailService()
    service._send_email_with_retry = AsyncMock(return_value=True)  # type: ignore[method-assign]

    await service.send_npo_application_submitted_email(
        to_email="applicant@example.com",
        npo_name="Helping Hands",
        applicant_name="Taylor",
    )

    service._send_email_with_retry.assert_awaited_once()  # type: ignore[attr-defined]
    args = service._send_email_with_retry.await_args.args  # type: ignore[attr-defined]

    assert args[0] == "applicant@example.com"
    assert args[3] == "npo_application_submitted"
    assert "Helping Hands" in args[4]
    assert "under review" in args[4]


@pytest.mark.asyncio
async def test_send_npo_application_submitted_admin_notification_uses_new_fallback_mailbox(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Admin notification fallback should target the approvals mailbox."""
    service = EmailService()
    service._send_email_with_retry = AsyncMock(return_value=True)  # type: ignore[method-assign]
    monkeypatch.setattr(
        "app.services.email_service.settings.admin_notification_email",
        None,
    )

    await service.send_npo_application_submitted_admin_notification(
        applicant_name="Taylor Tester",
        applicant_email="applicant@example.com",
        npo_name="Helping Hands",
        application_id="app-123",
    )

    service._send_email_with_retry.assert_awaited_once()  # type: ignore[attr-defined]
    kwargs = service._send_email_with_retry.await_args.kwargs  # type: ignore[attr-defined]

    assert kwargs["to_email"] == "npo_applications@fundrbolt.com"
    assert kwargs["email_type"] == "npo_onboarding_admin_notification"
