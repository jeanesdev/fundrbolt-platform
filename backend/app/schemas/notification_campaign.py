"""Pydantic schemas for notification campaigns."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class RecipientCriteria(BaseModel):
    """Criteria for selecting campaign recipients."""

    type: str  # all_attendees, all_bidders, table, individual
    table_number: int | None = None
    user_ids: list[uuid.UUID] | None = None


class SendCustomNotificationRequest(BaseModel):
    """Schema for sending a custom notification campaign."""

    message: Annotated[str, Field(max_length=500)]
    recipient_criteria: RecipientCriteria
    channels: list[str]


class NotificationCampaignResponse(BaseModel):
    """Schema for a notification campaign."""

    id: uuid.UUID
    event_id: uuid.UUID
    sender_id: uuid.UUID
    message: str
    recipient_criteria: dict
    channels: list
    recipient_count: int
    delivered_count: int
    failed_count: int
    status: str
    sent_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CampaignListResponse(BaseModel):
    """Schema for paginated campaign list."""

    campaigns: list[NotificationCampaignResponse]
    total: int
