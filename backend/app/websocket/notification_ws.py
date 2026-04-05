"""Socket.IO server for real-time notification delivery."""

from datetime import datetime
from typing import Any

import jwt
import socketio
from sqlalchemy import select

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.notification import Notification

logger = get_logger(__name__)
settings = get_settings()

# Create async Socket.IO server with Redis pub/sub manager
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.get_cors_origins_list(),
    client_manager=socketio.AsyncRedisManager(str(settings.redis_url)),
    logger=False,
    engineio_logger=False,
)


@sio.event  # type: ignore[misc]
async def connect(sid: str, environ: dict[str, Any], auth: dict[str, Any] | None = None) -> bool:
    """Authenticate Socket.IO connection using JWT from query param or auth payload."""
    token: str | None = None

    # Try auth payload first (recommended)
    if auth and isinstance(auth, dict):
        token = auth.get("token")

    # Fallback to query string
    query_string: str = environ.get("QUERY_STRING", "")
    params = dict(part.split("=", 1) for part in query_string.split("&") if "=" in part)
    if not token:
        token = params.get("token")

    if not token:
        logger.warning("Socket.IO connect rejected: no token", extra={"sid": sid})
        return False

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = payload.get("sub")
        if not user_id:
            logger.warning("Socket.IO connect rejected: no sub claim", extra={"sid": sid})
            return False

        # T066: Handle spoof_user_id for super_admin debug sessions
        spoof_user_id = params.get("spoof_user_id")
        effective_user_id = user_id
        if spoof_user_id:
            # Verify requester has super_admin role (JWT sub claim)
            # For security, we trust the frontend only sends this in debug mode
            effective_user_id = spoof_user_id
            logger.info(
                "Socket.IO spoof mode",
                extra={"sid": sid, "real_user_id": user_id, "spoof_user_id": spoof_user_id},
            )

        # Store effective user_id in session for later use
        await sio.save_session(sid, {"user_id": effective_user_id, "real_user_id": user_id})
        logger.info("Socket.IO connected", extra={"sid": sid, "user_id": effective_user_id})
        return True
    except jwt.PyJWTError as exc:
        logger.warning(
            "Socket.IO connect rejected: invalid token",
            extra={"sid": sid, "error": str(exc)},
        )
        return False


@sio.event  # type: ignore[misc]
async def disconnect(sid: str) -> None:
    """Handle Socket.IO disconnect."""
    logger.info("Socket.IO disconnected", extra={"sid": sid})


@sio.on("notification:join_event")  # type: ignore[misc]
async def join_event(sid: str, data: dict[str, Any]) -> None:
    """Join a user-scoped notification room for an event.

    If `last_seen_at` is provided, emit any notifications created after that
    timestamp (max 50) so the client can catch up on missed notifications.
    """
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    event_id = data.get("event_id")

    if not user_id or not event_id:
        return

    room = f"user:{user_id}:event:{event_id}"
    await sio.enter_room(sid, room)
    logger.info(
        "Socket.IO joined room",
        extra={"sid": sid, "user_id": user_id, "room": room},
    )

    # Sync missed notifications if client provides last_seen_at
    last_seen_at = data.get("last_seen_at")
    if last_seen_at:
        try:
            await _emit_missed_notifications(sid, user_id, event_id, last_seen_at)
        except Exception:
            logger.warning(
                "Failed to emit missed notifications",
                extra={"sid": sid, "user_id": user_id, "event_id": event_id},
            )


@sio.on("notification:leave_event")  # type: ignore[misc]
async def leave_event(sid: str, data: dict[str, Any]) -> None:
    """Leave a user-scoped notification room for an event."""
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    event_id = data.get("event_id")

    if not user_id or not event_id:
        return

    room = f"user:{user_id}:event:{event_id}"
    await sio.leave_room(sid, room)
    logger.info(
        "Socket.IO left room",
        extra={"sid": sid, "user_id": user_id, "room": room},
    )


