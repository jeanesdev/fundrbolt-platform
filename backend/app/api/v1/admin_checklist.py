"""Admin API endpoints for event planning checklist management."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.checklist import (
    ApplyTemplateRequest,
    ChecklistItemCreate,
    ChecklistItemResponse,
    ChecklistItemStatusUpdate,
    ChecklistItemUpdate,
    ChecklistReorderRequest,
    ChecklistResponse,
    ChecklistTemplateDetailResponse,
    ChecklistTemplateResponse,
    ChecklistTemplateUpdate,
    SaveAsTemplateRequest,
)
from app.services.checklist_service import ChecklistService
from app.services.permission_service import PermissionService

router = APIRouter(tags=["admin-checklist"])


async def _require_event_access(
    db: AsyncSession,
    current_user: User,
    event_id: uuid.UUID,
) -> None:
    """Verify user has access to the event's NPO."""
    from sqlalchemy import select

    from app.models.event import Event

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    if current_user.role_name == "super_admin":  # type: ignore[attr-defined]
        return

    permission_service = PermissionService()
    if not await permission_service.can_view_event(current_user, event.npo_id, db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this event's checklist",
        )


async def _require_npo_access(
    db: AsyncSession,
    current_user: User,
    npo_id: uuid.UUID,
) -> None:
    """Verify user has access to the NPO."""
    if current_user.role_name == "super_admin":  # type: ignore[attr-defined]
        return

    permission_service = PermissionService()
    if not await permission_service.can_view_event(current_user, npo_id, db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this organization's templates",
        )


# ─── Event Checklist Endpoints ───────────────────────────────────────────────


@router.get(
    "/admin/events/{event_id}/checklist",
    response_model=ChecklistResponse,
)
async def get_event_checklist(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChecklistResponse:
    """Get all checklist items for an event with progress summary."""
    await _require_event_access(db, current_user, event_id)
    return await ChecklistService.get_event_checklist(db, event_id)


@router.post(
    "/admin/events/{event_id}/checklist",
    response_model=ChecklistItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_checklist_item(
    event_id: uuid.UUID,
    data: ChecklistItemCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChecklistItemResponse:
    """Create a new checklist item for an event."""
    await _require_event_access(db, current_user, event_id)
    item = await ChecklistService.create_item(db, event_id, data, current_user)
    return ChecklistService.item_to_response(item)


# Static paths must come before parameterized {item_id} paths
@router.patch(
    "/admin/events/{event_id}/checklist/reorder",
    response_model=ChecklistResponse,
)
async def reorder_checklist_items(
    event_id: uuid.UUID,
    data: ChecklistReorderRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChecklistResponse:
    """Reorder checklist items by providing ordered list of item IDs."""
    await _require_event_access(db, current_user, event_id)
    await ChecklistService.reorder_items(db, event_id, data.item_ids)
    return await ChecklistService.get_event_checklist(db, event_id)


@router.post(
    "/admin/events/{event_id}/checklist/apply-template",
    response_model=ChecklistResponse,
)
async def apply_template_to_checklist(
    event_id: uuid.UUID,
    data: ApplyTemplateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChecklistResponse:
    """Apply a template to the event checklist (replace or append mode)."""
    await _require_event_access(db, current_user, event_id)
    await ChecklistService.apply_template(db, event_id, data.template_id, data.mode, current_user)
    return await ChecklistService.get_event_checklist(db, event_id)


@router.post(
    "/admin/events/{event_id}/checklist/save-as-template",
    response_model=ChecklistTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def save_checklist_as_template(
    event_id: uuid.UUID,
    data: SaveAsTemplateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChecklistTemplateResponse:
    """Save the current event checklist as a reusable template."""
    await _require_event_access(db, current_user, event_id)
    template = await ChecklistService.save_as_template(db, event_id, data.name, current_user)
    return ChecklistService.template_to_response(template)


# Parameterized {item_id} paths after static paths
@router.patch(
    "/admin/events/{event_id}/checklist/{item_id}",
    response_model=ChecklistItemResponse,
)
async def update_checklist_item(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ChecklistItemUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChecklistItemResponse:
    """Update a checklist item's title or due date."""
    await _require_event_access(db, current_user, event_id)
    item = await ChecklistService.update_item(db, event_id, item_id, data)
    return ChecklistService.item_to_response(item)


@router.patch(
    "/admin/events/{event_id}/checklist/{item_id}/status",
    response_model=ChecklistItemResponse,
)
async def update_checklist_item_status(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ChecklistItemStatusUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChecklistItemResponse:
    """Update a checklist item's status (not_complete, in_progress, complete)."""
    await _require_event_access(db, current_user, event_id)
    item = await ChecklistService.update_item_status(db, event_id, item_id, data)
    return ChecklistService.item_to_response(item)


@router.delete(
    "/admin/events/{event_id}/checklist/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_checklist_item(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a checklist item."""
    await _require_event_access(db, current_user, event_id)
    await ChecklistService.delete_item(db, event_id, item_id)


# ─── NPO Template Endpoints ─────────────────────────────────────────────────


@router.get(
    "/admin/npos/{npo_id}/checklist-templates",
    response_model=list[ChecklistTemplateResponse],
)
async def list_npo_templates(
    npo_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ChecklistTemplateResponse]:
    """List all checklist templates for an NPO (including system defaults)."""
    await _require_npo_access(db, current_user, npo_id)
    return await ChecklistService.list_templates(db, npo_id)


@router.get(
    "/admin/npos/{npo_id}/checklist-templates/{template_id}",
    response_model=ChecklistTemplateDetailResponse,
)
async def get_npo_template(
    npo_id: uuid.UUID,
    template_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChecklistTemplateDetailResponse:
    """Get a checklist template with all its items."""
    await _require_npo_access(db, current_user, npo_id)
    return await ChecklistService.get_template(db, npo_id, template_id)


@router.patch(
    "/admin/npos/{npo_id}/checklist-templates/{template_id}",
    response_model=ChecklistTemplateResponse,
)
async def update_npo_template(
    npo_id: uuid.UUID,
    template_id: uuid.UUID,
    data: ChecklistTemplateUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChecklistTemplateResponse:
    """Update a checklist template's name."""
    await _require_npo_access(db, current_user, npo_id)
    template = await ChecklistService.update_template(db, npo_id, template_id, data)
    return ChecklistService.template_to_response(template)


@router.delete(
    "/admin/npos/{npo_id}/checklist-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_npo_template(
    npo_id: uuid.UUID,
    template_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a checklist template (cannot delete system default)."""
    await _require_npo_access(db, current_user, npo_id)
    await ChecklistService.delete_template(db, npo_id, template_id)


@router.post(
    "/admin/npos/{npo_id}/checklist-templates/{template_id}/set-default",
    response_model=ChecklistTemplateResponse,
)
async def set_default_template(
    npo_id: uuid.UUID,
    template_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChecklistTemplateResponse:
    """Set a template as the NPO's default (unsets any previous default)."""
    await _require_npo_access(db, current_user, npo_id)
    template = await ChecklistService.set_default_template(db, npo_id, template_id)
    return ChecklistService.template_to_response(template)
