"""Social authentication service.

Orchestrates social sign-in flows including provider discovery,
OAuth2 authorization, account linking, provisioning, email
verification gating, and admin step-up verification.
"""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.metrics import (
    SOCIAL_AUTH_FAILURES_TOTAL,
    SOCIAL_AUTH_STARTS_TOTAL,
    SOCIAL_AUTH_SUCCESS_TOTAL,
)
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.models.social_auth_attempt import SocialAuthAttempt
from app.models.social_auth_challenge import (
    AdminStepUpChallenge,
    EmailVerificationChallenge,
    SocialPendingLinkConfirmation,
)
from app.models.social_identity_link import SocialIdentityLink
from app.models.user import User
from app.schemas.social_auth import (
    AppContext,
    PendingReason,
    ProviderKey,
    SocialAuthPendingResponse,
    SocialAuthSuccessResponse,
    SocialProviderItem,
    SocialProviderListResponse,
    SocialStartResponse,
)
from app.services.session_service import SessionService

logger = get_logger(__name__)

# Provider display names
PROVIDER_DISPLAY_NAMES: dict[str, str] = {
    "apple": "Apple",
    "google": "Google",
    "facebook": "Facebook",
    "microsoft": "Microsoft",
}

# Whitelist of provider claims we persist (data minimization)
ALLOWED_PROVIDER_CLAIMS = {"sub", "email", "email_verified", "name"}

# Challenge expiry durations
LINK_CONFIRMATION_TTL = timedelta(minutes=15)
EMAIL_VERIFICATION_TTL = timedelta(hours=1)
ADMIN_STEP_UP_TTL = timedelta(minutes=10)
ATTEMPT_TTL = timedelta(minutes=10)


def _mask_value(value: str, visible: int = 4) -> str:
    """Mask a string value for safe logging, showing only first N chars."""
    if len(value) <= visible:
        return "***"
    return value[:visible] + "***"


