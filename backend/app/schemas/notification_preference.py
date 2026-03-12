"""Pydantic schemas for notification preferences."""

import uuid

from pydantic import BaseModel, ConfigDict


class NotificationPreferenceResponse(BaseModel):
    """Schema for a single notification preference."""

    id: uuid.UUID
    notification_type: str
    channel: str
    enabled: bool

    model_config = ConfigDict(from_attributes=True)


class NotificationPreferenceListResponse(BaseModel):
    """Schema for list of notification preferences."""

    preferences: list[NotificationPreferenceResponse]


class NotificationPreferenceUpdate(BaseModel):
    """Schema for updating a single preference."""

    notification_type: str
    channel: str
    enabled: bool


class BulkPreferenceUpdateRequest(BaseModel):
    """Schema for bulk-updating preferences."""

    preferences: list[NotificationPreferenceUpdate]


class BulkPreferenceUpdateResponse(BaseModel):
    """Schema for bulk-update result."""

    updated_count: int
