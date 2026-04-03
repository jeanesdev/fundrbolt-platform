"""Checklist Pydantic schemas for request/response validation."""

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class ChecklistItemCreate(BaseModel):
    """Schema for creating a new checklist item."""

    title: Annotated[str, Field(min_length=1, max_length=200)]
    due_date: date | None = None


class ChecklistItemUpdate(BaseModel):
    """Schema for updating a checklist item."""

    title: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    due_date: date | None = None


class ChecklistItemStatusUpdate(BaseModel):
    """Schema for updating a checklist item's status."""

    status: Annotated[str, Field(pattern=r"^(not_complete|in_progress|complete)$")]


class ChecklistItemResponse(BaseModel):
    """Schema for checklist item response."""

    id: uuid.UUID
    event_id: uuid.UUID
    title: str
    due_date: date | None = None
    status: str
    display_order: int
    due_date_is_template_derived: bool
    offset_days: int | None = None
    completed_at: datetime | None = None
    is_overdue: bool = False
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChecklistResponse(BaseModel):
    """Schema for full checklist with progress info."""

    items: list[ChecklistItemResponse]
    total_count: int
    completed_count: int
    in_progress_count: int
    overdue_count: int
    progress_percentage: float


class ApplyTemplateRequest(BaseModel):
    """Schema for applying a template to an event checklist."""

    template_id: uuid.UUID
    mode: Annotated[str, Field(pattern=r"^(replace|append)$")] = "replace"


class SaveAsTemplateRequest(BaseModel):
    """Schema for saving event checklist as a template."""

    name: Annotated[str, Field(min_length=1, max_length=200)]


class ChecklistTemplateItemResponse(BaseModel):
    """Schema for template item response."""

    id: uuid.UUID
    title: str
    offset_days: int | None = None
    display_order: int

    model_config = ConfigDict(from_attributes=True)


class ChecklistTemplateResponse(BaseModel):
    """Schema for template list response (without items)."""

    id: uuid.UUID
    npo_id: uuid.UUID | None = None
    name: str
    is_default: bool
    is_system_default: bool
    item_count: int = 0
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChecklistTemplateDetailResponse(BaseModel):
    """Schema for template detail response (with items)."""

    id: uuid.UUID
    npo_id: uuid.UUID | None = None
    name: str
    is_default: bool
    is_system_default: bool
    items: list[ChecklistTemplateItemResponse]
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChecklistTemplateUpdate(BaseModel):
    """Schema for updating a template."""

    name: Annotated[str, Field(min_length=1, max_length=200)] | None = None


class ChecklistReorderRequest(BaseModel):
    """Schema for reordering checklist items."""

    item_ids: Annotated[list[uuid.UUID], Field(min_length=1)]
