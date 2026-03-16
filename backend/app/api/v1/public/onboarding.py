"""Public onboarding wizard endpoints — no authentication required."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_user_optional
from app.middleware.rate_limit import rate_limit
from app.models.user import User
from app.schemas.onboarding import (
    CreateSessionRequest,
    SessionResponse,
    SubmitOnboardingRequest,
    SubmitOnboardingResponse,
    UpdateStepRequest,
)
from app.services.onboarding_service import OnboardingService

router = APIRouter(prefix="/onboarding", tags=["public-onboarding"])
logger = get_logger(__name__)


def _to_session_response(session: object) -> SessionResponse:
    """Convert an OnboardingSession ORM object to SessionResponse schema."""
    from app.models.onboarding_session import OnboardingSession as _Session  # noqa: PLC0415

    s: _Session = session  # type: ignore[assignment]
    return SessionResponse(
        token=s.token,
        session_type=s.session_type,
        current_step=s.current_step,
        completed_steps=list(s.completed_steps or []),
        user_id=s.user_id,
        form_data=dict(s.form_data or {}),
        expires_at=s.expires_at,
    )


# ---------------------------------------------------------------------------
# T012 — Create session
# ---------------------------------------------------------------------------


@router.post(
    "/sessions",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new onboarding wizard session",
    description=(
        "Creates a new server-side wizard session and returns an opaque token. "
        "If a valid Authorization: Bearer token is present, the user_id is linked "
        "and the wizard starts at npo_profile (US2 skip-ahead). "
        "Rate limited: 20 requests/hour/IP."
    ),
)
@rate_limit(max_requests=20, window_seconds=3600)
async def create_session(
    data: CreateSessionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> SessionResponse:
    """Create a new onboarding wizard session.

    The returned token must be stored by the client and sent on subsequent wizard requests.
    If the caller is authenticated (valid JWT), account/verify_email steps are pre-completed
    and the wizard opens at npo_profile (US2).
    """
    user_id = current_user.id if current_user else None
    service = OnboardingService(db=db)
    session = await service.create_session(request=data, user_id=user_id)
    return _to_session_response(session)


# ---------------------------------------------------------------------------
# T013 — Get session state
# ---------------------------------------------------------------------------


@router.get(
    "/sessions/{token}",
    response_model=SessionResponse,
    summary="Get current session state",
    description="Returns the wizard state for a non-expired session. Returns 404 if expired.",
)
async def get_session(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """Retrieve current wizard session state by token."""
    service = OnboardingService(db=db)
    session = await service.get_session(token)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding session not found or expired.",
        )
    return _to_session_response(session)


# ---------------------------------------------------------------------------
# T014 — Update a wizard step
# ---------------------------------------------------------------------------

_VALID_STEPS = frozenset({"account", "npo_profile", "first_event"})


@router.patch(
    "/sessions/{token}/steps/{step_name}",
    response_model=SessionResponse,
    summary="Update a wizard step's data",
    description=(
        "Saves form data for a specific step and advances current_step. "
        "Data is merged (not replaced) for the given step key."
    ),
)
async def update_step(
    token: str,
    step_name: str,
    data: UpdateStepRequest,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """Save step data and advance the wizard to the next step."""
    if step_name not in _VALID_STEPS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown step '{step_name}'. Valid steps: {sorted(_VALID_STEPS)}.",
        )
    service = OnboardingService(db=db)
    session = await service.update_step(token=token, step_name=step_name, data=data.data)
    return _to_session_response(session)


# ---------------------------------------------------------------------------
# T015 — Submit NPO application
# ---------------------------------------------------------------------------


@router.post(
    "/submit",
    response_model=SubmitOnboardingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit NPO application from wizard session",
    description=(
        "Creates the NPO record, application, and optional first event from the "
        "completed wizard session. Requires Turnstile CAPTCHA token. "
        "Rate limited: 5 requests/hour/IP."
    ),
)
@rate_limit(max_requests=5, window_seconds=3600)
async def submit_onboarding(
    data: SubmitOnboardingRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SubmitOnboardingResponse:
    """Submit the completed NPO onboarding wizard session.

    Creates the NPO record, NPO application, and optional first event.
    Sends an admin notification email on success.
    """
    ip_address = request.client.host if request.client else None
    service = OnboardingService(db=db)
    return await service.submit_npo_onboarding(
        session_token=data.session_token,
        turnstile_token=data.turnstile_token,
        first_event_data=data.first_event_data,
        ip_address=ip_address,
    )
