"""Admin API endpoints for run-of-show management."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.run_of_show import (
    ApplyTemplateRequest,
    ApplyTemplateResponse,
    RosNotificationCreate,
    RosNotificationResponse,
    RunOfShowItemCreate,
    RunOfShowItemResponse,
    RunOfShowItemUpdate,
    RunOfShowReorderRequest,
    RunOfShowResponse,
    RunOfShowTemplateDetailResponse,
    RunOfShowTemplateItemCreate,
    RunOfShowTemplateItemResponse,
    RunOfShowTemplateItemUpdate,
    RunOfShowTemplateResponse,
    SaveAsTemplateRequest,
)
from app.services.permission_service import PermissionService
from app.services.run_of_show_notification_service import (
    RunOfShowNotificationService,
)
from app.services.run_of_show_service import RunOfShowService

router = APIRouter(tags=["admin-run-of-show"])


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
            detail="You do not have permission to manage this event's run-of-show",
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
            detail="You do not have permission to manage this organization's run-of-show templates",
        )


# ─── Event Run-of-Show Endpoints ─────────────────────────────────────────────


@router.get(
    "/admin/events/{event_id}/run-of-show",
    response_model=RunOfShowResponse,
)
async def get_event_run_of_show(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunOfShowResponse:
    """Get all run-of-show items for an event."""
    await _require_event_access(db, current_user, event_id)
    return await RunOfShowService.get_event_ros(db, event_id)


@router.post(
    "/admin/events/{event_id}/run-of-show",
    response_model=RunOfShowItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_run_of_show_item(
    event_id: uuid.UUID,
    data: RunOfShowItemCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunOfShowItemResponse:
    """Create a new run-of-show item for an event."""
    await _require_event_access(db, current_user, event_id)
    item = await RunOfShowService.create_item(db, event_id, data, current_user)
    return RunOfShowService.item_to_response(item)


# Static paths must come before parameterized {item_id} paths
@router.patch(
    "/admin/events/{event_id}/run-of-show/reorder",
    response_model=RunOfShowResponse,
)
async def reorder_run_of_show_items(
    event_id: uuid.UUID,
    data: RunOfShowReorderRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunOfShowResponse:
    """Reorder run-of-show items by providing an ordered list of item IDs."""
    await _require_event_access(db, current_user, event_id)
    await RunOfShowService.reorder_items(db, event_id, data.item_ids)
    return await RunOfShowService.get_event_ros(db, event_id)


@router.post(
    "/admin/events/{event_id}/run-of-show/apply-template",
    response_model=ApplyTemplateResponse,
)
async def apply_template_to_run_of_show(
    event_id: uuid.UUID,
    data: ApplyTemplateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApplyTemplateResponse:
    """Apply a template to the event run-of-show (replace mode)."""
    await _require_event_access(db, current_user, event_id)
    return await RunOfShowService.apply_template(
        db, event_id, data.template_id, data.confirm_replace
    )


@router.post(
    "/admin/events/{event_id}/run-of-show/save-as-template",
    response_model=RunOfShowTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def save_run_of_show_as_template(
    event_id: uuid.UUID,
    data: SaveAsTemplateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunOfShowTemplateResponse:
    """Save the current event run-of-show as a reusable template."""
    from sqlalchemy import select

    from app.models.event import Event

    await _require_event_access(db, current_user, event_id)

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    template = await RunOfShowService.save_as_template(
        db, event_id, event.npo_id, data.name, current_user.id
    )
    return RunOfShowService.template_to_response(template)


# Parameterized {item_id} paths after static paths
@router.patch(
    "/admin/events/{event_id}/run-of-show/{item_id}",
    response_model=RunOfShowItemResponse,
)
async def update_run_of_show_item(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    data: RunOfShowItemUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunOfShowItemResponse:
    """Update a run-of-show item."""
    await _require_event_access(db, current_user, event_id)
    item = await RunOfShowService.update_item(db, event_id, item_id, data)
    return RunOfShowService.item_to_response(item)


@router.delete(
    "/admin/events/{event_id}/run-of-show/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_run_of_show_item(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a run-of-show item."""
    await _require_event_access(db, current_user, event_id)
    await RunOfShowService.delete_item(db, event_id, item_id)


