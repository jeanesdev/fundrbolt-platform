"""Notification API endpoints for donors."""

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_active_user
from app.models.user import User
from app.schemas.notification import (
    MarkAllReadRequest,
    MarkAllReadResponse,
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.services.notification_service import NotificationService
from app.websocket.notification_ws import emit_notification, emit_unread_count

logger = get_logger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])

SUPER_ADMIN_ROLE = "super_admin"


@router.post("/debug-emit")
async def debug_emit_notification(
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """Temporary debug endpoint to test Socket.IO emission from within Uvicorn."""
    from app.websocket.notification_ws import sio

    user_id = str(current_user.id)
    event_id = "10adb96b-75b8-4a43-8a44-c593cb853e3c"
    room = f"user:{user_id}:event:{event_id}"

    # Debug: check what rooms/sids exist locally
    rooms_info: dict[str, object] = {}
    try:
        if hasattr(sio.manager, "rooms"):
            ns_rooms = sio.manager.rooms.get("/", {})
            rooms_info = {k: list(v) for k, v in ns_rooms.items()}
        logger.info("[DEBUG] rooms: %s", rooms_info)
    except Exception as e:
        logger.info("[DEBUG] rooms error: %s", e)
        rooms_info = {"error": str(e)}

    await emit_notification(
        user_id=user_id,
        event_id=event_id,
        notification_data={
            "id": str(uuid.uuid4()),
            "title": "Debug In-Process Toast",
            "body": "Emitted from within Uvicorn!",
            "notification_type": "custom",
            "created_at": "2026-03-31T18:28:00Z",
            "read": False,
        },
    )
    return {"status": "emitted", "room": room, "debug_rooms": rooms_info}


def _resolve_effective_user_id(
    current_user: User,
    spoof_user_id: str | None,
) -> uuid.UUID:
    """T065: Return spoofed user ID if requester is super_admin, else own ID."""
    if spoof_user_id and getattr(current_user, "role_name", None) == SUPER_ADMIN_ROLE:
        try:
            return uuid.UUID(spoof_user_id)
        except ValueError:
            logger.warning(
                "Invalid spoof user ID",
                extra={"spoof_user_id": spoof_user_id},
            )
    return current_user.id


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    event_id: uuid.UUID = Query(..., description="Event ID to scope notifications"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    cursor: str | None = Query(None, description="Cursor for pagination (ISO datetime)"),
    unread_only: bool = Query(False, description="Only return unread notifications"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    x_spoof_user_id: str | None = Header(None, alias="X-Spoof-User-Id"),
) -> NotificationListResponse:
    """List notifications for the current user in an event."""
    effective_id = _resolve_effective_user_id(current_user, x_spoof_user_id)
    notifications, next_cursor = await NotificationService.list_notifications(
        db=db,
        user_id=effective_id,
        event_id=event_id,
        limit=limit,
        cursor=cursor,
        unread_only=unread_only,
    )
    unread_count = await NotificationService.get_unread_count(
        db=db, user_id=effective_id, event_id=event_id
    )
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        next_cursor=next_cursor,
        unread_count=unread_count,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    event_id: uuid.UUID = Query(..., description="Event ID to scope count"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    x_spoof_user_id: str | None = Header(None, alias="X-Spoof-User-Id"),
) -> UnreadCountResponse:
    """Get unread notification count for the current user in an event."""
    effective_id = _resolve_effective_user_id(current_user, x_spoof_user_id)
    count = await NotificationService.get_unread_count(
        db=db, user_id=effective_id, event_id=event_id
    )
    return UnreadCountResponse(unread_count=count)


@router.post("/{notification_id}/read", status_code=status.HTTP_200_OK)
async def mark_notification_read(
    notification_id: uuid.UUID,
    event_id: uuid.UUID | None = Query(None, description="Event ID for count sync"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    x_spoof_user_id: str | None = Header(None, alias="X-Spoof-User-Id"),
) -> dict[str, bool]:
    """Mark a single notification as read."""
    effective_id = _resolve_effective_user_id(current_user, x_spoof_user_id)
    updated = await NotificationService.mark_read(
        db=db, notification_id=notification_id, user_id=effective_id
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or already read",
        )
    await db.commit()

    # Emit updated unread count to client via Socket.IO
    if event_id:
        unread = await NotificationService.get_unread_count(
            db=db, user_id=effective_id, event_id=event_id
        )
        await emit_unread_count(str(effective_id), str(event_id), unread)

    return {"success": True}


@router.post("/read-all", response_model=MarkAllReadResponse)
async def mark_all_notifications_read(
    body: MarkAllReadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    x_spoof_user_id: str | None = Header(None, alias="X-Spoof-User-Id"),
) -> MarkAllReadResponse:
    """Mark all notifications as read for the current user in an event."""
    effective_id = _resolve_effective_user_id(current_user, x_spoof_user_id)
    updated_count = await NotificationService.mark_all_read(
        db=db, user_id=effective_id, event_id=body.event_id
    )
    await db.commit()

    # Emit updated unread count (should be 0 after mark-all-read)
    await emit_unread_count(str(effective_id), str(body.event_id), 0)

    return MarkAllReadResponse(updated_count=updated_count)
