"""Run-of-Show Service — business logic for event run-of-show management."""

import logging
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.run_of_show import (
    RunOfShowItem,
    RunOfShowTemplate,
    RunOfShowTemplateItem,
)
from app.models.user import User
from app.schemas.run_of_show import (
    ApplyTemplateResponse,
    RunOfShowItemCreate,
    RunOfShowItemResponse,
    RunOfShowItemUpdate,
    RunOfShowResponse,
    RunOfShowTemplateDetailResponse,
    RunOfShowTemplateItemCreate,
    RunOfShowTemplateItemResponse,
    RunOfShowTemplateItemUpdate,
    RunOfShowTemplateResponse,
)

logger = logging.getLogger(__name__)


class RunOfShowService:
    """Service for managing event run-of-show items and templates."""

    # ─── Response Helpers ────────────────────────────────────────────────────

    @staticmethod
    def item_to_response(item: RunOfShowItem) -> RunOfShowItemResponse:
        """Convert ORM model to response schema."""
        notification = item.__dict__.get("notification")
        has_notification = notification is not None
        return RunOfShowItemResponse(
            id=item.id,
            event_id=item.event_id,
            title=item.title,
            description=item.description,
            scheduled_time=item.scheduled_time,
            donor_visible=item.donor_visible,
            auctioneer_visible=item.auctioneer_visible,
            is_complete=item.is_complete,
            completed_at=item.completed_at,
            display_order=item.display_order,
            has_notification=has_notification,
            created_by=item.created_by,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @staticmethod
    def template_to_response(
        template: RunOfShowTemplate, item_count: int | None = None
    ) -> RunOfShowTemplateResponse:
        """Convert template ORM model to response schema."""
        if item_count is not None:
            count = item_count
        else:
            items = template.__dict__.get("items")
            count = len(items) if items is not None else 0
        return RunOfShowTemplateResponse(
            id=template.id,
            npo_id=template.npo_id,
            name=template.name,
            is_system_default=template.is_system_default,
            item_count=count,
            created_by=template.created_by,
            created_at=template.created_at,
            updated_at=template.updated_at,
        )

    # ─── Event RoS CRUD ──────────────────────────────────────────────────────

    @staticmethod
    async def _get_item(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_id: uuid.UUID,
    ) -> RunOfShowItem:
        result = await db.execute(
            select(RunOfShowItem).where(
                RunOfShowItem.id == item_id,
                RunOfShowItem.event_id == event_id,
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Run-of-show item not found",
            )
        return item

    @staticmethod
    async def get_event_ros(
        db: AsyncSession,
        event_id: uuid.UUID,
        visibility_filter: str | None = None,
    ) -> RunOfShowResponse:
        """Get all run-of-show items for an event."""
        query = select(RunOfShowItem).where(RunOfShowItem.event_id == event_id)

        if visibility_filter == "donor":
            query = query.where(RunOfShowItem.donor_visible.is_(True))
        elif visibility_filter == "auctioneer":
            query = query.where(RunOfShowItem.auctioneer_visible.is_(True))

        query = query.order_by(
            RunOfShowItem.display_order.asc(),
            RunOfShowItem.scheduled_time.asc().nulls_last(),
        )

        result = await db.execute(query)
        items = list(result.scalars().all())

        now = datetime.now(UTC)
        completed_count = sum(1 for i in items if i.is_complete)

        # Next item: earliest uncompleted item where scheduled_time > now
        next_item_orm: RunOfShowItem | None = None
        future_incomplete = [
            i
            for i in items
            if not i.is_complete and i.scheduled_time is not None and i.scheduled_time > now
        ]
        if future_incomplete:
            next_item_orm = min(
                future_incomplete,
                key=lambda i: i.scheduled_time or datetime.min.replace(tzinfo=UTC),
            )

        # Get event start time
        event_result = await db.execute(select(Event).where(Event.id == event_id))
        event = event_result.scalar_one_or_none()
        event_start_time = event.event_datetime if event else None

        item_responses = [RunOfShowService.item_to_response(i) for i in items]
        next_item_response = (
            RunOfShowService.item_to_response(next_item_orm) if next_item_orm is not None else None
        )

        return RunOfShowResponse(
            items=item_responses,
            total_count=len(items),
            completed_count=completed_count,
            next_item=next_item_response,
            event_start_time=event_start_time,
        )

    @staticmethod
    async def create_item(
        db: AsyncSession,
        event_id: uuid.UUID,
        data: RunOfShowItemCreate,
        current_user: User,
    ) -> RunOfShowItem:
        """Create a new run-of-show item."""
        max_order_result = await db.execute(
            select(func.max(RunOfShowItem.display_order)).where(RunOfShowItem.event_id == event_id)
        )
        max_order = max_order_result.scalar_one_or_none()

        if data.display_order is not None:
            display_order = data.display_order
        else:
            display_order = (max_order + 1) if max_order is not None else 0

        item = RunOfShowItem(
            id=uuid.uuid4(),
            event_id=event_id,
            title=data.title,
            description=data.description,
            scheduled_time=data.scheduled_time,
            donor_visible=data.donor_visible,
            auctioneer_visible=data.auctioneer_visible,
            is_complete=False,
            completed_at=None,
            display_order=display_order,
            created_by=current_user.id,
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        logger.info(f"Created RoS item '{item.title}' for event {event_id}")
        return item

    @staticmethod
    async def update_item(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_id: uuid.UUID,
        data: RunOfShowItemUpdate,
    ) -> RunOfShowItem:
        """Partial update of a run-of-show item."""
        item = await RunOfShowService._get_item(db, event_id, item_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)
        await db.commit()
        await db.refresh(item)
        logger.info(f"Updated RoS item {item_id} for event {event_id}")
        return item

    @staticmethod
    async def delete_item(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_id: uuid.UUID,
    ) -> None:
        """Delete a run-of-show item (also cancels any pending notification)."""
        from app.services.run_of_show_notification_service import (
            RunOfShowNotificationService,
        )

        item = await RunOfShowService._get_item(db, event_id, item_id)
        await RunOfShowNotificationService.cancel_notification_for_item(db, item_id)
        await db.delete(item)
        await db.commit()
        logger.info(f"Deleted RoS item {item_id} from event {event_id}")

    @staticmethod
    async def reorder_items(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_ids: list[uuid.UUID],
    ) -> None:
        """Reorder run-of-show items by updating display_order."""
        result = await db.execute(select(RunOfShowItem).where(RunOfShowItem.event_id == event_id))
        items = {item.id: item for item in result.scalars().all()}
        for order, item_id in enumerate(item_ids):
            if item_id in items:
                items[item_id].display_order = order
        await db.commit()
        logger.info(f"Reordered {len(item_ids)} RoS items for event {event_id}")

    @staticmethod
    async def mark_complete(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_id: uuid.UUID,
    ) -> RunOfShowItem:
        """Mark a run-of-show item as complete."""
        item = await RunOfShowService._get_item(db, event_id, item_id)
        item.is_complete = True
        item.completed_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(item)
        logger.info(f"Marked RoS item {item_id} complete for event {event_id}")
        return item

    @staticmethod
    async def mark_incomplete(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_id: uuid.UUID,
    ) -> RunOfShowItem:
        """Mark a run-of-show item as incomplete."""
        item = await RunOfShowService._get_item(db, event_id, item_id)
        item.is_complete = False
        item.completed_at = None
        await db.commit()
        await db.refresh(item)
        logger.info(f"Marked RoS item {item_id} incomplete for event {event_id}")
        return item

    # ─── Template Operations ─────────────────────────────────────────────────

    @staticmethod
    async def _get_template(
        db: AsyncSession,
        template_id: uuid.UUID,
    ) -> RunOfShowTemplate:
        result = await db.execute(
            select(RunOfShowTemplate).where(RunOfShowTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )
        return template

    @staticmethod
    async def list_templates(
        db: AsyncSession,
        npo_id: uuid.UUID,
    ) -> list[RunOfShowTemplateResponse]:
        """List NPO templates + system defaults."""
        query = (
            select(RunOfShowTemplate)
            .where(
                (RunOfShowTemplate.npo_id == npo_id)
                | (RunOfShowTemplate.is_system_default.is_(True))
            )
            .options(selectinload(RunOfShowTemplate.items))
            .order_by(
                RunOfShowTemplate.is_system_default.desc(),
                RunOfShowTemplate.name.asc(),
            )
        )
        result = await db.execute(query)
        templates = list(result.scalars().all())
        return [RunOfShowService.template_to_response(t) for t in templates]

    @staticmethod
    async def get_template_detail(
        db: AsyncSession,
        template_id: uuid.UUID,
    ) -> RunOfShowTemplateDetailResponse:
        """Get a template with all its items."""
        result = await db.execute(
            select(RunOfShowTemplate)
            .where(RunOfShowTemplate.id == template_id)
            .options(selectinload(RunOfShowTemplate.items))
        )
        template = result.scalar_one_or_none()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )
        return RunOfShowTemplateDetailResponse(
            id=template.id,
            npo_id=template.npo_id,
            name=template.name,
            is_system_default=template.is_system_default,
            items=[
                RunOfShowTemplateItemResponse(
                    id=i.id,
                    title=i.title,
                    description=i.description,
                    offset_minutes=i.offset_minutes,
                    donor_visible_default=i.donor_visible_default,
                    auctioneer_visible_default=i.auctioneer_visible_default,
                    display_order=i.display_order,
                )
                for i in sorted(template.items, key=lambda x: x.display_order)
            ],
            created_by=template.created_by,
            created_at=template.created_at,
            updated_at=template.updated_at,
        )

    @staticmethod
    async def create_template(
        db: AsyncSession,
        npo_id: uuid.UUID,
        name: str,
        created_by: uuid.UUID,
    ) -> RunOfShowTemplate:
        """Create an empty template for an NPO."""
        template = RunOfShowTemplate(
            id=uuid.uuid4(),
            npo_id=npo_id,
            name=name,
            is_system_default=False,
            created_by=created_by,
        )
        db.add(template)
        await db.commit()
        await db.refresh(template)
        logger.info(f"Created RoS template '{name}' for NPO {npo_id}")
        return template

    @staticmethod
    async def update_template(
        db: AsyncSession,
        template_id: uuid.UUID,
        name: str,
    ) -> RunOfShowTemplate:
        """Rename a template. Raises 403 if system default."""
        template = await RunOfShowService._get_template(db, template_id)
        if template.is_system_default:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify system default template",
            )
        template.name = name
        await db.commit()
        await db.refresh(template)
        return template

    @staticmethod
    async def delete_template(
        db: AsyncSession,
        template_id: uuid.UUID,
    ) -> None:
        """Delete a template. Raises 403 if system default."""
        template = await RunOfShowService._get_template(db, template_id)
        if template.is_system_default:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete system default template",
            )
        await db.delete(template)
        await db.commit()
        logger.info(f"Deleted RoS template {template_id}")

    @staticmethod
    async def add_template_item(
        db: AsyncSession,
        template_id: uuid.UUID,
        data: RunOfShowTemplateItemCreate,
    ) -> RunOfShowTemplateItem:
        """Add an item to a template. Raises 403 if system default."""
        template = await RunOfShowService._get_template(db, template_id)
        if template.is_system_default:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify system default template",
            )

        max_order_result = await db.execute(
            select(func.max(RunOfShowTemplateItem.display_order)).where(
                RunOfShowTemplateItem.template_id == template_id
            )
        )
        max_order = max_order_result.scalar_one_or_none()

        if data.display_order is not None:
            display_order = data.display_order
        else:
            display_order = (max_order + 1) if max_order is not None else 0

        item = RunOfShowTemplateItem(
            id=uuid.uuid4(),
            template_id=template_id,
            title=data.title,
            description=data.description,
            offset_minutes=data.offset_minutes,
            donor_visible_default=data.donor_visible_default,
            auctioneer_visible_default=data.auctioneer_visible_default,
            display_order=display_order,
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return item

    @staticmethod
    async def update_template_item(
        db: AsyncSession,
        template_id: uuid.UUID,
        item_id: uuid.UUID,
        data: RunOfShowTemplateItemUpdate,
    ) -> RunOfShowTemplateItem:
        """Update a template item. Raises 403 if system default."""
        template = await RunOfShowService._get_template(db, template_id)
        if template.is_system_default:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify system default template",
            )

        result = await db.execute(
            select(RunOfShowTemplateItem).where(
                RunOfShowTemplateItem.id == item_id,
                RunOfShowTemplateItem.template_id == template_id,
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template item not found",
            )

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)
        await db.commit()
        await db.refresh(item)
        return item

    @staticmethod
    async def delete_template_item(
        db: AsyncSession,
        template_id: uuid.UUID,
        item_id: uuid.UUID,
    ) -> None:
        """Delete a template item. Raises 403 if system default."""
        template = await RunOfShowService._get_template(db, template_id)
        if template.is_system_default:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify system default template",
            )

        result = await db.execute(
            select(RunOfShowTemplateItem).where(
                RunOfShowTemplateItem.id == item_id,
                RunOfShowTemplateItem.template_id == template_id,
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template item not found",
            )
        await db.delete(item)
        await db.commit()

    @staticmethod
    async def reorder_template_items(
        db: AsyncSession,
        template_id: uuid.UUID,
        item_ids: list[uuid.UUID],
    ) -> None:
        """Reorder template items. Raises 403 if system default."""
        template = await RunOfShowService._get_template(db, template_id)
        if template.is_system_default:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify system default template",
            )

        result = await db.execute(
            select(RunOfShowTemplateItem).where(RunOfShowTemplateItem.template_id == template_id)
        )
        items = {item.id: item for item in result.scalars().all()}
        for order, item_id in enumerate(item_ids):
            if item_id in items:
                items[item_id].display_order = order
        await db.commit()

    @staticmethod
    async def save_as_template(
        db: AsyncSession,
        event_id: uuid.UUID,
        npo_id: uuid.UUID,
        name: str,
        created_by: uuid.UUID,
    ) -> RunOfShowTemplate:
        """Copy current event items to a new template."""
        event_result = await db.execute(select(Event).where(Event.id == event_id))
        event = event_result.scalar_one_or_none()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found",
            )
        if event.event_datetime is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event must have a start time to save as template",
            )

        # Check for duplicate name
        dup_result = await db.execute(
            select(func.count(RunOfShowTemplate.id)).where(
                RunOfShowTemplate.npo_id == npo_id,
                RunOfShowTemplate.name == name,
            )
        )
        if dup_result.scalar_one() > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Template name '{name}' already exists for this organization",
            )

        # Load event items ordered by display_order
        items_result = await db.execute(
            select(RunOfShowItem)
            .where(RunOfShowItem.event_id == event_id)
            .order_by(RunOfShowItem.display_order.asc())
        )
        items = list(items_result.scalars().all())

        template = RunOfShowTemplate(
            id=uuid.uuid4(),
            npo_id=npo_id,
            name=name,
            is_system_default=False,
            created_by=created_by,
        )
        db.add(template)
        await db.flush()

        for order, item in enumerate(items):
            if item.scheduled_time is not None:
                offset_minutes = round(
                    (item.scheduled_time - event.event_datetime).total_seconds() / 60
                )
                offset_minutes = max(0, offset_minutes)
            else:
                offset_minutes = 0
            tmpl_item = RunOfShowTemplateItem(
                id=uuid.uuid4(),
                template_id=template.id,
                title=item.title,
                description=item.description,
                offset_minutes=offset_minutes,
                donor_visible_default=item.donor_visible,
                auctioneer_visible_default=item.auctioneer_visible,
                display_order=order,
            )
            db.add(tmpl_item)

        await db.commit()
        result_tmpl = await db.execute(
            select(RunOfShowTemplate)
            .where(RunOfShowTemplate.id == template.id)
            .options(selectinload(RunOfShowTemplate.items))
        )
        saved_template = result_tmpl.scalar_one()
        logger.info(f"Saved event {event_id} RoS as template '{name}' for NPO {npo_id}")
        return saved_template

    @staticmethod
    async def apply_template(
        db: AsyncSession,
        event_id: uuid.UUID,
        template_id: uuid.UUID,
        confirm_replace: bool = False,
    ) -> ApplyTemplateResponse:
        """Apply a template to an event, replacing or refusing if items exist."""
        from datetime import timedelta

        from app.services.run_of_show_notification_service import (
            RunOfShowNotificationService,
        )

        event_result = await db.execute(select(Event).where(Event.id == event_id))
        event = event_result.scalar_one_or_none()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found",
            )
        if event.event_datetime is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event must have a start time to apply a template",
            )

        # Load template with items
        result = await db.execute(
            select(RunOfShowTemplate)
            .where(
                RunOfShowTemplate.id == template_id,
                or_(
                    RunOfShowTemplate.is_system_default.is_(True),
                    RunOfShowTemplate.npo_id == event.npo_id,
                ),
            )
            .options(selectinload(RunOfShowTemplate.items))
        )
        template = result.scalar_one_or_none()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )

        # Check for existing items
        count_result = await db.execute(
            select(func.count(RunOfShowItem.id)).where(RunOfShowItem.event_id == event_id)
        )
        existing_count = count_result.scalar_one()

        replaced = False
        if existing_count > 0:
            if not confirm_replace:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Event already has run-of-show items. Set confirm_replace=true to replace them.",
                )
            # Cancel notifications for existing items before deleting
            await RunOfShowNotificationService.cancel_all_pending_for_event(db, event_id)
            await db.execute(delete(RunOfShowItem).where(RunOfShowItem.event_id == event_id))
            replaced = True

        # Create new items from template
        items_created = 0
        for tmpl_item in sorted(template.items, key=lambda x: x.display_order):
            scheduled_time = event.event_datetime + timedelta(minutes=tmpl_item.offset_minutes)
            new_item = RunOfShowItem(
                id=uuid.uuid4(),
                event_id=event_id,
                title=tmpl_item.title,
                description=tmpl_item.description,
                scheduled_time=scheduled_time,
                donor_visible=tmpl_item.donor_visible_default,
                auctioneer_visible=tmpl_item.auctioneer_visible_default,
                is_complete=False,
                completed_at=None,
                display_order=tmpl_item.display_order,
                created_by=event.created_by,
            )
            db.add(new_item)
            items_created += 1

        await db.commit()
        logger.info(
            f"Applied template '{template.name}' to event {event_id}: "
            f"replaced={replaced}, created={items_created}"
        )
        return ApplyTemplateResponse(replaced=replaced, items_created=items_created)
