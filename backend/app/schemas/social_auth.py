"""Pydantic schemas for social authentication endpoints."""

import uuid
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class ProviderKey(str, Enum):
    """Supported social auth providers."""

    APPLE = "apple"
    GOOGLE = "google"
    FACEBOOK = "facebook"
    MICROSOFT = "microsoft"


class AppContext(str, Enum):
    """Application context for social auth."""

    DONOR_PWA = "donor_pwa"
    ADMIN_PWA = "admin_pwa"


class PendingReason(str, Enum):
    """Reasons why social auth requires additional verification."""

    NEEDS_LINK_CONFIRMATION = "needs_link_confirmation"
    NEEDS_EMAIL_VERIFICATION = "needs_email_verification"
    NEEDS_ADMIN_STEP_UP = "needs_admin_step_up"


class SocialProviderItem(BaseModel):
    """A single social auth provider entry."""

    provider: ProviderKey
    display_name: str
    enabled: bool


class SocialProviderListResponse(BaseModel):
    """Response for GET /auth/social/providers."""

    app_context: AppContext
    providers: list[SocialProviderItem]


class SocialStartRequest(BaseModel):
    """Request to initiate social auth flow."""

    app_context: AppContext
    redirect_uri: str = Field(..., description="Frontend callback URL")


class SocialStartResponse(BaseModel):
    """Response with provider authorization redirect info."""

    attempt_id: uuid.UUID
    authorization_url: str
    state: str


class SocialCallbackRequest(BaseModel):
    """Request to complete social auth after provider callback."""

    attempt_id: uuid.UUID
    code: str = Field(..., description="Authorization code from provider")
    state: str = Field(..., description="State token for CSRF validation")


class SocialAuthSuccessResponse(BaseModel):
    """Response when social auth completes successfully."""

    status: str = "authenticated"
    app_context: AppContext
    user_id: uuid.UUID
    access_token: str
    refresh_token: str


class SocialAuthPendingResponse(BaseModel):
    """Response when social auth requires additional verification (202)."""

    status: str = "pending_verification"
    reason: PendingReason
    attempt_id: uuid.UUID
    message: str | None = None


class LinkConfirmationRequest(BaseModel):
    """Request to confirm first-time link to existing account."""

    attempt_id: uuid.UUID
    email_login_confirmation_token: str = Field(
        ..., description="Password credential to confirm ownership of existing account"
    )


class EmailVerificationRequest(BaseModel):
    """Request to verify email for social sign-in."""

    attempt_id: uuid.UUID
    email: EmailStr
    verification_token: str


class AdminStepUpRequest(BaseModel):
    """Request to complete admin step-up verification."""

    attempt_id: uuid.UUID
    step_up_token: str


class SocialAuthErrorResponse(BaseModel):
    """Structured error response for social auth failures."""

    code: str
    message: str
    details: dict[str, str] | None = None
