"""Onboarding session service for NPO wizard state management."""

import asyncio
import uuid
from collections.abc import Coroutine
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.audit_log import AuditLog
from app.models.event import Event, EventStatus
from app.models.npo import NPO, NPOStatus
from app.models.npo_application import ApplicationStatus, NPOApplication
from app.models.npo_member import MemberRole, MemberStatus, NPOMember
from app.models.onboarding_session import OnboardingSession, OnboardingSessionType
from app.models.user import User
from app.schemas.onboarding import (
    CreateSessionRequest,
    SubmitOnboardingResponse,
)
from app.services.email_service import EmailService

logger = get_logger(__name__)
settings = get_settings()

SESSION_EXPIRY_HOURS = 24
_STEP_ORDER_NPO = ["account", "verify_email", "npo_profile", "first_event", "confirmation"]
_STEP_ORDER_SIGNUP = ["account", "verify_email"]
_BACKGROUND_NOTIFICATION_TASKS: set[asyncio.Task[Any]] = set()


def _schedule_background_task(task_coro: Coroutine[Any, Any, None]) -> None:
    """Keep a strong reference to fire-and-forget notification tasks."""

    task = asyncio.create_task(task_coro)
    _BACKGROUND_NOTIFICATION_TASKS.add(task)

    def _cleanup(completed_task: asyncio.Task[Any]) -> None:
        _BACKGROUND_NOTIFICATION_TASKS.discard(completed_task)

        try:
            completed_task.result()
        except Exception as exc:  # pragma: no cover - defensive logging path
            logger.error(
                "Background onboarding notification task failed",
                extra={"error": str(exc)},
            )

    task.add_done_callback(_cleanup)


