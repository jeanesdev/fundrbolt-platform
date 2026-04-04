"""Contract tests for admin checklist API endpoints."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checklist import (
    ChecklistItem,
    ChecklistItemStatus,
    ChecklistTemplate,
    ChecklistTemplateItem,
)


@pytest.mark.asyncio
class TestGetEventChecklist:
    """Tests for GET /api/v1/admin/events/{event_id}/checklist."""

    async def test_get_empty_checklist(
        self, npo_admin_client: AsyncClient, test_event: dict
    ) -> None:
        response = await npo_admin_client.get(f"/api/v1/admin/events/{test_event.id}/checklist")
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total_count"] == 0
        assert data["completed_count"] == 0
        assert data["progress_percentage"] == 0.0

    async def test_get_checklist_with_items(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        item = ChecklistItem(
            id=uuid.uuid4(),
            event_id=test_event.id,
            title="Book venue",
            status=ChecklistItemStatus.COMPLETE,
            display_order=0,
            due_date_is_template_derived=False,
            created_by=test_event.created_by,
        )
        db_session.add(item)
        await db_session.commit()

        response = await npo_admin_client.get(f"/api/v1/admin/events/{test_event.id}/checklist")
        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 1
        assert data["completed_count"] == 1
        assert data["items"][0]["title"] == "Book venue"

    async def test_unauthenticated(self, client: AsyncClient, test_event: dict) -> None:
        response = await client.get(f"/api/v1/admin/events/{test_event.id}/checklist")
        assert response.status_code == 401

    async def test_donor_forbidden(self, donor_client: AsyncClient, test_event: dict) -> None:
        response = await donor_client.get(f"/api/v1/admin/events/{test_event.id}/checklist")
        assert response.status_code == 403


@pytest.mark.asyncio
class TestCreateChecklistItem:
    """Tests for POST /api/v1/admin/events/{event_id}/checklist."""

    async def test_create_item(self, npo_admin_client: AsyncClient, test_event: dict) -> None:
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/checklist",
            json={"title": "Book venue", "due_date": "2025-06-01"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Book venue"
        assert data["due_date"] == "2025-06-01"
        assert data["status"] == "not_complete"
        assert data["display_order"] == 0

    async def test_create_item_without_date(
        self, npo_admin_client: AsyncClient, test_event: dict
    ) -> None:
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/checklist",
            json={"title": "Send invitations"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["due_date"] is None

    async def test_create_item_increments_display_order(
        self, npo_admin_client: AsyncClient, test_event: dict
    ) -> None:
        await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/checklist",
            json={"title": "First"},
        )
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/checklist",
            json={"title": "Second"},
        )
        assert response.status_code == 201
        assert response.json()["display_order"] == 1

    async def test_create_item_unauthenticated(self, client: AsyncClient, test_event: dict) -> None:
        response = await client.post(
            f"/api/v1/admin/events/{test_event.id}/checklist",
            json={"title": "Test"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestUpdateChecklistItem:
    """Tests for PATCH /api/v1/admin/events/{event_id}/checklist/{item_id}."""

    async def test_update_title(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        item = ChecklistItem(
            id=uuid.uuid4(),
            event_id=test_event.id,
            title="Old title",
            status=ChecklistItemStatus.NOT_COMPLETE,
            display_order=0,
            due_date_is_template_derived=False,
            created_by=test_event.created_by,
        )
        db_session.add(item)
        await db_session.commit()

        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/checklist/{item.id}",
            json={"title": "New title"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "New title"

    async def test_update_clears_template_derived_flag(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
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

        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/checklist/{item.id}",
            json={"due_date": "2025-08-01"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["due_date_is_template_derived"] is False
        assert data["offset_days"] is None

    async def test_update_nonexistent_item(
        self, npo_admin_client: AsyncClient, test_event: dict
    ) -> None:
        fake_id = str(uuid.uuid4())
        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/checklist/{fake_id}",
            json={"title": "X"},
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestUpdateChecklistItemStatus:
    """Tests for PATCH /api/v1/admin/events/{event_id}/checklist/{item_id}/status."""

    async def test_set_complete(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
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

        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/checklist/{item.id}/status",
            json={"status": "complete"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "complete"
        assert data["completed_at"] is not None

    async def test_unset_complete_clears_completed_at(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        from datetime import UTC, datetime

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

        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/checklist/{item.id}/status",
            json={"status": "in_progress"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"
        assert data["completed_at"] is None


@pytest.mark.asyncio
class TestDeleteChecklistItem:
    """Tests for DELETE /api/v1/admin/events/{event_id}/checklist/{item_id}."""

    async def test_delete_item(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        item = ChecklistItem(
            id=uuid.uuid4(),
            event_id=test_event.id,
            title="To delete",
            status=ChecklistItemStatus.NOT_COMPLETE,
            display_order=0,
            due_date_is_template_derived=False,
            created_by=test_event.created_by,
        )
        db_session.add(item)
        await db_session.commit()

        response = await npo_admin_client.delete(
            f"/api/v1/admin/events/{test_event.id}/checklist/{item.id}"
        )
        assert response.status_code == 204

    async def test_delete_nonexistent_item(
        self, npo_admin_client: AsyncClient, test_event: dict
    ) -> None:
        fake_id = str(uuid.uuid4())
        response = await npo_admin_client.delete(
            f"/api/v1/admin/events/{test_event.id}/checklist/{fake_id}"
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestReorderChecklistItems:
    """Tests for PATCH /api/v1/admin/events/{event_id}/checklist/reorder."""

    async def test_reorder(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
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
        new_order = [str(items[2].id), str(items[1].id), str(items[0].id)]
        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/checklist/reorder",
            json={"item_ids": new_order},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["items"][0]["title"] == "C"
        assert data["items"][1]["title"] == "B"
        assert data["items"][2]["title"] == "A"


@pytest.mark.asyncio
class TestApplyTemplate:
    """Tests for POST /api/v1/admin/events/{event_id}/checklist/apply-template."""

    async def test_apply_template_replace_mode(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        # Create existing item
        existing = ChecklistItem(
            id=uuid.uuid4(),
            event_id=test_event.id,
            title="Existing item",
            status=ChecklistItemStatus.NOT_COMPLETE,
            display_order=0,
            due_date_is_template_derived=False,
            created_by=test_event.created_by,
        )
        db_session.add(existing)

        # Create template
        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_event.npo_id,
            name="Test Template",
            is_default=False,
            is_system_default=False,
            created_by=test_event.created_by,
        )
        db_session.add(template)
        await db_session.flush()

        tmpl_item = ChecklistTemplateItem(
            id=uuid.uuid4(),
            template_id=template.id,
            title="Template task",
            offset_days=-14,
            display_order=0,
        )
        db_session.add(tmpl_item)
        await db_session.commit()

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/checklist/apply-template",
            json={"template_id": str(template.id), "mode": "replace"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 1
        assert data["items"][0]["title"] == "Template task"

    async def test_apply_template_append_mode(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        # Create existing item
        existing = ChecklistItem(
            id=uuid.uuid4(),
            event_id=test_event.id,
            title="Keep me",
            status=ChecklistItemStatus.NOT_COMPLETE,
            display_order=0,
            due_date_is_template_derived=False,
            created_by=test_event.created_by,
        )
        db_session.add(existing)

        # Create template
        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_event.npo_id,
            name="Append Template",
            is_default=False,
            is_system_default=False,
            created_by=test_event.created_by,
        )
        db_session.add(template)
        await db_session.flush()

        tmpl_item = ChecklistTemplateItem(
            id=uuid.uuid4(),
            template_id=template.id,
            title="Appended task",
            offset_days=None,
            display_order=0,
        )
        db_session.add(tmpl_item)
        await db_session.commit()

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/checklist/apply-template",
            json={"template_id": str(template.id), "mode": "append"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 2
        titles = [i["title"] for i in data["items"]]
        assert "Keep me" in titles
        assert "Appended task" in titles


@pytest.mark.asyncio
class TestSaveAsTemplate:
    """Tests for POST /api/v1/admin/events/{event_id}/checklist/save-as-template."""

    async def test_save_checklist_as_template(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        item = ChecklistItem(
            id=uuid.uuid4(),
            event_id=test_event.id,
            title="My task",
            status=ChecklistItemStatus.NOT_COMPLETE,
            display_order=0,
            due_date_is_template_derived=False,
            created_by=test_event.created_by,
        )
        db_session.add(item)
        await db_session.commit()

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/checklist/save-as-template",
            json={"name": "My Saved Template"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Saved Template"
        assert data["item_count"] == 1

    async def test_save_duplicate_name_fails(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        # Create an existing template
        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_event.npo_id,
            name="Duplicate Name",
            is_default=False,
            is_system_default=False,
            created_by=test_event.created_by,
        )
        db_session.add(template)

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

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/checklist/save-as-template",
            json={"name": "Duplicate Name"},
        )
        assert response.status_code == 400


@pytest.mark.asyncio
class TestNpoTemplateEndpoints:
    """Tests for NPO template management endpoints."""

    async def test_list_templates(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: dict,
        db_session: AsyncSession,
    ) -> None:
        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_approved_npo.id,
            name="My Template",
            is_default=False,
            is_system_default=False,
        )
        db_session.add(template)
        await db_session.commit()

        response = await npo_admin_client.get(
            f"/api/v1/admin/npos/{test_approved_npo.id}/checklist-templates"
        )
        assert response.status_code == 200
        data = response.json()
        assert any(t["name"] == "My Template" for t in data)

    async def test_get_template_detail(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: dict,
        db_session: AsyncSession,
    ) -> None:
        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_approved_npo.id,
            name="Detail Template",
            is_default=False,
            is_system_default=False,
        )
        db_session.add(template)
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

        response = await npo_admin_client.get(
            f"/api/v1/admin/npos/{test_approved_npo.id}/checklist-templates/{template.id}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Detail Template"
        assert len(data["items"]) == 1
        assert data["items"][0]["title"] == "Step 1"

    async def test_update_template_name(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: dict,
        db_session: AsyncSession,
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

        response = await npo_admin_client.patch(
            f"/api/v1/admin/npos/{test_approved_npo.id}/checklist-templates/{template.id}",
            json={"name": "New Name"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "New Name"

    async def test_cannot_update_system_default(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: dict,
        db_session: AsyncSession,
    ) -> None:
        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=None,
            name="System Default",
            is_default=False,
            is_system_default=True,
        )
        db_session.add(template)
        await db_session.commit()

        response = await npo_admin_client.patch(
            f"/api/v1/admin/npos/{test_approved_npo.id}/checklist-templates/{template.id}",
            json={"name": "Hacked Name"},
        )
        assert response.status_code == 400

    async def test_delete_template(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: dict,
        db_session: AsyncSession,
    ) -> None:
        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=test_approved_npo.id,
            name="Delete Me",
            is_default=False,
            is_system_default=False,
        )
        db_session.add(template)
        await db_session.commit()

        response = await npo_admin_client.delete(
            f"/api/v1/admin/npos/{test_approved_npo.id}/checklist-templates/{template.id}"
        )
        assert response.status_code == 204

    async def test_cannot_delete_system_default(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: dict,
        db_session: AsyncSession,
    ) -> None:
        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=None,
            name="System Default",
            is_default=False,
            is_system_default=True,
        )
        db_session.add(template)
        await db_session.commit()

        response = await npo_admin_client.delete(
            f"/api/v1/admin/npos/{test_approved_npo.id}/checklist-templates/{template.id}"
        )
        assert response.status_code == 400

    async def test_set_default_template(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: dict,
        db_session: AsyncSession,
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

        response = await npo_admin_client.post(
            f"/api/v1/admin/npos/{test_approved_npo.id}/checklist-templates/{template.id}/set-default"
        )
        assert response.status_code == 200
        assert response.json()["is_default"] is True

    async def test_set_default_unsets_previous(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: dict,
        db_session: AsyncSession,
    ) -> None:
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

        response = await npo_admin_client.post(
            f"/api/v1/admin/npos/{test_approved_npo.id}/checklist-templates/{new_default.id}/set-default"
        )
        assert response.status_code == 200
        assert response.json()["is_default"] is True

        # Verify old default was unset via API
        list_resp = await npo_admin_client.get(
            f"/api/v1/admin/npos/{test_approved_npo.id}/checklist-templates"
        )
        templates = list_resp.json()
        old = next(t for t in templates if t["name"] == "Old Default")
        assert old["is_default"] is False
