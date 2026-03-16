"""Pydantic schemas for NPO onboarding wizard."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.onboarding_session import OnboardingSessionType

# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class CreateSessionRequest(BaseModel):
    """Request body for POST /public/onboarding/sessions."""

    session_type: OnboardingSessionType = Field(
        ...,
        description=(
            "user_signup: 2-step flow (account + verify). "
            "npo_onboarding: 5-step flow (account + verify + NPO + event + confirm)."
        ),
    )


class UpdateStepRequest(BaseModel):
    """Request body for PATCH /public/onboarding/sessions/{token}/steps/{step_name}.

    The 'data' field is step-specific:
    - account step: {first_name, last_name, email, phone (optional)}
    - npo_profile step: {npo_name, ein, website_url, phone, mission_description (optional)}
    - first_event step: {event_name, event_date, event_type} or {} to skip
    """

    data: dict[str, Any] = Field(
        ...,
        description="Step-specific form data to merge into the session.",
    )


class SubmitOnboardingRequest(BaseModel):
    """Request body for POST /public/onboarding/submit."""

    session_token: str = Field(..., description="The onboarding session token.")
    turnstile_token: str = Field(
        ..., description="Cloudflare Turnstile verification token from the frontend widget."
    )
    first_event_data: dict[str, Any] | None = Field(
        default=None,
        description=(
            "Optional first-event payload sent with the final submit so the client does not need "
            "a separate save request before submission."
        ),
    )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class SessionResponse(BaseModel):
    """Response for session state endpoints."""

    token: str
    session_type: OnboardingSessionType
    current_step: str
    completed_steps: list[str]
    user_id: UUID | None
    form_data: dict[str, Any]
    expires_at: datetime

    model_config = {"from_attributes": True}


class SubmitOnboardingResponse(BaseModel):
    """Response for POST /public/onboarding/submit."""

    npo_id: UUID
    application_id: UUID
    event_id: UUID | None = None
    message: str = (
        "Your NPO application has been submitted. You will hear back within 3\u20135 business days."
    )
    duplicate_name_warning: bool = False


class ErrorResponse(BaseModel):
    """Standard error response."""

    detail: str
    code: str | None = None
