"""Unit tests for the link-confirmation pending response contract."""

import uuid

from app.schemas.social_auth import PendingReason, SocialAuthPendingResponse


def test_link_confirmation_response_includes_prefill_email() -> None:
    """SocialAuthPendingResponse for link_confirmation_required must carry prefill_email."""
    attempt_id = uuid.uuid4()
    email = "user@example.com"

    response = SocialAuthPendingResponse(
        status="pending_verification",
        reason=PendingReason.NEEDS_LINK_CONFIRMATION,
        attempt_id=attempt_id,
        message="Please confirm your identity by entering your existing account password.",
        prefill_email=email,
    )

    assert response.prefill_email == email, (
        "Link-confirmation response must carry the candidate email so the UI can display it"
    )
    assert response.reason == PendingReason.NEEDS_LINK_CONFIRMATION
    assert response.attempt_id == attempt_id


def test_link_confirmation_response_prefill_email_is_optional() -> None:
    """prefill_email should be optional so the schema doesn't break on older code paths."""
    response = SocialAuthPendingResponse(
        status="pending_verification",
        reason=PendingReason.NEEDS_LINK_CONFIRMATION,
        attempt_id=uuid.uuid4(),
        message="Confirm identity.",
    )
    assert response.prefill_email is None
