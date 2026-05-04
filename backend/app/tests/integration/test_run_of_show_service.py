"""Integration tests for RunOfShowService."""

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.run_of_show import RunOfShowItem, RunOfShowTemplate, RunOfShowTemplateItem
from app.schemas.run_of_show import RunOfShowItemCreate, RunOfShowItemUpdate
from app.services.run_of_show_service import RunOfShowService


def _make_item(test_event: dict, **kwargs: object) -> RunOfShowItem:
    """Create a RunOfShowItem with all required fields."""
    defaults: dict[str, object] = {
        "id": uuid.uuid4(),
        "event_id": test_event.id,
        "created_by": test_event.created_by,
        "is_complete": False,
        "donor_visible": True,
        "auctioneer_visible": True,
        "display_order": 0,
    }
    defaults.update(kwargs)
    return RunOfShowItem(**defaults)


@pytest.mark.asyncio
class TestRunOfShowServiceCreateItem:
    """Tests for RunOfShowService.create_item."""

    async def test_create_item_sets_display_order(
        self,
        db_session: AsyncSession,
        test_event: dict,
        test_npo_admin_user: dict,
    ) -> None:
        data = RunOfShowItemCreate(title="Welcome speech")
        item = await RunOfShowService.create_item(
            db_session, test_event.id, data, test_npo_admin_user
        )
        assert item.display_order == 0
        assert item.title == "Welcome speech"
        assert item.is_complete is False

    async def test_create_second_item_increments_order(
        self,
        db_session: AsyncSession,
        test_event: dict,
        test_npo_admin_user: dict,
    ) -> None:
        data1 = RunOfShowItemCreate(title="First")
        data2 = RunOfShowItemCreate(title="Second")
        await RunOfShowService.create_item(db_session, test_event.id, data1, test_npo_admin_user)
        item2 = await RunOfShowService.create_item(
            db_session, test_event.id, data2, test_npo_admin_user
        )
        assert item2.display_order == 1


@pytest.mark.asyncio
class TestRunOfShowServiceGetEventRos:
    """Tests for RunOfShowService.get_event_ros."""

    async def test_returns_all_items_for_admin(
        self,
        db_session: AsyncSession,
        test_event: dict,
    ) -> None:
        items = [_make_item(test_event, title=f"Item {i}", display_order=i) for i in range(3)]
        db_session.add_all(items)
        await db_session.commit()

        result = await RunOfShowService.get_event_ros(db_session, test_event.id)
        assert result.total_count == 3
        assert len(result.items) == 3

    async def test_filters_donor_visible(
        self,
        db_session: AsyncSession,
        test_event: dict,
    ) -> None:
        visible = _make_item(test_event, title="Donor visible", display_order=0, donor_visible=True)
        hidden = _make_item(
            test_event, title="Not for donors", display_order=1, donor_visible=False
        )
        db_session.add_all([visible, hidden])
        await db_session.commit()

        result = await RunOfShowService.get_event_ros(
            db_session, test_event.id, visibility_filter="donor"
        )
        assert result.total_count == 1
        assert result.items[0].title == "Donor visible"

    async def test_filters_auctioneer_visible(
        self,
        db_session: AsyncSession,
        test_event: dict,
    ) -> None:
        auctioneer_item = _make_item(
            test_event,
            title="Auctioneer visible",
            display_order=0,
            auctioneer_visible=True,
            donor_visible=False,
        )
        donor_item = _make_item(
            test_event,
            title="Donor only",
            display_order=1,
            auctioneer_visible=False,
            donor_visible=True,
        )
        db_session.add_all([auctioneer_item, donor_item])
        await db_session.commit()

        result = await RunOfShowService.get_event_ros(
            db_session, test_event.id, visibility_filter="auctioneer"
        )
        assert result.total_count == 1
        assert result.items[0].title == "Auctioneer visible"


