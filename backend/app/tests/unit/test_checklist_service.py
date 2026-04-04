"""Unit tests for ChecklistService."""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checklist import (
    ChecklistItem,
    ChecklistItemStatus,
    ChecklistTemplate,
    ChecklistTemplateItem,
)
from app.schemas.checklist import (
    ChecklistItemCreate,
    ChecklistItemStatusUpdate,
    ChecklistItemUpdate,
    ChecklistTemplateUpdate,
)
from app.services.checklist_service import ChecklistService


@pytest.mark.asyncio
class TestChecklistServiceItems:
    """Tests for checklist item CRUD operations."""

    async def test_get_event_checklist_empty(
        self, db_session: AsyncSession, test_event: dict
    ) -> None:
        result = await ChecklistService.get_event_checklist(db_session, test_event.id)
        assert result.total_count == 0
        assert result.items == []
        assert result.progress_percentage == 0.0

    async def test_get_event_checklist_with_progress(
        self, db_session: AsyncSession, test_event: dict
    ) -> None:
        for i, (title, status) in enumerate(
            [
                ("A", ChecklistItemStatus.COMPLETE),
                ("B", ChecklistItemStatus.IN_PROGRESS),
                ("C", ChecklistItemStatus.NOT_COMPLETE),
            ]
        ):
            item = ChecklistItem(
                id=uuid.uuid4(),
                event_id=test_event.id,
                title=title,
                status=status,
                display_order=i,
                due_date_is_template_derived=False,
                created_by=test_event.created_by,
            )
            db_session.add(item)
        await db_session.commit()

        result = await ChecklistService.get_event_checklist(db_session, test_event.id)
        assert result.total_count == 3
        assert result.completed_count == 1
        assert result.in_progress_count == 1
        assert abs(result.progress_percentage - 33.33) < 1

    async def test_create_item(
        self, db_session: AsyncSession, test_event: dict, test_npo_admin_user: dict
    ) -> None:
        data = ChecklistItemCreate(title="Book venue", due_date=date(2025, 6, 1))
        item = await ChecklistService.create_item(
            db_session, test_event.id, data, test_npo_admin_user
        )
        assert item.title == "Book venue"
        assert item.due_date == date(2025, 6, 1)
        assert item.status == ChecklistItemStatus.NOT_COMPLETE
        assert item.display_order == 0

    async def test_create_item_auto_increments_order(
        self, db_session: AsyncSession, test_event: dict, test_npo_admin_user: dict
    ) -> None:
        for title in ["First", "Second"]:
            await ChecklistService.create_item(
                db_session,
                test_event.id,
                ChecklistItemCreate(title=title),
                test_npo_admin_user,
            )

        result = await ChecklistService.get_event_checklist(db_session, test_event.id)
        assert result.items[0].display_order == 0
        assert result.items[1].display_order == 1

    async def test_update_item_title(
        self, db_session: AsyncSession, test_event: dict, test_npo_admin_user: dict
    ) -> None:
        item = await ChecklistService.create_item(
            db_session,
            test_event.id,
            ChecklistItemCreate(title="Old"),
            test_npo_admin_user,
        )
        updated = await ChecklistService.update_item(
            db_session, test_event.id, item.id, ChecklistItemUpdate(title="New")
        )
        assert updated.title == "New"

    async def test_update_due_date_clears_template_derived(
        self, db_session: AsyncSession, test_event: dict
    ) -> None:
        item = ChecklistItem(
            id=uuid.uuid4(),
            event_id=test_event.id,
            title="Template item",
            status=ChecklistItemStatus.NOT_COMPLETE,
            display_order=0,
            due_date_is_template_derived=True,
            offset_days=-30,
            created_by=test_event.created_by,
        )
        db_session.add(item)
        await db_session.commit()

        updated = await ChecklistService.update_item(
            db_session,
            test_event.id,
            item.id,
            ChecklistItemUpdate(due_date=date(2025, 8, 1)),
        )
        assert updated.due_date_is_template_derived is False
        assert updated.offset_days is None

    async def test_update_status_sets_completed_at(
        self, db_session: AsyncSession, test_event: dict
    ) -> None:
        item = ChecklistItem(
            id=uuid.uuid4(),
            event_id=test_event.id,
            title="Task",
            status=ChecklistItemStatus.NOT_COMPLETE,
            display_order=0,
            due_date_is_template_derived=False,
            created_by=test_event.created_by,
        )
        db_session.add(item)
        await db_session.commit()

        updated = await ChecklistService.update_item_status(
            db_session,
            test_event.id,
            item.id,
            ChecklistItemStatusUpdate(status="complete"),
        )
        assert updated.status == ChecklistItemStatus.COMPLETE
        assert updated.completed_at is not None

    async def test_update_status_clears_completed_at(
        self, db_session: AsyncSession, test_event: dict
    ) -> None:
        item = ChecklistItem(
            id=uuid.uuid4(),
            event_id=test_event.id,
            title="Done task",
            status=ChecklistItemStatus.COMPLETE,
            display_order=0,
            due_date_is_template_derived=False,
            completed_at=datetime.now(UTC),
            created_by=test_event.created_by,
        )
        db_session.add(item)
        await db_session.commit()

        updated = await ChecklistService.update_item_status(
            db_session,
            test_event.id,
            item.id,
            ChecklistItemStatusUpdate(status="not_complete"),
        )
        assert updated.status == ChecklistItemStatus.NOT_COMPLETE
        assert updated.completed_at is None

    async def test_delete_item(self, db_session: AsyncSession, test_event: dict) -> None:
        item = ChecklistItem(
            id=uuid.uuid4(),
            event_id=test_event.id,
            title="Delete me",
            status=ChecklistItemStatus.NOT_COMPLETE,
            display_order=0,
            due_date_is_template_derived=False,
            created_by=test_event.created_by,
        )
        db_session.add(item)
        await db_session.commit()

        await ChecklistService.delete_item(db_session, test_event.id, item.id)

        result = await ChecklistService.get_event_checklist(db_session, test_event.id)
        assert result.total_count == 0

    async def test_delete_nonexistent_item_raises(
        self, db_session: AsyncSession, test_event: dict
    ) -> None:
        from fastapi import HTTPException

        with pytest.raises(HTTPException, match="404"):
            await ChecklistService.delete_item(db_session, test_event.id, uuid.uuid4())

    async def test_reorder_items(self, db_session: AsyncSession, test_event: dict) -> None:
        items = []
        for i, title in enumerate(["A", "B", "C"]):
            item = ChecklistItem(
                id=uuid.uuid4(),
                event_id=test_event.id,
                title=title,
                status=ChecklistItemStatus.NOT_COMPLETE,
                display_order=i,
                due_date_is_template_derived=False,
                created_by=test_event.created_by,
            )
            db_session.add(item)
            items.append(item)
        await db_session.commit()

        # Reverse order
        await ChecklistService.reorder_items(
            db_session,
            test_event.id,
            [items[2].id, items[1].id, items[0].id],
        )

        result = await ChecklistService.get_event_checklist(db_session, test_event.id)
        assert result.items[0].title == "C"
        assert result.items[1].title == "B"
        assert result.items[2].title == "A"


