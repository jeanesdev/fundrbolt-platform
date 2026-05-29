"""Web Push notification service.

Manages push subscriptions and sends push notifications via the Web Push protocol.
"""

import base64
import json
import re
import uuid
from datetime import UTC, datetime, timedelta

from azure.storage.blob import BlobSasPermissions, generate_blob_sas
from pywebpush import WebPushException, webpush
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.event import Event
from app.models.notification import DeliveryChannelEnum, DeliveryStatusEnum, Notification
from app.models.notification_delivery_status import NotificationDeliveryStatus
from app.models.push_subscription import PushSubscription

logger = get_logger(__name__)
settings = get_settings()

_URL_PATTERN = re.compile(r"https?://[^\s)]+", re.IGNORECASE)


def _sanitize_push_body(body: str) -> str:
    stripped = _URL_PATTERN.sub("", body).strip()
    stripped = re.sub(r"\s+", " ", stripped)
    stripped = stripped.rstrip("-: ")
    return stripped or "Tap to view details"


def _ensure_blob_sas_url(url: str | None) -> str | None:
    """Return a read-SAS URL for Azure blob URLs when needed."""
    if not url:
        return None

    if (
        not settings.azure_storage_connection_string
        or not settings.azure_storage_account_name
        or not settings.azure_storage_container_name
    ):
        return url

    account_host = f"{settings.azure_storage_account_name}.blob.core.windows.net"
    if account_host not in url:
        return url

    if "?" in url and "sig=" in url:
        return url

    container_prefix = f"{settings.azure_storage_container_name}/"
    if container_prefix not in url:
        return url

    blob_name = url.split(container_prefix, 1)[1].split("?", 1)[0]

    try:
        conn_str = settings.azure_storage_connection_string
        account_key = conn_str.split("AccountKey=")[1].split(";")[0]
        sas_token = generate_blob_sas(
            account_name=settings.azure_storage_account_name,
            container_name=settings.azure_storage_container_name,
            blob_name=blob_name,
            account_key=account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(hours=24),
        )
        return (
            f"https://{account_host}/{settings.azure_storage_container_name}"
            f"/{blob_name}?{sas_token}"
        )
    except Exception:
        logger.debug("Failed to generate push icon SAS URL", exc_info=True)
        return url


def _get_vapid_private_key_raw() -> str | None:
    """Extract raw base64url-encoded VAPID private key.

    pywebpush expects a raw 32-byte EC private key in base64url encoding,
    but the key may be stored in PEM format. Detect and convert as needed.
    """
    key = settings.vapid_private_key
    if not key:
        return None

    if key.strip().startswith("-----BEGIN"):
        from cryptography.hazmat.primitives.serialization import load_pem_private_key

        # Handle escaped newlines from env vars (\\n → \n)
        pem_str = key.replace("\\n", "\n")
        try:
            pem_key = load_pem_private_key(pem_str.encode(), password=None)
            # Extract the raw 32-byte private scalar from the EC key
            private_numbers = pem_key.private_numbers()  # type: ignore[union-attr]
            raw_bytes = private_numbers.private_value.to_bytes(32, byteorder="big")  # type: ignore[union-attr]
            return base64.urlsafe_b64encode(raw_bytes).rstrip(b"=").decode()
        except Exception as exc:
            logger.warning(
                "Failed to parse VAPID private key from PEM; push notifications disabled.",
                extra={"error": str(exc)},
            )
            return None

    return key


