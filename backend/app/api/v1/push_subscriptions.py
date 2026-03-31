"""Push subscription API endpoints for Web Push notifications."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_active_user
from app.models.notification import (
    DeliveryChannelEnum,
    NotificationPriorityEnum,
    NotificationTypeEnum,
)
from app.models.user import User
from app.schemas.push_subscription import (
    PushSubscribeRequest,
    PushUnsubscribeRequest,
    VapidPublicKeyResponse,
)
from app.services.notification_service import NotificationService
from app.services.push_notification_service import PushNotificationService
from app.websocket.notification_ws import sio

router = APIRouter(prefix="/notifications/push", tags=["push-notifications"])
settings = get_settings()
logger = get_logger(__name__)


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


@router.post("/test")
async def send_test_notification(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """Send a test push + in-app notification to the current user.

    Requires the user to have an active event registration.
    Bypasses Celery to test push delivery directly.
    """
    from sqlalchemy import select

    from app.models.event_registration import EventRegistration

    # Find an event the user is registered for
    reg_result = await db.execute(
        select(EventRegistration.event_id)
        .where(EventRegistration.user_id == current_user.id)
        .limit(1)
    )
    event_row = reg_result.scalar_one_or_none()
    if not event_row:
        return {"error": "No event registration found for this user"}

    event_id = event_row

    # Create notification with both INAPP and PUSH channels
    notification = await NotificationService.create_notification(
        db=db,
        event_id=event_id,
        user_id=current_user.id,
        notification_type=NotificationTypeEnum.CUSTOM,
        priority=NotificationPriorityEnum.NORMAL,
        title="Test Notification",
        body="This is a test notification to verify push and in-app delivery.",
        data={"deep_link": None},
        sio=sio,
        override_channels=[DeliveryChannelEnum.INAPP, DeliveryChannelEnum.PUSH],
        dispatch_tasks=False,
    )
    await db.commit()

    # Send push directly (bypass Celery)
    push_result = False
    try:
        push_result = await PushNotificationService.send_push(db, notification.id)
        await db.commit()
    except Exception as e:
        logger.warning("Test push send failed", extra={"error": str(e)})
        await db.rollback()

    return {
        "notification_id": str(notification.id),
        "push_sent": push_result,
        "message": "Test notification sent. Check your device for push and in-app toast.",
    }
