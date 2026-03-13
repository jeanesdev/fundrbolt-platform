"""Unit tests for OnboardingService.

Tests:
- Session creation (new session, authenticated user US2)
- Step advancement state machine
- Cloudflare Turnstile verification mock
- Session expiry cleanup
- Near-duplicate NPO name check
- Submission notifications
"""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.npo import NPO, NPOStatus
from app.models.npo_application import ApplicationStatus, NPOApplication
from app.models.user import User
from app.schemas.onboarding import CreateSessionRequest
from app.services.onboarding_service import OnboardingService

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_service(db: AsyncSession) -> OnboardingService:
    return OnboardingService(db=db)


# ---------------------------------------------------------------------------
# Session creation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCreateSession:
    async def test_create_npo_onboarding_session(self, db_session: AsyncSession) -> None:
        """New unauthenticated session starts at 'account'."""
        svc = _make_service(db_session)
        request = CreateSessionRequest(session_type="npo_onboarding")
        session = await svc.create_session(request=request)

        assert session.token is not None
        assert len(session.token) > 20
        assert session.session_type == "npo_onboarding"
        assert session.current_step == "account"
        assert session.completed_steps == []
        assert session.user_id is None

    async def test_create_session_with_user_id_starts_at_npo_profile(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """US2: Authenticated user session skips to npo_profile."""
        svc = _make_service(db_session)
        request = CreateSessionRequest(session_type="npo_onboarding")
        session = await svc.create_session(request=request, user_id=test_user.id)

        assert session.current_step == "npo_profile"
        assert session.user_id == test_user.id
        # account + verify_email should be pre-completed
        assert "account" in session.completed_steps
        assert "verify_email" in session.completed_steps

    async def test_session_has_expiry_in_future(self, db_session: AsyncSession) -> None:
        """Session expires_at should be in the future."""
        svc = _make_service(db_session)
        request = CreateSessionRequest(session_type="npo_onboarding")
        session = await svc.create_session(request=request)

        assert session.expires_at > datetime.now(tz=UTC)

    async def test_get_session_returns_none_after_expiry(self, db_session: AsyncSession) -> None:
        """Expired sessions return None."""
        svc = _make_service(db_session)
        request = CreateSessionRequest(session_type="npo_onboarding")
        session = await svc.create_session(request=request)

        # Manually expire the session
        session.expires_at = datetime.now(tz=UTC) - timedelta(hours=1)
        await db_session.commit()

        result = await svc.get_session(session.token)
        assert result is None


# ---------------------------------------------------------------------------
# Step advancement — state machine
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestUpdateStep:
    async def test_account_step_advances_to_verify_email(self, db_session: AsyncSession) -> None:
        """Completing 'account' moves current_step to 'verify_email'."""
        svc = _make_service(db_session)
        session = await svc.create_session(
            request=CreateSessionRequest(session_type="npo_onboarding")
        )

        updated = await svc.update_step(
            token=session.token,
            step_name="account",
            data={"email": "user@example.com", "first_name": "Alice"},
        )

        assert updated.current_step == "verify_email"
        assert "account" in updated.completed_steps
        assert updated.form_data["account"]["email"] == "user@example.com"

    async def test_npo_profile_step_advances_to_first_event(self, db_session: AsyncSession) -> None:
        """Completing 'npo_profile' moves to 'first_event'."""
        svc = _make_service(db_session)
        session = await svc.create_session(
            request=CreateSessionRequest(session_type="npo_onboarding")
        )

        # Advance past account
        await svc.update_step(token=session.token, step_name="account", data={})
        # Save npo_profile
        updated = await svc.update_step(
            token=session.token,
            step_name="npo_profile",
            data={"npo_name": "My NPO", "ein": "12-3456789"},
        )

        assert updated.current_step == "first_event"
        assert "npo_profile" in updated.completed_steps

    async def test_step_data_replaced_on_repeated_updates(self, db_session: AsyncSession) -> None:
        """Each update_step call replaces the step's stored data entirely."""
        svc = _make_service(db_session)
        session = await svc.create_session(
            request=CreateSessionRequest(session_type="npo_onboarding")
        )

        await svc.update_step(session.token, "account", {"email": "a@b.com"})
        updated = await svc.update_step(session.token, "account", {"first_name": "Bob"})

        # Second call replaces step data — only the latest payload survives
        assert updated.form_data["account"]["first_name"] == "Bob"
        assert "email" not in updated.form_data["account"]

    async def test_last_step_does_not_advance_beyond_end(self, db_session: AsyncSession) -> None:
        """Completing the final step 'confirmation' keeps current_step at 'confirmation'."""
        svc = _make_service(db_session)
        session = await svc.create_session(
            request=CreateSessionRequest(session_type="npo_onboarding")
        )

        # Advance through all steps to reach the final one
        await svc.update_step(session.token, "account", {})
        await svc.update_step(session.token, "verify_email", {})
        await svc.update_step(session.token, "npo_profile", {})
        await svc.update_step(session.token, "first_event", {})
        updated = await svc.update_step(session.token, "confirmation", {})

        # 'confirmation' is the last step — should stay at 'confirmation'
        assert updated.current_step == "confirmation"
        assert "confirmation" in updated.completed_steps


# ---------------------------------------------------------------------------
# Cloudflare Turnstile
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestTurnstileVerification:
    async def test_turnstile_disabled_when_no_secret_configured(
        self, db_session: AsyncSession
    ) -> None:
        """When TURNSTILE_SECRET_KEY is empty, verification skips and returns True."""
        svc = _make_service(db_session)

        mock_settings = MagicMock()
        mock_settings.turnstile_secret_key = ""
        with patch("app.services.onboarding_service.settings", mock_settings):
            result = await svc.verify_turnstile_token("any-token", "127.0.0.1")
            assert result is True

    async def test_turnstile_returns_true_on_success_response(
        self, db_session: AsyncSession
    ) -> None:
        """Successful Turnstile API call returns True."""
        svc = _make_service(db_session)

        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value={"success": True})
        mock_response.raise_for_status = MagicMock()

        mock_settings = MagicMock()
        mock_settings.turnstile_secret_key = "valid-secret"

        mock_client_instance = AsyncMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)

        mock_http = MagicMock()
        mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_http.return_value.__aexit__ = AsyncMock(return_value=None)

        with (
            patch("app.services.onboarding_service.settings", mock_settings),
            patch("app.services.onboarding_service.httpx.AsyncClient", mock_http),
        ):
            result = await svc.verify_turnstile_token("good-token", "1.2.3.4")
            assert result is True

    async def test_turnstile_returns_false_on_failure_response(
        self, db_session: AsyncSession
    ) -> None:
        """Turnstile API returning success=False yields False."""
        svc = _make_service(db_session)

        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value={"success": False})
        mock_response.raise_for_status = MagicMock()

        mock_settings = MagicMock()
        mock_settings.turnstile_secret_key = "valid-secret"

        mock_client_instance = AsyncMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)

        mock_http = MagicMock()
        mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_http.return_value.__aexit__ = AsyncMock(return_value=None)

        with (
            patch("app.services.onboarding_service.settings", mock_settings),
            patch("app.services.onboarding_service.httpx.AsyncClient", mock_http),
        ):
            result = await svc.verify_turnstile_token("bad-token", "1.2.3.4")
            assert result is False