class SocialAuthService:
    """Service for social authentication operations."""

    @staticmethod
    def get_enabled_providers() -> list[str]:
        """Return list of enabled provider keys from config."""
        settings = get_settings()
        if not settings.social_auth_enabled:
            return []
        raw = settings.social_auth_enabled_providers
        return [p.strip() for p in raw.split(",") if p.strip()]

    @staticmethod
    def is_provider_configured(provider: str) -> bool:
        """Check if a provider has client credentials configured."""
        settings = get_settings()
        client_id = getattr(settings, f"social_auth_{provider}_client_id", None)
        client_secret = getattr(settings, f"social_auth_{provider}_client_secret", None)
        return bool(client_id and client_secret)

    @classmethod
    def list_providers(cls, app_context: AppContext) -> SocialProviderListResponse:
        """List social providers available for given app context."""
        enabled = cls.get_enabled_providers()
        providers: list[SocialProviderItem] = []
        for key in enabled:
            try:
                provider_key = ProviderKey(key)
            except ValueError:
                continue
            providers.append(
                SocialProviderItem(
                    provider=provider_key,
                    display_name=PROVIDER_DISPLAY_NAMES.get(key, key.title()),
                    enabled=cls.is_provider_configured(key),
                )
            )
        return SocialProviderListResponse(app_context=app_context, providers=providers)

    @classmethod
    async def start_auth(
        cls,
        db: AsyncSession,
        provider: ProviderKey,
        app_context: AppContext,
        redirect_uri: str,
        client_ip: str | None = None,
        user_agent: str | None = None,
    ) -> SocialStartResponse:
        """Initiate a social auth flow. Creates an attempt record and returns an authorization URL."""
        if provider.value not in cls.get_enabled_providers():
            raise ValueError(f"Provider '{provider.value}' is not enabled")
        if not cls.is_provider_configured(provider.value):
            raise ValueError(f"Provider '{provider.value}' is not configured")

        state_token = secrets.token_urlsafe(32)
        pkce_verifier = secrets.token_urlsafe(64)
        pkce_hash = hashlib.sha256(pkce_verifier.encode()).hexdigest()

        attempt = SocialAuthAttempt(
            id=uuid.uuid4(),
            provider_key=provider.value,
            app_context=app_context.value,
            state_token=state_token,
            pkce_verifier_hash=pkce_hash,
            redirect_uri=redirect_uri,
            client_ip=client_ip,
            user_agent=user_agent,
            result="started",
        )
        db.add(attempt)
        await db.flush()

        authorization_url = cls._build_authorization_url(
            provider, state_token, redirect_uri, pkce_verifier
        )

        logger.info(
            "Social auth started",
            extra={
                "provider": provider.value,
                "app_context": app_context.value,
                "attempt_id": str(attempt.id),
            },
        )
        SOCIAL_AUTH_STARTS_TOTAL.labels(
            provider=provider.value, app_context=app_context.value
        ).inc()

        return SocialStartResponse(
            attempt_id=attempt.id,
            authorization_url=authorization_url,
            state=state_token,
        )

    @classmethod
    async def handle_callback(
        cls,
        db: AsyncSession,
        provider: ProviderKey,
        attempt_id: uuid.UUID | None,
        code: str,
        state: str,
    ) -> SocialAuthSuccessResponse | SocialAuthPendingResponse:
        """Process OAuth2 callback after provider authorization.

        This method:
        1. Validates the attempt and state token
        2. Exchanges the code for provider claims (simulated)
        3. Looks up or creates the social identity link
        4. Handles account matching/provisioning
        5. Returns success or pending verification response
        """
        # Validate attempt
        attempt = await cls._get_valid_attempt(db, attempt_id, state, provider.value)

        # Simulate provider token exchange (in production, call provider APIs)
        provider_claims = cls._simulate_provider_claims(provider, code)
        provider_subject = provider_claims.get("sub", "")
        provider_email = provider_claims.get("email")
        email_verified = provider_claims.get("email_verified", False)

        # Minimize claims to whitelist
        _ = {k: v for k, v in provider_claims.items() if k in ALLOWED_PROVIDER_CLAIMS}

        # Check for existing social identity link
        existing_link = await cls._find_identity_link(db, provider.value, provider_subject)

        if existing_link and existing_link.is_active:
            # Returning user – issue session directly
            user = await cls._get_user_by_id(db, existing_link.user_id)
            if not user or not user.is_active:
                attempt.result = "denied"
                attempt.failure_code = "account_inactive"
                attempt.completed_at = datetime.now(UTC)
                SOCIAL_AUTH_FAILURES_TOTAL.labels(
                    provider=provider.value, failure_code="account_inactive"
                ).inc()
                raise ValueError("Account is inactive or not found")

            # Admin step-up required?
            app_ctx = AppContext(attempt.app_context)
            if app_ctx == AppContext.ADMIN_PWA and user.role.name != "donor":
                return await cls._require_admin_step_up(db, attempt, user)

            return await cls._complete_auth(db, attempt, user)

        # No existing link – try to match by email
        if provider_email and email_verified:
            candidate = await cls._find_user_by_email(db, provider_email)
            if candidate:
                # Require first-time link confirmation
                return await cls._require_link_confirmation(
                    db, attempt, candidate, provider.value, provider_subject
                )
        elif provider_email and not email_verified:
            # Require in-app email verification
            return await cls._require_email_verification(db, attempt, provider_email)
        elif not provider_email:
            # No email from provider – require in-app verification
            return await cls._require_email_verification(db, attempt, "")

        # No matching user – apply provisioning rules
        app_ctx = AppContext(attempt.app_context)
        if app_ctx == AppContext.DONOR_PWA:
            # Auto-create donor account
            user = await cls._auto_provision_donor(db, provider_email or "", provider_claims)
            await cls._create_identity_link(
                db,
                user.id,
                provider.value,
                provider_subject,
                provider_email,
                email_verified,
                attempt.id,
            )
            return await cls._complete_auth(db, attempt, user)
        else:
            # Admin PWA – deny, no pre-provisioned account
            attempt.result = "denied"
            attempt.failure_code = "admin_not_provisioned"
            attempt.completed_at = datetime.now(UTC)
            SOCIAL_AUTH_FAILURES_TOTAL.labels(
                provider=provider.value, failure_code="admin_not_provisioned"
            ).inc()
            raise ValueError(
                "No pre-provisioned admin account found. "
                "Please contact your organization administrator."
            )

    @classmethod
    async def confirm_link(
        cls,
        db: AsyncSession,
        attempt_id: uuid.UUID,
        password: str,
    ) -> SocialAuthSuccessResponse | SocialAuthPendingResponse:
        """Confirm first-time link by verifying existing account password."""
        # Find pending confirmation
        stmt = select(SocialPendingLinkConfirmation).where(
            SocialPendingLinkConfirmation.attempt_id == attempt_id,
            SocialPendingLinkConfirmation.confirmed_at.is_(None),
        )
        result = await db.execute(stmt)
        confirmation = result.scalar_one_or_none()
        if not confirmation:
            raise ValueError("No pending link confirmation found")
        if confirmation.expires_at < datetime.now(UTC):
            raise ValueError("Link confirmation has expired")

        # Get user and verify password
        user = await cls._get_user_by_id(db, confirmation.candidate_user_id)
        if not user:
            raise ValueError("User not found")
        if not user.verify_password(password):
            raise ValueError("Invalid password")

        # Create the identity link
        await cls._create_identity_link(
            db,
            user.id,
            confirmation.provider_key,
            confirmation.provider_subject,
            None,
            False,
            attempt_id,
        )
        confirmation.confirmed_at = datetime.now(UTC)

        # Get attempt
        attempt = await cls._get_attempt_by_id(db, attempt_id)
        if not attempt:
            raise ValueError("Attempt not found")

        # Admin step-up check
        app_ctx = AppContext(attempt.app_context)
        if app_ctx == AppContext.ADMIN_PWA and user.role.name != "donor":
            return await cls._require_admin_step_up(db, attempt, user)

        return await cls._complete_auth(db, attempt, user)

    @classmethod
    async def verify_email(
        cls,
        db: AsyncSession,
        attempt_id: uuid.UUID,
        email: str,
        verification_token: str,
    ) -> SocialAuthSuccessResponse | SocialAuthPendingResponse:
        """Complete email verification for social auth."""
        stmt = select(EmailVerificationChallenge).where(
            EmailVerificationChallenge.attempt_id == attempt_id,
            EmailVerificationChallenge.verification_token == verification_token,
            EmailVerificationChallenge.verification_status == "pending",
        )
        result = await db.execute(stmt)
        challenge = result.scalar_one_or_none()
        if not challenge:
            raise ValueError("Invalid verification token")
        if challenge.expires_at < datetime.now(UTC):
            challenge.verification_status = "expired"
            raise ValueError("Verification challenge has expired")

        challenge.verification_status = "verified"
        challenge.verified_at = datetime.now(UTC)

        attempt = await cls._get_attempt_by_id(db, attempt_id)
        if not attempt:
            raise ValueError("Attempt not found")

        # Now try to match/provision
        user = await cls._find_user_by_email(db, email)
        app_ctx = AppContext(attempt.app_context)

        if user:
            # Link to existing user (email now verified via in-app)
            await cls._create_identity_link(
                db,
                user.id,
                attempt.provider_key,
                "",  # subject filled from attempt
                email,
                True,
                attempt_id,
            )
            if app_ctx == AppContext.ADMIN_PWA and user.role.name != "donor":
                return await cls._require_admin_step_up(db, attempt, user)
            return await cls._complete_auth(db, attempt, user)
        elif app_ctx == AppContext.DONOR_PWA:
            user = await cls._auto_provision_donor(db, email, {})
            await cls._create_identity_link(
                db, user.id, attempt.provider_key, "", email, True, attempt_id
            )
            return await cls._complete_auth(db, attempt, user)
        else:
            attempt.result = "denied"
            attempt.failure_code = "admin_not_provisioned"
            attempt.completed_at = datetime.now(UTC)
            raise ValueError("No pre-provisioned admin account found.")

    @classmethod
    async def complete_admin_step_up(
        cls,
        db: AsyncSession,
        attempt_id: uuid.UUID,
        step_up_token: str,
    ) -> SocialAuthSuccessResponse:
        """Complete admin step-up verification."""
        stmt = select(AdminStepUpChallenge).where(
            AdminStepUpChallenge.attempt_id == attempt_id,
            AdminStepUpChallenge.step_up_token == step_up_token,
            AdminStepUpChallenge.status == "pending",
        )
        result = await db.execute(stmt)
        challenge = result.scalar_one_or_none()
        if not challenge:
            raise ValueError("Invalid step-up token")
        if challenge.expires_at < datetime.now(UTC):
            challenge.status = "expired"
            raise ValueError("Step-up challenge has expired")

        challenge.status = "satisfied"
        challenge.completed_at = datetime.now(UTC)

        user = await cls._get_user_by_id(db, challenge.user_id)
        if not user:
            raise ValueError("User not found")

        attempt = await cls._get_attempt_by_id(db, attempt_id)
        if not attempt:
            raise ValueError("Attempt not found")

        return await cls._complete_auth(db, attempt, user)

    # --- Private helpers ---

    @staticmethod
    async def _get_valid_attempt(
        db: AsyncSession,
        attempt_id: uuid.UUID | None,
        state: str,
        provider_key: str,
    ) -> SocialAuthAttempt:
        """Retrieve and validate an auth attempt."""
        stmt = select(SocialAuthAttempt).where(
            SocialAuthAttempt.state_token == state,
            SocialAuthAttempt.provider_key == provider_key,
            SocialAuthAttempt.result == "started",
        )
        if attempt_id is not None:
            stmt = stmt.where(SocialAuthAttempt.id == attempt_id)

        result = await db.execute(stmt)
        attempt = result.scalar_one_or_none()
        if not attempt:
            raise ValueError("Invalid or expired social auth attempt")
        if attempt.started_at + ATTEMPT_TTL < datetime.now(UTC):
            attempt.result = "failed"
            attempt.failure_code = "expired"
            attempt.completed_at = datetime.now(UTC)
            raise ValueError("Social auth attempt has expired")
        return attempt

    @staticmethod
    async def _get_attempt_by_id(
        db: AsyncSession, attempt_id: uuid.UUID
    ) -> SocialAuthAttempt | None:
        stmt = select(SocialAuthAttempt).where(SocialAuthAttempt.id == attempt_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def _find_identity_link(
        db: AsyncSession, provider_key: str, provider_subject: str
    ) -> SocialIdentityLink | None:
        stmt = select(SocialIdentityLink).where(
            SocialIdentityLink.provider_key == provider_key,
            SocialIdentityLink.provider_subject == provider_subject,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def _find_user_by_email(db: AsyncSession, email: str) -> User | None:
        stmt = select(User).where(User.email == email.lower())
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def _get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def _create_identity_link(
        db: AsyncSession,
        user_id: uuid.UUID,
        provider_key: str,
        provider_subject: str,
        provider_email: str | None,
        email_verified: bool,
        attempt_id: uuid.UUID,
    ) -> SocialIdentityLink:
        link = SocialIdentityLink(
            id=uuid.uuid4(),
            user_id=user_id,
            provider_key=provider_key,
            provider_subject=provider_subject,
            provider_email=provider_email,
            provider_email_verified=email_verified,
            linked_via_attempt_id=attempt_id,
            is_active=True,
        )
        db.add(link)
        await db.flush()
        logger.info(
            "Social identity link created",
            extra={
                "user_id": str(user_id),
                "provider": provider_key,
                "provider_subject": _mask_value(provider_subject),
            },
        )
        return link

    @classmethod
    async def _complete_auth(
        cls,
        db: AsyncSession,
        attempt: SocialAuthAttempt,
        user: User,
    ) -> SocialAuthSuccessResponse:
        """Issue tokens and mark attempt as successful."""
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = create_refresh_token(data={"sub": str(user.id)})

        # Create a session in Redis so the refresh token can be used
        refresh_payload = decode_token(refresh_token)
        refresh_jti = refresh_payload["jti"]
        await SessionService.create_session(
            db=db,
            user_id=user.id,
            refresh_token_jti=refresh_jti,
            device_info="social_auth",
        )

        attempt.result = "success"
        attempt.user_id = user.id
        attempt.completed_at = datetime.now(UTC)

        app_ctx = AppContext(attempt.app_context)

        logger.info(
            "Social auth completed successfully",
            extra={
                "user_id": str(user.id),
                "provider": attempt.provider_key,
                "app_context": attempt.app_context,
            },
        )
        SOCIAL_AUTH_SUCCESS_TOTAL.labels(
            provider=attempt.provider_key, app_context=attempt.app_context
        ).inc()

        return SocialAuthSuccessResponse(
            status="authenticated",
            app_context=app_ctx,
            user_id=user.id,
            access_token=access_token,
            refresh_token=refresh_token,
        )

    @classmethod
    async def _require_link_confirmation(
        cls,
        db: AsyncSession,
        attempt: SocialAuthAttempt,
        candidate: User,
        provider_key: str,
        provider_subject: str,
    ) -> SocialAuthPendingResponse:
        """Create a pending link confirmation challenge."""
        token = secrets.token_urlsafe(32)
        confirmation = SocialPendingLinkConfirmation(
            id=uuid.uuid4(),
            attempt_id=attempt.id,
            candidate_user_id=candidate.id,
            provider_key=provider_key,
            provider_subject=provider_subject,
            confirmation_token=token,
            expires_at=datetime.now(UTC) + LINK_CONFIRMATION_TTL,
        )
        db.add(confirmation)
        attempt.result = "needs_link_confirmation"
        await db.flush()

        logger.info(
            "Social auth requires link confirmation",
            extra={
                "attempt_id": str(attempt.id),
                "provider": provider_key,
                "candidate_email": _mask_value(candidate.email),
            },
        )

        return SocialAuthPendingResponse(
            status="pending_verification",
            reason=PendingReason.NEEDS_LINK_CONFIRMATION,
            attempt_id=attempt.id,
            message="Please confirm your identity by entering your existing account password.",
        )

    @classmethod
    async def _require_email_verification(
        cls,
        db: AsyncSession,
        attempt: SocialAuthAttempt,
        email: str,
    ) -> SocialAuthPendingResponse:
        """Create an email verification challenge."""
        token = secrets.token_urlsafe(32)
        challenge = EmailVerificationChallenge(
            id=uuid.uuid4(),
            attempt_id=attempt.id,
            email=email,
            verification_token=token,
            verification_status="pending",
            expires_at=datetime.now(UTC) + EMAIL_VERIFICATION_TTL,
        )
        db.add(challenge)
        attempt.result = "needs_email_verification"
        await db.flush()

        logger.info(
            "Social auth requires email verification",
            extra={
                "attempt_id": str(attempt.id),
                "email": _mask_value(email) if email else "none",
            },
        )

        return SocialAuthPendingResponse(
            status="pending_verification",
            reason=PendingReason.NEEDS_EMAIL_VERIFICATION,
            attempt_id=attempt.id,
            message="Please verify your email address to continue.",
        )

    @classmethod
    async def _require_admin_step_up(
        cls,
        db: AsyncSession,
        attempt: SocialAuthAttempt,
        user: User,
    ) -> SocialAuthPendingResponse:
        """Create an admin step-up challenge."""
        token = secrets.token_urlsafe(32)
        challenge = AdminStepUpChallenge(
            id=uuid.uuid4(),
            attempt_id=attempt.id,
            user_id=user.id,
            step_up_token=token,
            status="pending",
            expires_at=datetime.now(UTC) + ADMIN_STEP_UP_TTL,
        )
        db.add(challenge)
        attempt.result = "needs_admin_step_up"
        await db.flush()

        logger.info(
            "Social auth requires admin step-up",
            extra={
                "attempt_id": str(attempt.id),
                "user_id": str(user.id),
            },
        )

        return SocialAuthPendingResponse(
            status="pending_verification",
            reason=PendingReason.NEEDS_ADMIN_STEP_UP,
            attempt_id=attempt.id,
            message="Additional verification is required for admin access. Please enter your password.",
        )

    @staticmethod
    async def _auto_provision_donor(
        db: AsyncSession,
        email: str,
        provider_claims: dict[str, Any],
    ) -> User:
        """Auto-create a donor account from provider claims."""
        from app.models.role import Role

        # Get donor role
        stmt = select(Role).where(Role.name == "donor")
        result = await db.execute(stmt)
        role = result.scalar_one_or_none()
        if not role:
            raise ValueError("Donor role not configured")

        name = provider_claims.get("name", "")
        parts = name.split(" ", 1) if name else ["", ""]
        first_name = parts[0] or "Social"
        last_name = parts[1] if len(parts) > 1 else "User"

        # Create user with random password (they use social login)
        user = User(
            id=uuid.uuid4(),
            email=email.lower(),
            first_name=first_name,
            last_name=last_name,
            email_verified=True,
            is_active=True,
            role_id=role.id,
        )
        user.set_password(secrets.token_urlsafe(32))
        db.add(user)
        await db.flush()

        logger.info(
            "Donor account auto-provisioned via social login",
            extra={"user_id": str(user.id), "email": _mask_value(email)},
        )
        return user

    @staticmethod
    def _build_authorization_url(
        provider: ProviderKey,
        state: str,
        redirect_uri: str,
        pkce_verifier: str,
    ) -> str:
        """Build the provider-specific authorization URL.

        In production this constructs real OAuth2 URLs. Currently returns
        a placeholder that the frontend can intercept for development.
        """
        settings = get_settings()

        provider_urls = {
            ProviderKey.GOOGLE: "https://accounts.google.com/o/oauth2/v2/auth",
            ProviderKey.APPLE: "https://appleid.apple.com/auth/authorize",
            ProviderKey.FACEBOOK: "https://www.facebook.com/v18.0/dialog/oauth",
            ProviderKey.MICROSOFT: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        }
        auth_base = provider_urls.get(provider, "")

        client_id = getattr(settings, f"social_auth_{provider.value}_client_id", "")

        import urllib.parse

        params = {
            "client_id": client_id or "",
            "redirect_uri": redirect_uri,
            "state": state,
            "response_type": "code",
            "scope": SocialAuthService._get_scopes(provider),
        }
        return f"{auth_base}?{urllib.parse.urlencode(params)}"

    @staticmethod
    def _get_scopes(provider: ProviderKey) -> str:
        """Return OAuth2 scopes per provider (minimal for data minimization)."""
        scopes = {
            ProviderKey.GOOGLE: "openid email profile",
            ProviderKey.APPLE: "email name",
            ProviderKey.FACEBOOK: "email public_profile",
            ProviderKey.MICROSOFT: "openid email profile",
        }
        return scopes.get(provider, "openid email")

    @staticmethod
    def _simulate_provider_claims(provider: ProviderKey, code: str) -> dict[str, Any]:
        """Simulate provider token exchange for development.

        In production, this would exchange the authorization code for an
        ID token and extract claims. For development/testing, returns
        deterministic claims based on the code.
        """
        return {
            "sub": f"{provider.value}_{code[:8]}",
            "email": f"social.user.{code[:6]}@example.com",
            "email_verified": True,
            "name": "Social User",
        }

    @staticmethod
    async def delete_social_links_for_user(db: AsyncSession, user_id: uuid.UUID) -> int:
        """Delete all social identity links for a user (GDPR deletion)."""
        stmt = select(SocialIdentityLink).where(SocialIdentityLink.user_id == user_id)
        result = await db.execute(stmt)
        links = result.scalars().all()
        count = len(links)
        for link in links:
            await db.delete(link)
        if count > 0:
            logger.info(
                "Social identity links deleted for user",
                extra={"user_id": str(user_id), "count": count},
            )
        return count
