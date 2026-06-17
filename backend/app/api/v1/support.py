"""Authenticated support message endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.logging import get_logger
from app.middleware.auth import get_current_active_user
from app.models.user import User
from app.schemas.support import SupportMessageCreate
from app.services.email_service import get_email_service

router = APIRouter(prefix="/support", tags=["support"])
logger = get_logger(__name__)

SUPPORT_EMAIL = "support@fundrbolt.com"
REASON_LABELS = {
    "bug": "Report a bug/issue",
    "event-inquiry": "Inquire about another event",
    "account": "Account or billing question",
    "feature-request": "Feature request",
    "general": "General question",
    "other": "Other",
}


@router.post(
    "/contact",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Send a support message",
    description="Send a support message to the FundrBolt team without opening the user's email client.",
)
async def send_support_message(
    data: SupportMessageCreate,
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Send a support request through the backend email service."""
    reason_label = REASON_LABELS.get(data.reason, data.reason)
    subject = f"[{reason_label}] {data.subject}"
    role_name = getattr(current_user, "role_name", "unknown")
    body = f"""
Support request submitted from the authenticated settings page.

From: {current_user.full_name} ({current_user.email})
Role: {role_name}
User ID: {current_user.id}
Reason: {reason_label}
Subject: {data.subject}

Message:
{data.message}

---
This message was sent from the FundrBolt app.
    """.strip()

    try:
        email_service = get_email_service()
        await email_service._send_email_with_retry(
            to_email=SUPPORT_EMAIL,
            subject=subject,
            body=body,
            email_type="support_message",
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Support message submission failed",
            extra={
                "user_id": str(current_user.id),
                "user_email": current_user.email,
                "reason": data.reason,
            },
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send support message. Please try again later.",
        ) from exc
