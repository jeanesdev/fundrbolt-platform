"""Unit tests for EmailService branding behavior."""

from unittest.mock import AsyncMock

import pytest

from app.services.email_service import EmailSendError, EmailService, _create_email_html_template


def test_email_template_defaults_to_fundrbolt_logo() -> None:
    """Shared HTML template should use the logo header by default."""
    html = _create_email_html_template(
        heading="Test Heading",
        body_paragraphs=["Body copy"],
    )

    assert "fundrbolt-logo-white-gold.png" in html
    assert '<img src="' in html
    assert ">FundrBolt</h1>" not in html


def test_email_template_header_logo_has_max_size_constraints() -> None:
    """Header logo should include explicit max-size constraints for email clients."""
    html = _create_email_html_template(
        heading="Logo Size Test",
        body_paragraphs=["Body copy"],
        logo_url="https://cdn.example.com/some-very-large-logo.png",
        logo_alt="Large Logo",
    )

    assert 'width="240"' in html
    assert 'height="60"' in html
    assert "max-width: 240px" in html
    assert "max-height: 60px" in html


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
async def test_send_communications_email_otp_includes_verification_screen_link() -> None:
    """Communications email OTP emails should link back to the donor verification screen."""
    service = EmailService()
    service._send_email_with_retry = AsyncMock(return_value=True)  # type: ignore[method-assign]

    await service.send_communications_email_otp(
        to_email="alerts@example.com",
        otp="123456",
        user_name="Taylor",
    )

    service._send_email_with_retry.assert_awaited_once()  # type: ignore[attr-defined]
    kwargs = service._send_email_with_retry.await_args.kwargs  # type: ignore[attr-defined]
    plain_body = kwargs["body"]
    html_body = kwargs["html_body"]

    assert "/complete-profile?step=otp&email=alerts%40example.com" in plain_body
    assert "/complete-profile?step=otp&email=alerts%40example.com" in html_body


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

    assert kwargs["to_email"] == "npo_approvals@fundrbolt.com"
    assert kwargs["email_type"] == "npo_onboarding_admin_notification"


@pytest.mark.asyncio
async def test_email_service_raises_when_real_delivery_is_unconfigured_in_staging(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Staging should not silently fall back to mock email delivery."""
    monkeypatch.setattr("app.services.email_service.settings.environment", "staging")
    monkeypatch.setattr("app.services.email_service.settings.email_backend", "azure_acs")
    monkeypatch.setattr(
        "app.services.email_service.settings.azure_communication_connection_string",
        None,
    )

    service = EmailService()

    with pytest.raises(EmailSendError, match="not configured for real delivery"):
        await service._send_email_with_retry(
            to_email="test@example.com",
            subject="Reset your password",
            body="Use this link to reset your password.",
            email_type="password_reset",
        )


@pytest.mark.asyncio
async def test_ticket_assignment_invitation_retries_with_default_sender_when_branded_sender_fails() -> (
    None
):
    """Ticket invite should fall back to default sender if branded sender is rejected."""
    from app.services import email_service as email_module

    service = EmailService()
    calls: list[dict[str, str | None]] = []
    default_sender = email_module.settings.email_from_address
    default_sender_name = email_module.settings.email_from_name
    sender_domain = default_sender.split("@")[-1]

    async def fake_send(*args: object, **kwargs: str | None) -> bool:
        calls.append(
            {
                "from_address": kwargs.get("from_address"),
                "from_name": kwargs.get("from_name"),
            }
        )
        if kwargs.get("from_address") != default_sender:
            raise EmailSendError("sender rejected")
        return True

    service._send_email_with_retry = AsyncMock(side_effect=fake_send)  # type: ignore[method-assign]

    await service.send_ticket_assignment_invitation_email(
        to_email="guest@example.com",
        guest_name="Guest",
        event_name="Connect and Celebrate",
        event_datetime_text="June 27, 2026 at 06:00 PM (America/New_York)",
        venue_name="FundrBolt Hall",
        venue_address="123 Main St",
        invitation_url="https://app.fundrbolt.com/invitations/accept?token=abc",
        inviter_name="Host User",
        inviter_email="host@example.com",
        npo_slug="silver-sponsor",
    )

    assert len(calls) == 2
    assert calls[0]["from_address"] == f"silver-sponsor@{sender_domain}"
    assert calls[1]["from_address"] == default_sender
    assert calls[1]["from_name"] == default_sender_name
