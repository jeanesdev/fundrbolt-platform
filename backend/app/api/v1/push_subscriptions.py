"""Push subscription API endpoints for Web Push notifications."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.user import User
from app.schemas.push_subscription import (
    PushSubscribeRequest,
    PushUnsubscribeRequest,
    VapidPublicKeyResponse,
)
from app.services.push_notification_service import PushNotificationService

router = APIRouter(prefix="/notifications/push", tags=["push-notifications"])
settings = get_settings()


@router.post("/subscribe", status_code=201)
async def subscribe_push(
    body: PushSubscribeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, str]:
    """Register a Web Push subscription for the current user."""
    user_agent = request.headers.get("user-agent")
    subscription = await PushNotificationService.subscribe(
        db=db,
        user_id=current_user.id,
        endpoint=body.endpoint,
        p256dh_key=body.keys.p256dh,
        auth_key=body.keys.auth,
        platform=body.platform,
        user_agent=user_agent,
    )
    await db.commit()
    return {"id": str(subscription.id), "status": "subscribed"}


@router.post("/unsubscribe")
async def unsubscribe_push(
    body: PushUnsubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, bool]:
    """Deactivate a Web Push subscription."""
    deactivated = await PushNotificationService.unsubscribe(
        db=db,
        user_id=current_user.id,
        endpoint=body.endpoint,
    )
    await db.commit()
    return {"success": deactivated}


@router.get("/vapid-key", response_model=VapidPublicKeyResponse)
async def get_vapid_key() -> VapidPublicKeyResponse:
    """Return the VAPID public key for Web Push subscription.

    This is a public endpoint — no authentication required.
    """
    return VapidPublicKeyResponse(public_key=settings.vapid_public_key or "")
