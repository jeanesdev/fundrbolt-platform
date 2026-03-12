"""Socket.IO server for real-time notification delivery."""

from typing import Any

import jwt
import socketio

from app.core.config import get_settings
from app.core.logging import get_logger

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


@sio.event
async def connect(sid: str, environ: dict[str, Any], auth: dict[str, Any] | None = None) -> bool:
    """Authenticate Socket.IO connection using JWT from query param or auth payload."""
    token: str | None = None

    # Try auth payload first (recommended)
    if auth and isinstance(auth, dict):
        token = auth.get("token")

    # Fallback to query string
    if not token:
        query_string: str = environ.get("QUERY_STRING", "")
        params = dict(part.split("=", 1) for part in query_string.split("&") if "=" in part)
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

        # Store user_id in session for later use
        await sio.save_session(sid, {"user_id": user_id})
        logger.info("Socket.IO connected", extra={"sid": sid, "user_id": user_id})
        return True
    except jwt.PyJWTError as exc:
        logger.warning(
            "Socket.IO connect rejected: invalid token",
            extra={"sid": sid, "error": str(exc)},
        )
        return False


@sio.event
async def disconnect(sid: str) -> None:
    """Handle Socket.IO disconnect."""
    logger.info("Socket.IO disconnected", extra={"sid": sid})


@sio.on("notification:join_event")
async def join_event(sid: str, data: dict[str, Any]) -> None:
    """Join a user-scoped notification room for an event."""
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    event_id = data.get("event_id")

    if not user_id or not event_id:
        return

    room = f"user:{user_id}:event:{event_id}"
    sio.enter_room(sid, room)
    logger.info(
        "Socket.IO joined room",
        extra={"sid": sid, "user_id": user_id, "room": room},
    )


@sio.on("notification:leave_event")
async def leave_event(sid: str, data: dict[str, Any]) -> None:
    """Leave a user-scoped notification room for an event."""
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    event_id = data.get("event_id")

    if not user_id or not event_id:
        return

    room = f"user:{user_id}:event:{event_id}"
    sio.leave_room(sid, room)
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
