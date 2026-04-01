"""Push subscription API endpoints for Web Push notifications."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
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
from app.models.push_subscription import PushSubscription
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


@router.post("/beacon")
async def push_beacon(request: Request) -> dict[str, str]:
    """Diagnostic: SW sends this when a push event fires.

    No auth required — the SW may not have a token.
    """
    source = request.query_params.get("source", "unknown")
    ua = request.headers.get("user-agent", "")[:80]
    logger.warning(
        "PUSH_BEACON received — push event fired in SW",
        extra={
            "source": source,
            "user_agent": ua,
            "client_ip": request.client.host if request.client else None,
        },
    )
    return {"ok": "beacon received"}


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


@router.post("/test-raw")
async def send_test_raw_push(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """Send a minimal raw push to every active subscription and return per-sub results.

    For debugging push delivery issues — bypasses notification system entirely.
    """
    import json

    from pywebpush import WebPushException, webpush

    from app.services.push_notification_service import _get_vapid_private_key_raw

    vapid_key = _get_vapid_private_key_raw()
    if not vapid_key:
        return {"error": "VAPID key not configured"}

    subs_result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == current_user.id,
            PushSubscription.is_active.is_(True),
        )
    )
    subscriptions = list(subs_result.scalars().all())

    payload = json.dumps(
        {
            "title": "Raw Push Test",
            "body": f"Direct push to {len(subscriptions)} subscription(s)",
        }
    )

    results = []
    for sub in subscriptions:
        endpoint_domain = sub.endpoint.split("/")[2] if "/" in sub.endpoint else "unknown"
        entry: dict[str, object] = {
            "id": str(sub.id),
            "endpoint_domain": endpoint_domain,
            "platform": sub.platform,
            "user_agent_short": (sub.user_agent or "")[:40],
        }
        try:
            resp = webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh_key, "auth": sub.auth_key},
                },
                data=payload,
                vapid_private_key=vapid_key,
                vapid_claims={"sub": settings.vapid_claims_email},
                headers={"TTL": "86400", "Urgency": "high"},
            )
            entry["status"] = resp.status_code if resp else "no-response"
            entry["success"] = True
        except WebPushException as e:
            resp_obj = getattr(e, "response", None)
            entry["status"] = resp_obj.status_code if resp_obj else None
            entry["error"] = str(e)[:200]
            entry["success"] = False
        except Exception as e:
            entry["status"] = None
            entry["error"] = str(e)[:200]
            entry["success"] = False
        results.append(entry)

    return {"subscriptions_count": len(subscriptions), "results": results}