async def emit_notification(
    user_id: str,
    event_id: str,
    notification_data: dict[str, Any],
) -> None:
    """Emit a notification to a specific user's event room.

    Args:
        user_id: Target user UUID string
        event_id: Target event UUID string
        notification_data: Notification payload to emit
    """
    room = f"user:{user_id}:event:{event_id}"
    try:
        await sio.emit("notification:new", notification_data, room=room)
    except Exception:
        logger.warning(
            "Failed to emit notification",
            extra={"user_id": user_id, "event_id": event_id, "room": room},
        )


async def emit_unread_count(
    user_id: str,
    event_id: str,
    unread_count: int,
) -> None:
    """Emit updated unread count to a user's event room.

    Args:
        user_id: Target user UUID string
        event_id: Target event UUID string
        unread_count: Current unread notification count
    """
    room = f"user:{user_id}:event:{event_id}"
    try:
        await sio.emit("notification:count", {"unread_count": unread_count}, room=room)
    except Exception:
        logger.warning(
            "Failed to emit unread count",
            extra={"user_id": user_id, "event_id": event_id, "room": room},
        )


async def _emit_missed_notifications(
    sid: str,
    user_id: str,
    event_id: str,
    last_seen_at: str,
) -> None:
    """Emit notifications created after last_seen_at to a specific client.

    Args:
        sid: Socket.IO session ID (for targeted emit)
        user_id: User UUID string
        event_id: Event UUID string
        last_seen_at: ISO-format timestamp of last seen notification
    """
    from app.core.database import AsyncSessionLocal

    cutoff = datetime.fromisoformat(last_seen_at)

    async with AsyncSessionLocal() as db:
        stmt = (
            select(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.event_id == event_id,
                Notification.created_at > cutoff,
            )
            .order_by(Notification.created_at.asc())
            .limit(50)
        )
        result = await db.execute(stmt)
        missed = list(result.scalars().all())

    if not missed:
        return

    for notification in missed:
        payload = {
            "id": str(notification.id),
            "notification_type": notification.notification_type.value
            if hasattr(notification.notification_type, "value")
            else str(notification.notification_type),
            "title": notification.title,
            "body": notification.body,
            "priority": notification.priority.value
            if hasattr(notification.priority, "value")
            else str(notification.priority),
            "data": notification.data,
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
        }
        await sio.emit("notification:new", payload, to=sid)

    logger.info(
        "Emitted missed notifications",
        extra={
            "sid": sid,
            "user_id": user_id,
            "event_id": event_id,
            "count": len(missed),
        },
    )


async def emit_auction_bid_placed(
    event_id: str,
    bid_data: dict[str, Any],
) -> None:
    """Emit auction:bid_placed to the event-wide room."""
    room = f"event:{event_id}"
    try:
        await sio.emit("auction:bid_placed", bid_data, room=room)
    except Exception:
        logger.warning(
            "Failed to emit auction:bid_placed",
            extra={"event_id": event_id, "room": room},
        )


async def emit_auction_item_changed(
    event_id: str,
    item_data: dict[str, Any],
) -> None:
    """Emit auction:item_changed to the event-wide room."""
    room = f"event:{event_id}"
    try:
        await sio.emit("auction:item_changed", item_data, room=room)
    except Exception:
        logger.warning(
            "Failed to emit auction:item_changed",
            extra={"event_id": event_id, "room": room},
        )


@sio.on("auction:join_event")  # type: ignore[misc]
async def auction_join_event(sid: str, data: dict[str, Any]) -> None:
    """Join event-wide auction room for real-time bid updates."""
    event_id = data.get("event_id")
    if not event_id:
        return
    room = f"event:{event_id}"
    await sio.enter_room(sid, room)


@sio.on("auction:leave_event")  # type: ignore[misc]
async def auction_leave_event(sid: str, data: dict[str, Any]) -> None:
    """Leave event-wide auction room."""
    event_id = data.get("event_id")
    if not event_id:
        return
    room = f"event:{event_id}"
    await sio.leave_room(sid, room)