@pytest.mark.asyncio
class TestRunOfShowServiceUpdateItem:
    """Tests for RunOfShowService.update_item."""

    async def test_update_title(
        self,
        db_session: AsyncSession,
        test_event: dict,
    ) -> None:
        item = _make_item(test_event, title="Old title")
        db_session.add(item)
        await db_session.commit()

        updated = await RunOfShowService.update_item(
            db_session, test_event.id, item.id, RunOfShowItemUpdate(title="New title")
        )
        assert updated.title == "New title"

    async def test_update_nonexistent_raises_404(
        self,
        db_session: AsyncSession,
        test_event: dict,
    ) -> None:
        with pytest.raises(HTTPException) as exc_info:
            await RunOfShowService.update_item(
                db_session,
                test_event.id,
                uuid.uuid4(),
                RunOfShowItemUpdate(title="Any"),
            )
        assert exc_info.value.status_code == 404


@pytest.mark.asyncio
class TestRunOfShowServiceMarkComplete:
    """Tests for RunOfShowService.mark_complete and mark_incomplete."""

    async def test_mark_complete(
        self,
        db_session: AsyncSession,
        test_event: dict,
    ) -> None:
        item = _make_item(test_event, title="Speech", is_complete=False)
        db_session.add(item)
        await db_session.commit()

        result = await RunOfShowService.mark_complete(db_session, test_event.id, item.id)
        assert result.is_complete is True

    async def test_mark_incomplete(
        self,
        db_session: AsyncSession,
        test_event: dict,
    ) -> None:
        item = _make_item(test_event, title="Speech", is_complete=True)
        db_session.add(item)
        await db_session.commit()

        result = await RunOfShowService.mark_incomplete(db_session, test_event.id, item.id)
        assert result.is_complete is False


@pytest.mark.asyncio
class TestRunOfShowServiceReorderItems:
    """Tests for RunOfShowService.reorder_items."""

    async def test_reorder_changes_display_order(
        self,
        db_session: AsyncSession,
        test_event: dict,
    ) -> None:
        item1 = _make_item(test_event, title="A", display_order=0)
        item2 = _make_item(test_event, title="B", display_order=1)
        db_session.add_all([item1, item2])
        await db_session.commit()

        await RunOfShowService.reorder_items(db_session, test_event.id, [item2.id, item1.id])

        result = await RunOfShowService.get_event_ros(db_session, test_event.id)
        assert result.items[0].title == "B"
        assert result.items[1].title == "A"


@pytest.mark.asyncio
class TestRunOfShowServiceApplyTemplate:
    """Tests for RunOfShowService.apply_template."""

    async def test_apply_template_requires_confirm_when_items_exist(
        self,
        db_session: AsyncSession,
        test_event: dict,
    ) -> None:
        template = RunOfShowTemplate(
            id=uuid.uuid4(),
            npo_id=None,
            name="Test Template",
            is_system_default=True,
        )
        db_session.add(template)

        item = _make_item(test_event, title="Existing")
        db_session.add(item)
        await db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await RunOfShowService.apply_template(
                db_session, test_event.id, template.id, confirm_replace=False
            )
        assert exc_info.value.status_code == 409

    async def test_apply_template_replaces_when_confirmed(
        self,
        db_session: AsyncSession,
        test_event: dict,
    ) -> None:
        template = RunOfShowTemplate(
            id=uuid.uuid4(),
            npo_id=None,
            name="Gala Template",
            is_system_default=True,
        )
        template_item = RunOfShowTemplateItem(
            id=uuid.uuid4(),
            template_id=template.id,
            title="Welcome",
            display_order=0,
            donor_visible_default=True,
            auctioneer_visible_default=True,
        )
        db_session.add_all([template, template_item])

        existing = _make_item(test_event, title="Old item")
        db_session.add(existing)
        await db_session.commit()

        result = await RunOfShowService.apply_template(
            db_session, test_event.id, template.id, confirm_replace=True
        )
        assert result.replaced is True

        ros = await RunOfShowService.get_event_ros(db_session, test_event.id)
        titles = [i.title for i in ros.items]
        assert "Old item" not in titles
        assert "Welcome" in titles