class OnboardingService:
    """Service for managing onboarding wizard sessions."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    async def create_session(
        self,
        request: CreateSessionRequest,
        user_id: uuid.UUID | None = None,
    ) -> OnboardingSession:
        """Create a new onboarding wizard session.

        If user_id is provided (authenticated user), skip to npo_profile step
        and pre-mark account/verify_email as completed (US2).

        Args:
            request: Session creation request with session_type.
            user_id: Optional authenticated user UUID.

        Returns:
            Newly created OnboardingSession.
        """
        now = datetime.now(tz=UTC)
        expires_at = now + timedelta(hours=SESSION_EXPIRY_HOURS)
        token = str(uuid.uuid4())

        if user_id and request.session_type == OnboardingSessionType.NPO_ONBOARDING:
            # Authenticated user: skip account/verify steps
            current_step = "npo_profile"
            completed_steps: list[str] = ["account", "verify_email"]
        else:
            current_step = "account"
            completed_steps = []

        session = OnboardingSession(
            token=token,
            session_type=request.session_type,
            current_step=current_step,
            completed_steps=completed_steps,
            form_data={},
            user_id=user_id,
            expires_at=expires_at,
            created_at=now,
            updated_at=now,
        )

        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)

        logger.info(
            "Onboarding session created",
            extra={
                "session_token": token,
                "session_type": request.session_type.value,
                "authenticated": user_id is not None,
            },
        )
        return session

    async def get_session(self, token: str) -> OnboardingSession | None:
        """Retrieve a non-expired session by token.

        Args:
            token: Opaque session token.

        Returns:
            OnboardingSession if found and not expired, else None.
        """
        now = datetime.now(tz=UTC)
        result = await self.db.execute(
            select(OnboardingSession).where(
                and_(
                    OnboardingSession.token == token,
                    OnboardingSession.expires_at > now,
                )
            )
        )
        return result.scalar_one_or_none()

    async def update_step(
        self,
        token: str,
        step_name: str,
        data: dict[str, Any],
    ) -> OnboardingSession:
        """Merge step data into session, advance current_step, update completed_steps.

        Args:
            token: Session token.
            step_name: Name of the wizard step being saved.
            data: Step-specific form data (no passwords stored).

        Returns:
            Updated OnboardingSession.

        Raises:
            HTTPException 404: If session not found or expired.
        """
        session = await self.get_session(token)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Onboarding session not found or expired.",
            )

        # Merge step data (passwords are never stored)
        safe_data = {k: v for k, v in data.items() if k != "password"}
        existing_form_data = dict(session.form_data or {})
        existing_form_data[step_name] = safe_data

        # Update completed steps
        completed = list(session.completed_steps or [])
        if step_name not in completed:
            completed.append(step_name)

        # Advance current_step to the next logical step
        step_order = (
            _STEP_ORDER_NPO
            if session.session_type == OnboardingSessionType.NPO_ONBOARDING
            else _STEP_ORDER_SIGNUP
        )
        try:
            current_idx = step_order.index(step_name)
            next_step = (
                step_order[current_idx + 1] if current_idx + 1 < len(step_order) else step_name
            )
        except ValueError:
            next_step = step_name

        now = datetime.now(tz=UTC)

        # Use direct attribute mutation + expunge + re-merge approach compatible with JSONB
        session.form_data = existing_form_data
        session.completed_steps = completed
        session.current_step = next_step
        session.updated_at = now

        # SQLAlchemy needs to detect JSONB mutations; force flag
        from sqlalchemy.orm.attributes import flag_modified

        flag_modified(session, "form_data")
        flag_modified(session, "completed_steps")

        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def expire_stale_sessions(self) -> int:
        """Delete all sessions that have fully expired (with a 24h grace buffer removed).

        Deletes sessions where expires_at < now(). Safe to call from a scheduled task.

        Returns:
            Number of sessions deleted.
        """
        now = datetime.now(tz=UTC)
        result = await self.db.execute(
            delete(OnboardingSession).where(OnboardingSession.expires_at < now)
        )
        await self.db.commit()
        deleted_count: int = int(result.rowcount)  # type: ignore[attr-defined]
        logger.info(
            "Expired onboarding sessions deleted",
            extra={"count": deleted_count},
        )
        return deleted_count

    # ------------------------------------------------------------------
    # Cloudflare Turnstile
    # ------------------------------------------------------------------

    async def verify_turnstile_token(self, token: str, ip_address: str | None = None) -> bool:
        """Verify a Cloudflare Turnstile token against the Turnstile API.

        When TURNSTILE_SECRET_KEY is not configured, verification is skipped
        (returns True) to ease local development.

        Args:
            token: Turnstile response token from the frontend widget.
            ip_address: Optional client IP for additional verification.

        Returns:
            True if token is valid, False otherwise.
        """
        if not settings.turnstile_secret_key:
            logger.warning(
                "TURNSTILE_SECRET_KEY not configured — skipping Turnstile verification.",
            )
            return True

        payload: dict[str, str] = {
            "secret": settings.turnstile_secret_key,
            "response": token,
        }
        if ip_address:
            payload["remoteip"] = ip_address

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                    data=payload,
                )
                resp.raise_for_status()
                result = resp.json()
                success: bool = result.get("success", False)
                if not success:
                    logger.warning(
                        "Turnstile verification failed",
                        extra={"error_codes": result.get("error-codes", [])},
                    )
                return success
        except httpx.HTTPError as exc:
            logger.error(
                "Turnstile verification HTTP error",
                extra={"error": str(exc)},
            )
            return False

    # ------------------------------------------------------------------
    # Submit NPO application
    # ------------------------------------------------------------------

    async def submit_npo_onboarding(
        self,
        session_token: str,
        turnstile_token: str,
        first_event_data: dict[str, Any] | None = None,
        ip_address: str | None = None,
    ) -> SubmitOnboardingResponse:
        """Submit the NPO onboarding application from a completed wizard session.

        Validates session completeness, verifies Turnstile CAPTCHA, creates the
        NPO record, NPO application, optional first event, writes an audit log
        entry, and dispatches the admin notification email.

        Args:
            session_token: Onboarding wizard session token.
            turnstile_token: Cloudflare Turnstile token from frontend.
            first_event_data: Optional first-event payload supplied with final submit.
            ip_address: Client IP address for audit log and Turnstile.

        Returns:
            SubmitOnboardingResponse with npo_id, application_id, event_id.

        Raises:
            HTTPException 404: Session not found or expired.
            HTTPException 400: Session incomplete or email unverified.
            HTTPException 422: Turnstile CAPTCHA verification failed.
        """
        # 1. Load and validate session
        session = await self.get_session(session_token)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Onboarding session not found or expired.",
            )

        if not session.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account creation and email verification must be complete before submitting.",
            )

        # 2. Load user and confirm email verified
        user_result = await self.db.execute(select(User).where(User.id == session.user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not found. Please restart the onboarding wizard.",
            )
        if not user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address must be verified before submitting.",
            )

        # 3. Verify required steps completed
        completed = set(session.completed_steps or [])
        required_steps = {"npo_profile"}
        missing = required_steps - completed
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Required wizard steps are incomplete: {', '.join(sorted(missing))}.",
            )

        # 4. Verify Turnstile CAPTCHA
        captcha_ok = await self.verify_turnstile_token(turnstile_token, ip_address)
        if not captcha_ok:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="CAPTCHA verification failed. Please try again.",
            )

        # 5. Extract npo_profile data
        form_data = dict(session.form_data or {})
        if first_event_data is not None:
            form_data["first_event"] = dict(first_event_data)

        npo_data = dict(form_data.get("npo_profile", {}))
        if not npo_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="NPO profile data is missing from the session.",
            )

        npo_name: str = npo_data.get("npo_name", "")
        if not npo_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="NPO name is required.",
            )

        # 6. Near-duplicate NPO name check (only for new applications, warning only)
        #    Also detect if this is a revision resubmission (NPO in UNDER_REVISION).
        under_revision_result = await self.db.execute(
            select(NPO)
            .where(
                NPO.created_by_user_id == user.id,
                NPO.status == NPOStatus.UNDER_REVISION,
                NPO.deleted_at.is_(None),
            )
            .limit(1)
        )
        existing_under_revision_npo = under_revision_result.scalar_one_or_none()
        is_resubmission = existing_under_revision_npo is not None

        duplicate_warning: bool
        if is_resubmission:
            duplicate_warning = False  # Already-named NPO — skip duplicate check
        else:
            duplicate_warning = await self._check_near_duplicate_name(npo_name)

        # 7. Create NPO record (or update existing UNDER_REVISION NPO for resubmission)
        now = datetime.now(tz=UTC)
        npo: NPO
        if is_resubmission:
            npo = existing_under_revision_npo  # type: ignore[assignment]
            npo.name = npo_name
            npo.tax_id = npo_data.get("ein")
            npo.website_url = npo_data.get("website_url")
            npo.phone = npo_data.get("phone")
            npo.mission_statement = npo_data.get("mission") or npo_data.get("mission_description")
            npo.status = NPOStatus.PENDING_APPROVAL
        else:
            npo = NPO(
                name=npo_name,
                tax_id=npo_data.get("ein"),
                website_url=npo_data.get("website_url"),
                phone=npo_data.get("phone"),
                mission_statement=npo_data.get("mission") or npo_data.get("mission_description"),
                email=user.email,
                status=NPOStatus.PENDING_APPROVAL,
                created_by_user_id=user.id,
            )
            self.db.add(npo)
            await self.db.flush()  # Populate npo.id

        # 8. Add user as ADMIN member of the NPO (only for fresh applications)
        if not is_resubmission:
            member = NPOMember(
                npo_id=npo.id,
                user_id=user.id,
                role=MemberRole.ADMIN,
                status=MemberStatus.ACTIVE,
                joined_at=now,
            )
            self.db.add(member)

            # Upgrade user from donor role to npo_admin so they can access the admin PWA
            from app.models.base import Base  # avoid circular import at module level

            npo_admin_role_stmt = select(Base.metadata.tables["roles"].c.id).where(
                Base.metadata.tables["roles"].c.name == "npo_admin"
            )
            npo_admin_role_result = await self.db.execute(npo_admin_role_stmt)
            npo_admin_role_id = npo_admin_role_result.scalar_one_or_none()
            if npo_admin_role_id:
                user.role_id = npo_admin_role_id

        # 9. Create NPOApplication
        review_action = "resubmitted" if is_resubmission else "submitted"
        application = NPOApplication(
            npo_id=npo.id,
            status=ApplicationStatus.SUBMITTED,
            submitted_at=now,
            review_notes=[
                {
                    "action": review_action,
                    "actor_user_id": str(user.id),
                    "timestamp": now.isoformat(),
                    "notes": None,
                }
            ],
        )
        self.db.add(application)
        await self.db.flush()  # Populate application.id

        # 10. Create optional first event (DRAFT status)
        event_id: uuid.UUID | None = None
        first_event_data = dict(form_data.get("first_event", {}))
        if first_event_data and first_event_data.get("event_name"):
            event_slug = self._generate_slug(first_event_data["event_name"], npo.id)
            event_dt_str: str = first_event_data.get("event_date", "")
            try:
                # Accept ISO date strings like "2026-06-15"
                if "T" in event_dt_str:
                    event_dt = datetime.fromisoformat(event_dt_str).replace(tzinfo=UTC)
                else:
                    from datetime import date

                    parsed_date = date.fromisoformat(event_dt_str)
                    event_dt = datetime(
                        parsed_date.year,
                        parsed_date.month,
                        parsed_date.day,
                        tzinfo=UTC,
                    )
            except (ValueError, TypeError):
                event_dt = now + timedelta(days=90)  # Fallback: 90 days from now

            event = Event(
                npo_id=npo.id,
                name=first_event_data["event_name"],
                slug=event_slug,
                event_datetime=event_dt,
                timezone="UTC",
                status=EventStatus.DRAFT,
                created_by=user.id,
                updated_by=user.id,
            )
            self.db.add(event)
            await self.db.flush()
            event_id = event.id

        # 11. Write audit log entry
        audit_action = (
            "npo_application_resubmitted" if is_resubmission else "npo_application_submitted"
        )
        audit_log = AuditLog(
            user_id=user.id,
            action=audit_action,
            ip_address=ip_address or "unknown",
            resource_type="npo_application",
            resource_id=application.id,
            event_metadata={
                "npo_id": str(npo.id),
                "npo_name": npo_name,
                "application_id": str(application.id),
            },
        )
        self.db.add(audit_log)

        # 12. Commit everything
        await self.db.commit()
        await self.db.refresh(npo)
        await self.db.refresh(application)

        # 13. Dispatch submission notification emails asynchronously.
        # Keep a strong reference so the task is not garbage-collected mid-send.
        _schedule_background_task(
            self._send_submission_notifications(
                user=user,
                npo=npo,
                application=application,
            )
        )

        logger.info(
            "NPO application submitted via onboarding wizard",
            extra={
                "user_id": str(user.id),
                "npo_id": str(npo.id),
                "application_id": str(application.id),
                "session_token": session_token,
            },
        )

        return SubmitOnboardingResponse(
            npo_id=npo.id,
            application_id=application.id,
            event_id=event_id,
            duplicate_name_warning=duplicate_warning,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _check_near_duplicate_name(self, name: str) -> bool:
        """Return True if a near-duplicate NPO name already exists.

        Uses case-insensitive exact and word-boundary checks as a
        lightweight heuristic — not a hard error, just a warning flag.

        Args:
            name: Proposed NPO name.

        Returns:
            True if a similar name exists, False otherwise.
        """
        normalized = name.strip().lower()
        result = await self.db.execute(
            select(NPO.name).where(
                and_(
                    NPO.deleted_at.is_(None),
                    or_(
                        # Exact case-insensitive match
                        func.lower(NPO.name) == normalized,
                        # Substring match (one contains the other)
                        func.lower(NPO.name).contains(normalized),
                    ),
                )
            )
        )
        existing_names = result.scalars().all()
        return len(existing_names) > 0

    def _generate_slug(self, name: str, npo_id: uuid.UUID) -> str:
        """Generate a URL-safe slug from an event name.

        Appends a short suffix from the npo_id to reduce collision risk.
        """
        import re

        base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        suffix = str(npo_id)[:8]
        return f"{base}-{suffix}"

    async def _send_submission_notifications(
        self, user: User, npo: NPO, application: NPOApplication
    ) -> None:
        """Fire-and-forget applicant and admin submission email helper."""
        try:
            import asyncio

            email_service = EmailService()
            applicant_name = f"{user.first_name} {user.last_name}".strip() or user.first_name

            notification_results = await asyncio.gather(
                email_service.send_npo_application_submitted_email(
                    to_email=user.contact_email,
                    npo_name=npo.name,
                    applicant_name=applicant_name,
                ),
                email_service.send_npo_application_submitted_admin_notification(
                    applicant_name=applicant_name,
                    applicant_email=user.contact_email,
                    npo_name=npo.name,
                    application_id=str(application.id),
                ),
                return_exceptions=True,
            )

            applicant_result, admin_result = notification_results

            if isinstance(applicant_result, Exception):
                logger.error(
                    "Failed to send onboarding applicant acknowledgement email",
                    extra={"error": str(applicant_result), "npo_id": str(npo.id)},
                )

            if isinstance(admin_result, Exception):
                logger.error(
                    "Failed to send onboarding admin approval notification email",
                    extra={"error": str(admin_result), "npo_id": str(npo.id)},
                )
        except Exception as exc:
            logger.error(
                "Failed to send onboarding submission notification emails",
                extra={"error": str(exc), "npo_id": str(npo.id)},
            )