# ---------------------------------------------------------------------------
# Submit flow
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestSubmitOnboarding:
    async def test_submit_onboarding_accepts_inline_first_event_data(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Final submit should accept first-event data without a prior step-save call."""
        svc = _make_service(db_session)
        session = await svc.create_session(
            request=CreateSessionRequest(session_type="npo_onboarding"),
            user_id=test_user.id,
        )
        test_user.email_verified = True
        await db_session.commit()

        await svc.update_step(
            token=session.token,
            step_name="npo_profile",
            data={"npo_name": "Inline Event NPO", "ein": "12-3456789"},
        )

        scheduled_coroutines: list[object] = []

        def capture_background_task(task_coro: object) -> None:
            scheduled_coroutines.append(task_coro)
            close = getattr(task_coro, "close", None)
            if callable(close):
                close()

        with (
            patch.object(svc, "verify_turnstile_token", AsyncMock(return_value=True)),
            patch.object(svc, "_send_submission_notifications", AsyncMock()),
            patch(
                "app.services.onboarding_service._schedule_background_task",
                side_effect=capture_background_task,
            ) as schedule_task,
        ):
            response = await svc.submit_npo_onboarding(
                session_token=session.token,
                turnstile_token="turnstile-token",
                first_event_data={
                    "event_name": "Founders Gala",
                    "event_date": "2026-09-12",
                    "event_type": "GALA",
                },
                ip_address="127.0.0.1",
            )

        assert response.event_id is not None
        schedule_task.assert_called_once()
        assert len(scheduled_coroutines) == 1


# ---------------------------------------------------------------------------
# Session expiry cleanup
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestExpireStaleSessionsCleansup:
    async def test_expire_stale_sessions_removes_expired(self, db_session: AsyncSession) -> None:
        """Sessions past expires_at are deleted; fresh sessions are kept."""
        svc = _make_service(db_session)

        # Create a fresh session
        fresh = await svc.create_session(
            request=CreateSessionRequest(session_type="npo_onboarding")
        )

        # Create an already-expired session
        expired = await svc.create_session(
            request=CreateSessionRequest(session_type="npo_onboarding")
        )
        expired.expires_at = datetime.now(tz=UTC) - timedelta(days=2)
        await db_session.commit()

        deleted = await svc.expire_stale_sessions()

        # At least the one expired session was removed
        assert deleted >= 1

        # Fresh session still exists
        still_alive = await svc.get_session(fresh.token)
        assert still_alive is not None


@pytest.mark.asyncio
class TestSubmissionNotifications:
    async def test_send_submission_notifications_sends_user_and_admin_emails(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Onboarding submission should notify both the applicant and admins."""
        svc = _make_service(db_session)
        npo = NPO(
            id=uuid.uuid4(),
            name="Test NPO",
            email=test_user.email,
            status=NPOStatus.PENDING_APPROVAL,
            created_by_user_id=test_user.id,
        )
        application = NPOApplication(
            id=uuid.uuid4(),
            npo_id=npo.id,
            status=ApplicationStatus.SUBMITTED,
        )

        mock_email_service = MagicMock()
        mock_email_service.send_npo_application_submitted_email = AsyncMock()
        mock_email_service.send_npo_application_submitted_admin_notification = AsyncMock()

        with patch(
            "app.services.onboarding_service.EmailService",
            return_value=mock_email_service,
        ):
            await svc._send_submission_notifications(test_user, npo, application)

        mock_email_service.send_npo_application_submitted_email.assert_awaited_once_with(
            to_email=test_user.email,
            npo_name="Test NPO",
            applicant_name=f"{test_user.first_name} {test_user.last_name}".strip()
            or test_user.first_name,
        )
        mock_email_service.send_npo_application_submitted_admin_notification.assert_awaited_once_with(
            applicant_name=f"{test_user.first_name} {test_user.last_name}".strip()
            or test_user.first_name,
            applicant_email=test_user.email,
            npo_name="Test NPO",
            application_id=str(application.id),
        )

    async def test_send_submission_notifications_still_attempts_admin_email_when_user_email_fails(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Admin approval notification should still be attempted if user ack email fails."""
        svc = _make_service(db_session)
        npo = NPO(
            id=uuid.uuid4(),
            name="Test NPO",
            email=test_user.email,
            status=NPOStatus.PENDING_APPROVAL,
            created_by_user_id=test_user.id,
        )
        application = NPOApplication(
            id=uuid.uuid4(),
            npo_id=npo.id,
            status=ApplicationStatus.SUBMITTED,
        )

        mock_email_service = MagicMock()
        mock_email_service.send_npo_application_submitted_email = AsyncMock(
            side_effect=RuntimeError("boom")
        )
        mock_email_service.send_npo_application_submitted_admin_notification = AsyncMock()

        with patch(
            "app.services.onboarding_service.EmailService",
            return_value=mock_email_service,
        ):
            await svc._send_submission_notifications(test_user, npo, application)

        mock_email_service.send_npo_application_submitted_email.assert_awaited_once()
        mock_email_service.send_npo_application_submitted_admin_notification.assert_awaited_once_with(
            applicant_name=f"{test_user.first_name} {test_user.last_name}".strip()
            or test_user.first_name,
            applicant_email=test_user.email,
            npo_name="Test NPO",
            application_id=str(application.id),
        )


# ---------------------------------------------------------------------------
# Near-duplicate NPO name check
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestNearDuplicateCheck:
    async def test_no_duplicate_returns_false(self, db_session: AsyncSession) -> None:
        """No NPO with a similar name → returns False."""
        svc = _make_service(db_session)
        result = await svc._check_near_duplicate_name("Completely Unique Organization Name ZZZ999")
        assert result is False

    async def test_exact_name_match_returns_true(
        self, db_session: AsyncSession, test_npo: "object"
    ) -> None:
        """Exact name match of an existing NPO → returns True."""
        npo = test_npo  # type: ignore[assignment]
        svc = _make_service(db_session)
        result = await svc._check_near_duplicate_name(npo.name)  # type: ignore[union-attr]
        assert result is True