class PushNotificationService:
    """Service for Web Push subscription management and delivery."""

    @staticmethod
    async def subscribe(
        db: AsyncSession,
        user_id: uuid.UUID,
        endpoint: str,
        p256dh_key: str,
        auth_key: str,
        platform: str | None = None,
        user_agent: str | None = None,
    ) -> PushSubscription:
        """Register a push subscription for a user.

        If the endpoint already exists (possibly deactivated), reactivate it.

        Args:
            db: Async database session
            user_id: User UUID
            endpoint: Push subscription endpoint URL
            p256dh_key: P-256 Diffie-Hellman public key
            auth_key: Authentication secret
            platform: Optional platform identifier (web, android, ios)
            user_agent: Optional user agent string

        Returns:
            The created or reactivated PushSubscription.
        """
        # Check for existing subscription with this endpoint
        existing_stmt = select(PushSubscription).where(PushSubscription.endpoint == endpoint)
        existing_result = await db.execute(existing_stmt)
        existing = existing_result.scalar_one_or_none()

        if existing:
            # Reactivate and update keys
            existing.user_id = user_id
            existing.p256dh_key = p256dh_key
            existing.auth_key = auth_key
            existing.platform = platform
            existing.user_agent = user_agent
            existing.is_active = True
            existing.deactivated_at = None
            existing.deactivation_reason = None
            await db.flush()
            logger.info(
                "Reactivated push subscription",
                extra={"user_id": str(user_id), "endpoint_prefix": endpoint[:50]},
            )
            return existing

        subscription = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh_key=p256dh_key,
            auth_key=auth_key,
            platform=platform,
            user_agent=user_agent,
        )
        db.add(subscription)
        await db.flush()

        logger.info(
            "Created push subscription",
            extra={"user_id": str(user_id), "subscription_id": str(subscription.id)},
        )
        return subscription

    @staticmethod
    async def unsubscribe(
        db: AsyncSession,
        user_id: uuid.UUID,
        endpoint: str,
    ) -> bool:
        """Deactivate a push subscription.

        Args:
            db: Async database session
            user_id: User UUID
            endpoint: Push subscription endpoint to deactivate

        Returns:
            True if a subscription was deactivated.
        """
        stmt = (
            update(PushSubscription)
            .where(
                PushSubscription.user_id == user_id,
                PushSubscription.endpoint == endpoint,
                PushSubscription.is_active.is_(True),
            )
            .values(
                is_active=False,
                deactivated_at=datetime.now(UTC),
                deactivation_reason="user_unsubscribed",
            )
        )
        result = await db.execute(stmt)
        await db.flush()
        deactivated = (result.rowcount or 0) > 0  # type: ignore[attr-defined]

        if deactivated:
            logger.info(
                "Deactivated push subscription",
                extra={"user_id": str(user_id)},
            )
        return deactivated

    @staticmethod
    async def send_push(
        db: AsyncSession,
        notification_id: uuid.UUID,
    ) -> bool:
        """Send push notification to all active subscriptions for a notification's user.

        Args:
            db: Async database session
            notification_id: Notification UUID to send

        Returns:
            True if at least one push was sent successfully.
        """
        if not settings.vapid_private_key or not settings.vapid_public_key:
            logger.warning("VAPID keys not configured, skipping push notification")
            return False

        vapid_key = _get_vapid_private_key_raw()
        if not vapid_key:
            logger.warning("Could not extract VAPID private key, skipping push notification")
            return False

        # Load notification
        notif_stmt = select(Notification).where(Notification.id == notification_id)
        notif_result = await db.execute(notif_stmt)
        notification = notif_result.scalar_one_or_none()

        if not notification:
            logger.warning(
                "Notification not found for push delivery",
                extra={"notification_id": str(notification_id)},
            )
            return False

        # T067: Skip push delivery if notification was triggered in spoof context
        if notification.data and notification.data.get("_spoof_context"):
            logger.info(
                "Skipping push for spoof context notification",
                extra={"notification_id": str(notification_id)},
            )
            # Mark as skipped
            delivery_stmt = select(NotificationDeliveryStatus).where(
                NotificationDeliveryStatus.notification_id == notification_id,
                NotificationDeliveryStatus.channel == DeliveryChannelEnum.PUSH,
            )
            delivery_result = await db.execute(delivery_stmt)
            delivery = delivery_result.scalar_one_or_none()
            if delivery:
                delivery.status = DeliveryStatusEnum.SKIPPED
                delivery.failure_reason = "spoof_context"
                await db.commit()
            return False

        # Get active subscriptions for user
        sub_stmt = select(PushSubscription).where(
            PushSubscription.user_id == notification.user_id,
            PushSubscription.is_active.is_(True),
        )
        sub_result = await db.execute(sub_stmt)
        subscriptions = list(sub_result.scalars().all())

        if not subscriptions:
            logger.debug(
                "No active push subscriptions for user",
                extra={"user_id": str(notification.user_id)},
            )
            # Mark delivery as skipped so it doesn't stay pending forever
            update_delivery_stmt = (
                update(NotificationDeliveryStatus)
                .where(
                    NotificationDeliveryStatus.notification_id == notification_id,
                    NotificationDeliveryStatus.channel == DeliveryChannelEnum.PUSH,
                )
                .values(
                    status=DeliveryStatusEnum.SKIPPED,
                    failure_reason="no_active_subscriptions",
                )
            )
            await db.execute(update_delivery_stmt)
            await db.commit()
            return False

        # Build push payload
        deep_link = None
        image_url: str | None = None
        if notification.data and isinstance(notification.data, dict):
            deep_link = notification.data.get("deep_link")
            image_url = notification.data.get("image_url")

        image_url = _ensure_blob_sas_url(image_url)

        # Use event logo when no item image is available.
        event_icon_url: str | None = None
        if notification.event_id:
            event_logo_result = await db.execute(
                select(Event.logo_url).where(Event.id == notification.event_id)
            )
            event_logo = event_logo_result.scalar_one_or_none()
            if event_logo:
                event_icon_url = _ensure_blob_sas_url(event_logo)

        # Icon priority: item thumbnail -> event icon -> app logo fallback
        icon_url = image_url or event_icon_url or "/images/pwa-192x192.png"

        payload = json.dumps(
            {
                "title": notification.title,
                "body": _sanitize_push_body(notification.body),
                "icon": icon_url,
                "badge": "/images/pwa-192x192.png",
                "image": image_url,
                "data": {
                    "deep_link": deep_link,
                    "image_url": image_url,
                    "notification_id": str(notification.id),
                    "notification_type": notification.notification_type.value
                    if hasattr(notification.notification_type, "value")
                    else str(notification.notification_type),
                },
            }
        )

        any_success = False

        for subscription in subscriptions:
            try:
                endpoint_domain = subscription.endpoint.split("/")[2]
            except IndexError:
                endpoint_domain = "unknown"
            logger.info(
                "Sending push to subscription",
                extra={
                    "subscription_id": str(subscription.id),
                    "endpoint_domain": endpoint_domain,
                    "notification_id": str(notification_id),
                },
            )
            try:
                # Fresh claims dict per subscription — pywebpush mutates it
                # (sets 'aud' from the endpoint URL), so reusing a single dict
                # causes subsequent calls to different push services (e.g.
                # Apple after FCM) to send a JWT with the wrong audience.
                vapid_claims = {"sub": settings.vapid_claims_email}
                resp = webpush(
                    subscription_info={
                        "endpoint": subscription.endpoint,
                        "keys": {
                            "p256dh": subscription.p256dh_key,
                            "auth": subscription.auth_key,
                        },
                    },
                    data=payload,
                    vapid_private_key=vapid_key,
                    vapid_claims=vapid_claims,
                    headers={
                        "TTL": "86400",
                        "Urgency": "high",
                    },
                )
                resp_status = resp.status_code if resp else "no-response"
                logger.info(
                    "Push sent successfully",
                    extra={
                        "subscription_id": str(subscription.id),
                        "endpoint_domain": endpoint_domain,
                        "status_code": resp_status,
                    },
                )
                any_success = True
            except WebPushException as e:
                response = getattr(e, "response", None)
                status_code = response.status_code if response else None

                if status_code == 410:
                    # Subscription expired/unsubscribed — deactivate
                    subscription.is_active = False
                    subscription.deactivated_at = datetime.now(UTC)
                    subscription.deactivation_reason = "endpoint_gone_410"
                    logger.info(
                        "Deactivated expired push subscription (410 Gone)",
                        extra={"subscription_id": str(subscription.id)},
                    )
                else:
                    logger.warning(
                        "Push notification delivery failed",
                        extra={
                            "subscription_id": str(subscription.id),
                            "status_code": status_code,
                            "error": str(e),
                        },
                    )
            except Exception:
                logger.exception(
                    "Unexpected error sending push notification",
                    extra={"subscription_id": str(subscription.id)},
                )

        # Update delivery status for PUSH channel
        delivery_status = DeliveryStatusEnum.SENT if any_success else DeliveryStatusEnum.FAILED
        update_delivery_stmt = (
            update(NotificationDeliveryStatus)
            .where(
                NotificationDeliveryStatus.notification_id == notification_id,
                NotificationDeliveryStatus.channel == DeliveryChannelEnum.PUSH,
            )
            .values(
                status=delivery_status,
                sent_at=datetime.now(UTC) if any_success else None,
                failure_reason=None if any_success else "all_subscriptions_failed",
            )
        )
        await db.execute(update_delivery_stmt)
        await db.flush()

        logger.info(
            "Push notification delivery complete",
            extra={
                "notification_id": str(notification_id),
                "success": any_success,
                "subscription_count": len(subscriptions),
            },
        )
        return any_success