@router.post(
    "/admin/events/{event_id}/run-of-show/{item_id}/complete",
    response_model=RunOfShowItemResponse,
)
async def complete_run_of_show_item(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunOfShowItemResponse:
    """Mark a run-of-show item as complete."""
    await _require_event_access(db, current_user, event_id)
    item = await RunOfShowService.mark_complete(db, event_id, item_id)
    return RunOfShowService.item_to_response(item)


@router.post(
    "/admin/events/{event_id}/run-of-show/{item_id}/incomplete",
    response_model=RunOfShowItemResponse,
)
async def incomplete_run_of_show_item(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunOfShowItemResponse:
    """Mark a run-of-show item as incomplete."""
    await _require_event_access(db, current_user, event_id)
    item = await RunOfShowService.mark_incomplete(db, event_id, item_id)
    return RunOfShowService.item_to_response(item)


# ─── Notification Sub-Resource ────────────────────────────────────────────────


@router.post(
    "/admin/events/{event_id}/run-of-show/{item_id}/notification",
    response_model=RosNotificationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_item_notification(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    data: RosNotificationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RosNotificationResponse:
    """Schedule a notification for a run-of-show item."""
    from app.models.run_of_show import RosRecipientTypeEnum

    await _require_event_access(db, current_user, event_id)

    try:
        recipient_type = RosRecipientTypeEnum(data.recipient_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid recipient_type: {data.recipient_type}. "
            "Must be 'donors', 'auctioneer', or 'all_attendees'.",
        )

    notification = await RunOfShowNotificationService.schedule_notification(
        db, item_id, data.message_body, recipient_type
    )
    return RunOfShowNotificationService.notification_to_response(notification)


@router.get(
    "/admin/events/{event_id}/run-of-show/{item_id}/notification",
    response_model=RosNotificationResponse,
)
async def get_item_notification(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RosNotificationResponse:
    """Get the scheduled notification for a run-of-show item."""
    await _require_event_access(db, current_user, event_id)
    notification = await RunOfShowNotificationService.get_notification_for_item(db, item_id)
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No notification scheduled for this item",
        )
    return RunOfShowNotificationService.notification_to_response(notification)


@router.delete(
    "/admin/events/{event_id}/run-of-show/{item_id}/notification",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_item_notification(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Cancel the scheduled notification for a run-of-show item."""
    await _require_event_access(db, current_user, event_id)
    await RunOfShowNotificationService.cancel_notification_for_item(db, item_id)


# ─── NPO Template Endpoints ─────────────────────────────────────────────────


@router.get(
    "/admin/npos/{npo_id}/run-of-show-templates",
    response_model=list[RunOfShowTemplateResponse],
)
async def list_npo_ros_templates(
    npo_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[RunOfShowTemplateResponse]:
    """List all run-of-show templates for an NPO (including system defaults)."""
    await _require_npo_access(db, current_user, npo_id)
    return await RunOfShowService.list_templates(db, npo_id)


@router.get(
    "/admin/npos/{npo_id}/run-of-show-templates/{template_id}",
    response_model=RunOfShowTemplateDetailResponse,
)
async def get_npo_ros_template(
    npo_id: uuid.UUID,
    template_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunOfShowTemplateDetailResponse:
    """Get a run-of-show template with all its items."""
    await _require_npo_access(db, current_user, npo_id)
    return await RunOfShowService.get_template_detail(db, template_id)


@router.patch(
    "/admin/npos/{npo_id}/run-of-show-templates/{template_id}",
    response_model=RunOfShowTemplateResponse,
)
async def update_npo_ros_template(
    npo_id: uuid.UUID,
    template_id: uuid.UUID,
    data: SaveAsTemplateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunOfShowTemplateResponse:
    """Rename a run-of-show template (cannot rename system default)."""
    await _require_npo_access(db, current_user, npo_id)
    template = await RunOfShowService.update_template(db, template_id, data.name)
    return RunOfShowService.template_to_response(template)


@router.delete(
    "/admin/npos/{npo_id}/run-of-show-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_npo_ros_template(
    npo_id: uuid.UUID,
    template_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a run-of-show template (cannot delete system default)."""
    await _require_npo_access(db, current_user, npo_id)
    await RunOfShowService.delete_template(db, template_id)


@router.post(
    "/admin/npos/{npo_id}/run-of-show-templates/{template_id}/items",
    response_model=RunOfShowTemplateItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_template_item(
    npo_id: uuid.UUID,
    template_id: uuid.UUID,
    data: RunOfShowTemplateItemCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunOfShowTemplateItemResponse:
    """Add an item to a run-of-show template."""
    await _require_npo_access(db, current_user, npo_id)
    item = await RunOfShowService.add_template_item(db, template_id, data)
    return RunOfShowTemplateItemResponse(
        id=item.id,
        title=item.title,
        description=item.description,
        offset_minutes=item.offset_minutes,
        donor_visible_default=item.donor_visible_default,
        auctioneer_visible_default=item.auctioneer_visible_default,
        display_order=item.display_order,
    )


@router.patch(
    "/admin/npos/{npo_id}/run-of-show-templates/{template_id}/items/{item_id}",
    response_model=RunOfShowTemplateItemResponse,
)
async def update_template_item(
    npo_id: uuid.UUID,
    template_id: uuid.UUID,
    item_id: uuid.UUID,
    data: RunOfShowTemplateItemUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunOfShowTemplateItemResponse:
    """Update a run-of-show template item."""
    await _require_npo_access(db, current_user, npo_id)
    item = await RunOfShowService.update_template_item(db, template_id, item_id, data)
    return RunOfShowTemplateItemResponse(
        id=item.id,
        title=item.title,
        description=item.description,
        offset_minutes=item.offset_minutes,
        donor_visible_default=item.donor_visible_default,
        auctioneer_visible_default=item.auctioneer_visible_default,
        display_order=item.display_order,
    )


@router.delete(
    "/admin/npos/{npo_id}/run-of-show-templates/{template_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_template_item(
    npo_id: uuid.UUID,
    template_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a run-of-show template item."""
    await _require_npo_access(db, current_user, npo_id)
    await RunOfShowService.delete_template_item(db, template_id, item_id)


@router.patch(
    "/admin/npos/{npo_id}/run-of-show-templates/{template_id}/reorder",
    response_model=RunOfShowTemplateDetailResponse,
)
async def reorder_template_items(
    npo_id: uuid.UUID,
    template_id: uuid.UUID,
    data: RunOfShowReorderRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunOfShowTemplateDetailResponse:
    """Reorder items in a run-of-show template."""
    await _require_npo_access(db, current_user, npo_id)
    await RunOfShowService.reorder_template_items(db, template_id, data.item_ids)
    return await RunOfShowService.get_template_detail(db, template_id)
