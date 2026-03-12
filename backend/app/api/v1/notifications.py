"""Notification API endpoints for donors."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
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

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    event_id: uuid.UUID = Query(..., description="Event ID to scope notifications"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    cursor: str | None = Query(None, description="Cursor for pagination (ISO datetime)"),
    unread_only: bool = Query(False, description="Only return unread notifications"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> NotificationListResponse:
    """List notifications for the current user in an event."""
    notifications, next_cursor = await NotificationService.list_notifications(
        db=db,
        user_id=current_user.id,
        event_id=event_id,
        limit=limit,
        cursor=cursor,
        unread_only=unread_only,
    )
    unread_count = await NotificationService.get_unread_count(
        db=db, user_id=current_user.id, event_id=event_id
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
) -> UnreadCountResponse:
    """Get unread notification count for the current user in an event."""
    count = await NotificationService.get_unread_count(
        db=db, user_id=current_user.id, event_id=event_id
    )
    return UnreadCountResponse(unread_count=count)


@router.post("/{notification_id}/read", status_code=status.HTTP_200_OK)
async def mark_notification_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, bool]:
    """Mark a single notification as read."""
    updated = await NotificationService.mark_read(
        db=db, notification_id=notification_id, user_id=current_user.id
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or already read",
        )
    await db.commit()
    return {"success": True}


@router.post("/read-all", response_model=MarkAllReadResponse)
async def mark_all_notifications_read(
    body: MarkAllReadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MarkAllReadResponse:
    """Mark all notifications as read for the current user in an event."""
    updated_count = await NotificationService.mark_all_read(
        db=db, user_id=current_user.id, event_id=body.event_id
    )
    await db.commit()
    return MarkAllReadResponse(updated_count=updated_count)