@pytest.mark.asyncio
class TestChecklistServiceTemplates:
    """Tests for template operations."""

    async def test_resolve_default_template_npo(
        self, db_session: AsyncSession, test_approved_npo: dict
    ) -> None:
        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_approved_npo.id,
            name="NPO Default",
            is_default=True,
            is_system_default=False,
        )
        db_session.add(template)
        # Also add a template item so items relationship exists
        await db_session.flush()
        tmpl_item = ChecklistTemplateItem(
            id=uuid.uuid4(),
            template_id=template.id,
            title="Step 1",
            offset_days=-7,
            display_order=0,
        )
        db_session.add(tmpl_item)
        await db_session.commit()

        result = await ChecklistService.resolve_default_template(db_session, test_approved_npo.id)
        assert result is not None
        assert result.name == "NPO Default"

    async def test_resolve_default_template_falls_back_to_system(
        self, db_session: AsyncSession, test_approved_npo: dict
    ) -> None:
        system_template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=None,
            name="System Default",
            is_default=False,
            is_system_default=True,
        )
        db_session.add(system_template)
        await db_session.flush()
        tmpl_item = ChecklistTemplateItem(
            id=uuid.uuid4(),
            template_id=system_template.id,
            title="System Step",
            offset_days=-14,
            display_order=0,
        )
        db_session.add(tmpl_item)
        await db_session.commit()

        result = await ChecklistService.resolve_default_template(db_session, test_approved_npo.id)
        assert result is not None
        assert result.is_system_default is True

    async def test_resolve_default_template_none(
        self, db_session: AsyncSession, test_approved_npo: dict
    ) -> None:
        result = await ChecklistService.resolve_default_template(db_session, test_approved_npo.id)
        assert result is None

    async def test_populate_from_template(
        self,
        db_session: AsyncSession,
        test_event: dict,
        test_npo_admin_user: dict,
    ) -> None:
        from sqlalchemy.orm import selectinload

        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_event.npo_id,
            name="Gala Template",
            is_default=False,
            is_system_default=False,
        )
        db_session.add(template)
        await db_session.flush()

        for i, (title, offset) in enumerate(
            [("Book venue", -90), ("Send invites", -30), ("Final walkthrough", -1)]
        ):
            tmpl_item = ChecklistTemplateItem(
                id=uuid.uuid4(),
                template_id=template.id,
                title=title,
                offset_days=offset,
                display_order=i,
            )
            db_session.add(tmpl_item)
        await db_session.commit()

        # Reload with items eagerly loaded for async context
        from sqlalchemy import select

        result = await db_session.execute(
            select(ChecklistTemplate)
            .where(ChecklistTemplate.id == template.id)
            .options(selectinload(ChecklistTemplate.items))
        )
        template = result.scalar_one()

        items = await ChecklistService.populate_from_template(
            db_session, test_event, template, test_npo_admin_user.id
        )
        assert len(items) == 3
        assert items[0].title == "Book venue"
        assert items[0].due_date_is_template_derived is True
        assert items[0].offset_days == -90

    async def test_recalculate_template_dates(
        self, db_session: AsyncSession, test_event: dict
    ) -> None:
        item = ChecklistItem(
            id=uuid.uuid4(),
            event_id=test_event.id,
            title="Template item",
            status=ChecklistItemStatus.NOT_COMPLETE,
            display_order=0,
            due_date_is_template_derived=True,
            offset_days=-30,
            due_date=date(2025, 1, 1),  # will be recalculated
            created_by=test_event.created_by,
        )
        db_session.add(item)
        await db_session.commit()

        count = await ChecklistService.recalculate_template_dates(db_session, test_event)
        assert count == 1

        await db_session.refresh(item)
        # Due date should be event date - 30 days
        from zoneinfo import ZoneInfo

        expected_event_date = test_event.event_datetime.astimezone(
            ZoneInfo(test_event.timezone)
        ).date()
        assert item.due_date == expected_event_date + timedelta(days=-30)

    async def test_list_templates(self, db_session: AsyncSession, test_approved_npo: dict) -> None:
        for name in ["Template A", "Template B"]:
            db_session.add(
                ChecklistTemplate(
                    id=uuid.uuid4(),
                    npo_id=test_approved_npo.id,
                    name=name,
                    is_default=False,
                    is_system_default=False,
                )
            )
        await db_session.commit()

        result = await ChecklistService.list_templates(db_session, test_approved_npo.id)
        names = [t.name for t in result]
        assert "Template A" in names
        assert "Template B" in names

    async def test_update_template_name(
        self, db_session: AsyncSession, test_approved_npo: dict
    ) -> None:
        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_approved_npo.id,
            name="Old Name",
            is_default=False,
            is_system_default=False,
        )
        db_session.add(template)
        await db_session.commit()

        updated = await ChecklistService.update_template(
            db_session,
            test_approved_npo.id,
            template.id,
            ChecklistTemplateUpdate(name="New Name"),
        )
        assert updated.name == "New Name"

    async def test_cannot_update_system_default_template(
        self, db_session: AsyncSession, test_approved_npo: dict
    ) -> None:
        from fastapi import HTTPException

        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=None,
            name="System Default",
            is_default=False,
            is_system_default=True,
        )
        db_session.add(template)
        await db_session.commit()

        with pytest.raises(HTTPException, match="400"):
            await ChecklistService.update_template(
                db_session,
                test_approved_npo.id,
                template.id,
                ChecklistTemplateUpdate(name="Hacked"),
            )

    async def test_delete_template(self, db_session: AsyncSession, test_approved_npo: dict) -> None:
        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_approved_npo.id,
            name="Delete Me",
            is_default=False,
            is_system_default=False,
        )
        db_session.add(template)
        await db_session.commit()

        await ChecklistService.delete_template(db_session, test_approved_npo.id, template.id)

        result = await ChecklistService.list_templates(db_session, test_approved_npo.id)
        assert all(t.name != "Delete Me" for t in result)

    async def test_cannot_delete_system_default_template(
        self, db_session: AsyncSession, test_approved_npo: dict
    ) -> None:
        from fastapi import HTTPException

        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=None,
            name="System Default",
            is_default=False,
            is_system_default=True,
        )
        db_session.add(template)
        await db_session.commit()

        with pytest.raises(HTTPException, match="400"):
            await ChecklistService.delete_template(db_session, test_approved_npo.id, template.id)

    async def test_set_default_template(
        self, db_session: AsyncSession, test_approved_npo: dict
    ) -> None:
        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_approved_npo.id,
            name="My Default",
            is_default=False,
            is_system_default=False,
        )
        db_session.add(template)
        await db_session.commit()

        result = await ChecklistService.set_default_template(
            db_session, test_approved_npo.id, template.id
        )
        assert result.is_default is True

    async def test_set_default_unsets_previous(
        self, db_session: AsyncSession, test_approved_npo: dict
    ) -> None:
        from sqlalchemy import select

        old_default = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_approved_npo.id,
            name="Old Default",
            is_default=True,
            is_system_default=False,
        )
        new_default = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_approved_npo.id,
            name="New Default",
            is_default=False,
            is_system_default=False,
        )
        db_session.add_all([old_default, new_default])
        await db_session.commit()

        await ChecklistService.set_default_template(
            db_session, test_approved_npo.id, new_default.id
        )

        # Re-query to check old default was unset
        result = await db_session.execute(
            select(ChecklistTemplate).where(ChecklistTemplate.id == old_default.id)
        )
        refreshed_old = result.scalar_one()
        assert refreshed_old.is_default is False
