"""Pydantic schemas for notifications."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    """Schema for a single notification."""

    id: uuid.UUID
    event_id: uuid.UUID
    user_id: uuid.UUID
    notification_type: str
    title: str
    body: str
    priority: str
    data: dict | None = None
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list."""

    notifications: list[NotificationResponse]
    next_cursor: str | None = None
    unread_count: int


class UnreadCountResponse(BaseModel):
    """Schema for unread notification count."""

    unread_count: int


class MarkAllReadRequest(BaseModel):
    """Schema for marking all notifications read for an event."""

    event_id: uuid.UUID


class MarkAllReadResponse(BaseModel):
    """Schema for mark-all-read result."""

    updated_count: int
