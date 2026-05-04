"""Run-of-Show Pydantic schemas."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class RunOfShowItemCreate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=200)]
    description: str | None = None
    scheduled_time: datetime | None = None
    donor_visible: bool = False
    auctioneer_visible: bool = True
    display_order: int | None = None


class RunOfShowItemUpdate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    description: str | None = None
    scheduled_time: datetime | None = None
    donor_visible: bool | None = None
    auctioneer_visible: bool | None = None
    display_order: int | None = None


class RunOfShowItemResponse(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    title: str
    description: str | None = None
    scheduled_time: datetime | None = None
    donor_visible: bool
    auctioneer_visible: bool
    is_complete: bool
    completed_at: datetime | None = None
    display_order: int
    has_notification: bool = False
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RunOfShowResponse(BaseModel):
    items: list[RunOfShowItemResponse]
    total_count: int
    completed_count: int
    next_item: RunOfShowItemResponse | None = None
    event_start_time: datetime | None = None


class RunOfShowReorderRequest(BaseModel):
    item_ids: list[uuid.UUID]


class RunOfShowTemplateItemResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None = None
    offset_minutes: int
    donor_visible_default: bool
    auctioneer_visible_default: bool
    display_order: int
    model_config = ConfigDict(from_attributes=True)


class RunOfShowTemplateResponse(BaseModel):
    id: uuid.UUID
    npo_id: uuid.UUID | None = None
    name: str
    is_system_default: bool
    item_count: int = 0
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RunOfShowTemplateDetailResponse(BaseModel):
    id: uuid.UUID
    npo_id: uuid.UUID | None = None
    name: str
    is_system_default: bool
    items: list[RunOfShowTemplateItemResponse]
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RunOfShowTemplateItemCreate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=200)]
    description: str | None = None
    offset_minutes: Annotated[int, Field(ge=0)] = 0
    donor_visible_default: bool = True
    auctioneer_visible_default: bool = True
    display_order: int | None = None


class RunOfShowTemplateItemUpdate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    description: str | None = None
    offset_minutes: Annotated[int, Field(ge=0)] | None = None
    donor_visible_default: bool | None = None
    auctioneer_visible_default: bool | None = None
    display_order: int | None = None


class SaveAsTemplateRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=200)]


class ApplyTemplateRequest(BaseModel):
    template_id: uuid.UUID
    confirm_replace: bool = False


class ApplyTemplateResponse(BaseModel):
    replaced: bool
    items_created: int


class RosNotificationCreate(BaseModel):
    message_body: Annotated[str, Field(min_length=1)]
    recipient_type: str  # "donors", "auctioneer", "all_attendees"


class RosNotificationResponse(BaseModel):
    id: uuid.UUID
    ros_item_id: uuid.UUID
    message_body: str
    recipient_type: str
    scheduled_at: datetime
    delivery_status: str
    celery_task_id: str | None = None
    delivered_at: datetime | None = None
    failure_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
