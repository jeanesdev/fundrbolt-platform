"""Checklist Service — Business logic for event planning checklists and templates."""

import logging
import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.checklist import (
    ChecklistItem,
    ChecklistItemStatus,
    ChecklistTemplate,
    ChecklistTemplateItem,
)
from app.models.event import Event
from app.models.user import User
from app.schemas.checklist import (
    ChecklistItemCreate,
    ChecklistItemResponse,
    ChecklistItemStatusUpdate,
    ChecklistItemUpdate,
    ChecklistResponse,
    ChecklistTemplateDetailResponse,
    ChecklistTemplateItemResponse,
    ChecklistTemplateResponse,
    ChecklistTemplateUpdate,
)

logger = logging.getLogger(__name__)


class ChecklistService:
    """Service for managing event planning checklists and templates."""

    # ─── Item Response Helpers ───────────────────────────────────────────────

    @staticmethod
    def item_to_response(item: ChecklistItem) -> ChecklistItemResponse:
        """Convert a ChecklistItem ORM model to a response schema."""
        today = date.today()
        is_overdue = (
            item.due_date is not None
            and item.due_date < today
            and item.status != ChecklistItemStatus.COMPLETE
        )
        return ChecklistItemResponse(
            id=item.id,
            event_id=item.event_id,
            title=item.title,
            due_date=item.due_date,
            status=item.status.value,
            display_order=item.display_order,
            due_date_is_template_derived=item.due_date_is_template_derived,
            offset_days=item.offset_days,
            completed_at=item.completed_at,
            is_overdue=is_overdue,
            created_by=item.created_by,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @staticmethod
    def template_to_response(
        template: ChecklistTemplate, item_count: int | None = None
    ) -> ChecklistTemplateResponse:
        """Convert a ChecklistTemplate ORM model to a response schema."""
        if item_count is not None:
            count = item_count
        else:
            # Only access items if already loaded (avoids lazy load in async)
            items = template.__dict__.get("items")
            count = len(items) if items is not None else 0
        return ChecklistTemplateResponse(
            id=template.id,
            npo_id=template.npo_id,
            name=template.name,
            is_default=template.is_default,
            is_system_default=template.is_system_default,
            item_count=count,
            created_by=template.created_by,
            created_at=template.created_at,
            updated_at=template.updated_at,
        )

    # ─── Event Checklist CRUD ────────────────────────────────────────────────

    @staticmethod
    async def get_event_checklist(
        db: AsyncSession,
        event_id: uuid.UUID,
    ) -> ChecklistResponse:
        """Get all checklist items for an event with progress summary."""
        query = (
            select(ChecklistItem)
            .where(ChecklistItem.event_id == event_id)
            .order_by(
                ChecklistItem.display_order.asc(),
                ChecklistItem.due_date.asc().nulls_last(),
                ChecklistItem.created_at.asc(),
            )
        )
        result = await db.execute(query)
        items = list(result.scalars().all())

        item_responses = []
        completed = 0
        in_progress = 0
        overdue = 0

        for item in items:
            resp = ChecklistService.item_to_response(item)
            item_responses.append(resp)
            if item.status == ChecklistItemStatus.COMPLETE:
                completed += 1
            elif item.status == ChecklistItemStatus.IN_PROGRESS:
                in_progress += 1
            if resp.is_overdue:
                overdue += 1

        total = len(items)
        return ChecklistResponse(
            items=item_responses,
            total_count=total,
            completed_count=completed,
            in_progress_count=in_progress,
            overdue_count=overdue,
            progress_percentage=(completed / total * 100) if total > 0 else 0.0,
        )

    @staticmethod
    async def create_item(
        db: AsyncSession,
        event_id: uuid.UUID,
        data: ChecklistItemCreate,
        current_user: User,
    ) -> ChecklistItem:
        """Create a new checklist item for an event."""
        # Get next display_order
        max_order_result = await db.execute(
            select(func.max(ChecklistItem.display_order)).where(ChecklistItem.event_id == event_id)
        )
        max_order = max_order_result.scalar_one_or_none()
        next_order = (max_order + 1) if max_order is not None else 0

        item = ChecklistItem(
            id=uuid.uuid4(),
            event_id=event_id,
            title=data.title,
            due_date=data.due_date,
            status=ChecklistItemStatus.NOT_COMPLETE,
            display_order=next_order,
            due_date_is_template_derived=False,
            offset_days=None,
            completed_at=None,
            created_by=current_user.id,
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)

        logger.info(f"Created checklist item '{item.title}' for event {event_id}")
        return item

    @staticmethod
    async def update_item(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_id: uuid.UUID,
        data: ChecklistItemUpdate,
    ) -> ChecklistItem:
        """Update a checklist item's title or due date."""
        item = await ChecklistService._get_item(db, event_id, item_id)

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)

        # If due_date is manually set, clear template-derived flag
        if "due_date" in update_data:
            item.due_date_is_template_derived = False
            item.offset_days = None

        await db.commit()
        await db.refresh(item)

        logger.info(f"Updated checklist item {item_id} for event {event_id}")
        return item

    @staticmethod
    async def update_item_status(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_id: uuid.UUID,
        data: ChecklistItemStatusUpdate,
    ) -> ChecklistItem:
        """Update a checklist item's status with completed_at management."""
        item = await ChecklistService._get_item(db, event_id, item_id)

        new_status = ChecklistItemStatus(data.status)
        old_status = item.status

        item.status = new_status

        # Manage completed_at timestamp
        if (
            new_status == ChecklistItemStatus.COMPLETE
            and old_status != ChecklistItemStatus.COMPLETE
        ):
            item.completed_at = datetime.now(UTC)
        elif (
            new_status != ChecklistItemStatus.COMPLETE
            and old_status == ChecklistItemStatus.COMPLETE
        ):
            item.completed_at = None

        await db.commit()
        await db.refresh(item)

        logger.info(
            f"Updated checklist item {item_id} status: {old_status.value} → {new_status.value}"
        )
        return item

    @staticmethod
    async def delete_item(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_id: uuid.UUID,
    ) -> None:
        """Delete a checklist item."""
        item = await ChecklistService._get_item(db, event_id, item_id)
        await db.delete(item)
        await db.commit()
        logger.info(f"Deleted checklist item {item_id} from event {event_id}")

    @staticmethod
    async def reorder_items(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_ids: list[uuid.UUID],
    ) -> None:
        """Reorder checklist items by updating display_order."""
        result = await db.execute(select(ChecklistItem).where(ChecklistItem.event_id == event_id))
        items = {item.id: item for item in result.scalars().all()}

        for order, item_id in enumerate(item_ids):
            if item_id in items:
                items[item_id].display_order = order

        await db.commit()
        logger.info(f"Reordered {len(item_ids)} checklist items for event {event_id}")

    # ─── Template Operations ─────────────────────────────────────────────────

    @staticmethod
    async def resolve_default_template(
        db: AsyncSession,
        npo_id: uuid.UUID,
    ) -> ChecklistTemplate | None:
        """Find the NPO's default template, or fall back to system default."""
        # Try NPO default first
        result = await db.execute(
            select(ChecklistTemplate)
            .where(
                ChecklistTemplate.npo_id == npo_id,
                ChecklistTemplate.is_default.is_(True),
            )
            .options(selectinload(ChecklistTemplate.items))
        )
        template = result.scalar_one_or_none()
        if template:
            return template

        # Fall back to system default
        result = await db.execute(
            select(ChecklistTemplate)
            .where(ChecklistTemplate.is_system_default.is_(True))
            .options(selectinload(ChecklistTemplate.items))
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def populate_from_template(
        db: AsyncSession,
        event: Event,
        template: ChecklistTemplate,
        created_by: uuid.UUID,
    ) -> list[ChecklistItem]:
        """Populate an event's checklist from a template."""
        local_date = event.event_datetime.astimezone(ZoneInfo(event.timezone)).date()

        items: list[ChecklistItem] = []
        for tmpl_item in sorted(template.items, key=lambda x: x.display_order):
            due = None
            is_derived = False
            if tmpl_item.offset_days is not None:
                due = local_date + timedelta(days=tmpl_item.offset_days)
                is_derived = True

            item = ChecklistItem(
                id=uuid.uuid4(),
                event_id=event.id,
                title=tmpl_item.title,
                due_date=due,
                status=ChecklistItemStatus.NOT_COMPLETE,
                display_order=tmpl_item.display_order,
                due_date_is_template_derived=is_derived,
                offset_days=tmpl_item.offset_days,
                completed_at=None,
                created_by=created_by,
            )
            db.add(item)
            items.append(item)

        await db.flush()
        logger.info(
            f"Populated {len(items)} checklist items from template "
            f"'{template.name}' for event {event.id}"
        )
        return items

    @staticmethod
    async def recalculate_template_dates(
        db: AsyncSession,
        event: Event,
    ) -> int:
        """Recalculate due dates for template-derived items when event date changes."""
        result = await db.execute(
            select(ChecklistItem).where(
                ChecklistItem.event_id == event.id,
                ChecklistItem.due_date_is_template_derived.is_(True),
                ChecklistItem.offset_days.is_not(None),
            )
        )
        items = list(result.scalars().all())

        if not items:
            return 0

        local_date = event.event_datetime.astimezone(ZoneInfo(event.timezone)).date()

        for item in items:
            item.due_date = local_date + timedelta(days=item.offset_days)  # type: ignore[arg-type]

        await db.flush()
        logger.info(f"Recalculated {len(items)} template-derived due dates for event {event.id}")
        return len(items)

    @staticmethod
    async def apply_template(
        db: AsyncSession,
        event_id: uuid.UUID,
        template_id: uuid.UUID,
        mode: str,
        current_user: User,
    ) -> None:
        """Apply a template to an event checklist (replace or append)."""
        # Load event for date calculation and NPO ownership check
        event_result = await db.execute(select(Event).where(Event.id == event_id))
        event = event_result.scalar_one_or_none()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found",
            )

        # Load template with items — only allow system defaults or templates owned by the event's NPO
        result = await db.execute(
            select(ChecklistTemplate)
            .where(
                ChecklistTemplate.id == template_id,
                or_(
                    ChecklistTemplate.is_system_default.is_(True),
                    ChecklistTemplate.npo_id == event.npo_id,
                ),
            )
            .options(selectinload(ChecklistTemplate.items))
        )
        template = result.scalar_one_or_none()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )

        if mode == "replace":
            # Delete existing items
            await db.execute(delete(ChecklistItem).where(ChecklistItem.event_id == event_id))

        # Calculate display_order offset for append mode
        offset = 0
        if mode == "append":
            max_result = await db.execute(
                select(func.max(ChecklistItem.display_order)).where(
                    ChecklistItem.event_id == event_id
                )
            )
            max_order = max_result.scalar_one_or_none()
            offset = (max_order + 1) if max_order is not None else 0

        local_date = event.event_datetime.astimezone(ZoneInfo(event.timezone)).date()

        for tmpl_item in sorted(template.items, key=lambda x: x.display_order):
            due = None
            is_derived = False
            if tmpl_item.offset_days is not None:
                due = local_date + timedelta(days=tmpl_item.offset_days)
                is_derived = True

            item = ChecklistItem(
                id=uuid.uuid4(),
                event_id=event_id,
                title=tmpl_item.title,
                due_date=due,
                status=ChecklistItemStatus.NOT_COMPLETE,
                display_order=tmpl_item.display_order + offset,
                due_date_is_template_derived=is_derived,
                offset_days=tmpl_item.offset_days,
                completed_at=None,
                created_by=current_user.id,
            )
            db.add(item)

        await db.commit()
        logger.info(f"Applied template '{template.name}' to event {event_id} in {mode} mode")

    @staticmethod
    async def save_as_template(
        db: AsyncSession,
        event_id: uuid.UUID,
        name: str,
        current_user: User,
    ) -> ChecklistTemplate:
        """Save the current event checklist as a reusable template."""
        # Load event to get npo_id
        event_result = await db.execute(select(Event).where(Event.id == event_id))
        event = event_result.scalar_one_or_none()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found",
            )

        # Check for duplicate name
        dup_result = await db.execute(
            select(func.count(ChecklistTemplate.id)).where(
                ChecklistTemplate.npo_id == event.npo_id,
                ChecklistTemplate.name == name,
            )
        )
        if dup_result.scalar_one() > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Template name '{name}' already exists for this organization",
            )

        # Load checklist items
        items_result = await db.execute(
            select(ChecklistItem)
            .where(ChecklistItem.event_id == event_id)
            .order_by(ChecklistItem.display_order.asc())
        )
        items = list(items_result.scalars().all())

        # Compute offset_days from event date
        local_date = event.event_datetime.astimezone(ZoneInfo(event.timezone)).date()

        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=event.npo_id,
            name=name,
            is_default=False,
            is_system_default=False,
            created_by=current_user.id,
        )
        db.add(template)
        await db.flush()

        for order, item in enumerate(items):
            offset_days = None
            if item.due_date is not None:
                offset_days = (item.due_date - local_date).days

            tmpl_item = ChecklistTemplateItem(
                id=uuid.uuid4(),
                template_id=template.id,
                title=item.title,
                offset_days=offset_days,
                display_order=order,
            )
            db.add(tmpl_item)

        await db.commit()
        # Reload with items
        result = await db.execute(
            select(ChecklistTemplate)
            .where(ChecklistTemplate.id == template.id)
            .options(selectinload(ChecklistTemplate.items))
        )
        template = result.scalar_one()

        logger.info(
            f"Saved event {event_id} checklist as template '{name}' "
            f"with {len(items)} items for NPO {event.npo_id}"
        )
        return template

    # ─── Template CRUD ───────────────────────────────────────────────────────

    @staticmethod
    async def list_templates(
        db: AsyncSession,
        npo_id: uuid.UUID,
    ) -> list[ChecklistTemplateResponse]:
        """List templates for an NPO (including system defaults)."""
        query = (
            select(ChecklistTemplate)
            .where(
                (ChecklistTemplate.npo_id == npo_id)
                | (ChecklistTemplate.is_system_default.is_(True))
            )
            .options(selectinload(ChecklistTemplate.items))
            .order_by(
                ChecklistTemplate.is_system_default.desc(),
                ChecklistTemplate.name.asc(),
            )
        )
        result = await db.execute(query)
        templates = list(result.scalars().all())
        return [ChecklistService.template_to_response(t) for t in templates]

    @staticmethod
    async def get_template(
        db: AsyncSession,
        npo_id: uuid.UUID,
        template_id: uuid.UUID,
    ) -> ChecklistTemplateDetailResponse:
        """Get a template with all its items."""
        result = await db.execute(
            select(ChecklistTemplate)
            .where(
                ChecklistTemplate.id == template_id,
                (ChecklistTemplate.npo_id == npo_id)
                | (ChecklistTemplate.is_system_default.is_(True)),
            )
            .options(selectinload(ChecklistTemplate.items))
        )
        template = result.scalar_one_or_none()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )

        return ChecklistTemplateDetailResponse(
            id=template.id,
            npo_id=template.npo_id,
            name=template.name,
            is_default=template.is_default,
            is_system_default=template.is_system_default,
            items=[
                ChecklistTemplateItemResponse(
                    id=i.id,
                    title=i.title,
                    offset_days=i.offset_days,
                    display_order=i.display_order,
                )
                for i in sorted(template.items, key=lambda x: x.display_order)
            ],
            created_by=template.created_by,
            created_at=template.created_at,
            updated_at=template.updated_at,
        )

    @staticmethod
    async def update_template(
        db: AsyncSession,
        npo_id: uuid.UUID,
        template_id: uuid.UUID,
        data: ChecklistTemplateUpdate,
    ) -> ChecklistTemplate:
        """Update a template's name."""
        template = await ChecklistService._get_template(db, npo_id, template_id)

        if template.is_system_default:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot modify system default template",
            )

        if data.name is not None:
            # Check for duplicate name
            dup_result = await db.execute(
                select(func.count(ChecklistTemplate.id)).where(
                    ChecklistTemplate.npo_id == npo_id,
                    ChecklistTemplate.name == data.name,
                    ChecklistTemplate.id != template_id,
                )
            )
            if dup_result.scalar_one() > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Template name '{data.name}' already exists",
                )
            template.name = data.name

        await db.commit()
        await db.refresh(template)
        return template

    @staticmethod
    async def delete_template(
        db: AsyncSession,
        npo_id: uuid.UUID,
        template_id: uuid.UUID,
    ) -> None:
        """Delete a template (cannot delete system default)."""
        template = await ChecklistService._get_template(db, npo_id, template_id)

        if template.is_system_default:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete system default template",
            )

        await db.delete(template)
        await db.commit()
        logger.info(f"Deleted template {template_id} for NPO {npo_id}")

    @staticmethod
    async def set_default_template(
        db: AsyncSession,
        npo_id: uuid.UUID,
        template_id: uuid.UUID,
    ) -> ChecklistTemplate:
        """Set a template as the NPO's default (unsets previous default)."""
        template = await ChecklistService._get_template(db, npo_id, template_id)

        if template.is_system_default:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot set system default as NPO default",
            )

        # Unset any existing default using bulk UPDATE to ensure
        # it flushes before the new default is set (partial unique index).
        await db.execute(
            update(ChecklistTemplate)
            .where(
                ChecklistTemplate.npo_id == npo_id,
                ChecklistTemplate.is_default.is_(True),
            )
            .values(is_default=False)
        )
        await db.flush()

        template.is_default = True
        await db.commit()
        await db.refresh(template)

        logger.info(f"Set template {template_id} as default for NPO {npo_id}")
        return template

    # ─── Private Helpers ─────────────────────────────────────────────────────

    @staticmethod
    async def _get_item(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_id: uuid.UUID,
    ) -> ChecklistItem:
        """Get a checklist item, raising 404 if not found."""
        result = await db.execute(
            select(ChecklistItem).where(
                ChecklistItem.id == item_id,
                ChecklistItem.event_id == event_id,
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Checklist item not found",
            )
        return item

    @staticmethod
    async def _get_template(
        db: AsyncSession,
        npo_id: uuid.UUID,
        template_id: uuid.UUID,
    ) -> ChecklistTemplate:
        """Get a template, raising 404 if not found."""
        result = await db.execute(
            select(ChecklistTemplate).where(
                ChecklistTemplate.id == template_id,
                (ChecklistTemplate.npo_id == npo_id)
                | (ChecklistTemplate.is_system_default.is_(True)),
            )
        )
        template = result.scalar_one_or_none()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )
        return template
