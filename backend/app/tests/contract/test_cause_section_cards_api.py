"""Contract tests for cause section card endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


def _card_identity(card: dict) -> str:
    return "|".join(
        [
            card["card_type"],
            card.get("built_in_section_key") or "",
            card.get("title") or "",
        ]
    )


@pytest.mark.asyncio
class TestCauseSectionCardConfig:
    async def test_get_config_seeds_built_in_cards(
        self,
        npo_admin_client: AsyncClient,
        test_event: object,
    ) -> None:
        event_id = str(test_event.id)  # type: ignore[attr-defined]

        config_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{event_id}/cause-page/config"
        )
        assert config_response.status_code == 200
        config_data = config_response.json()
        assert config_data["draft_version"] == 1
        assert config_data["published_version"] == 0

        cards_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{event_id}/cause-page/cards"
        )
        assert cards_response.status_code == 200
        cards = cards_response.json()
        assert [card["built_in_section_key"] for card in cards] == [
            "about",
            "sponsors",
            "event_details",
        ]


@pytest.mark.asyncio
class TestCauseSectionCardMutations:
    async def test_reorder_cards_persists_through_publish_and_refresh(
        self,
        npo_admin_client: AsyncClient,
        test_event: object,
    ) -> None:
        event_id = str(test_event.id)  # type: ignore[attr-defined]

        first_create = await npo_admin_client.post(
            f"/api/v1/admin/events/{event_id}/cause-page/cards",
            json={
                "draft_version": 1,
                "card_type": "text",
                "title": "First",
                "show_header": True,
                "content_html": "<p>First</p>",
            },
        )
        assert first_create.status_code == 201

        second_create = await npo_admin_client.post(
            f"/api/v1/admin/events/{event_id}/cause-page/cards",
            json={
                "draft_version": 2,
                "card_type": "text",
                "title": "Second",
                "show_header": True,
                "content_html": "<p>Second</p>",
            },
        )
        assert second_create.status_code == 201

        cards_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{event_id}/cause-page/cards"
        )
        assert cards_response.status_code == 200
        cards = cards_response.json()
        desired_order = [_card_identity(card) for card in reversed(cards)]
        requested_order_ids = [card["id"] for card in reversed(cards)]

        reorder_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/cause-page/cards/reorder",
            json={"draft_version": 3, "card_ids": requested_order_ids},
        )
        assert reorder_response.status_code == 200
        assert [_card_identity(card) for card in reorder_response.json()] == desired_order

        publish_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{event_id}/cause-page/publish",
            json={"draft_version": 4},
        )
        assert publish_response.status_code == 200
        assert publish_response.json()["published_version"] == 4

        refreshed_cards_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{event_id}/cause-page/cards"
        )
        assert refreshed_cards_response.status_code == 200
        assert [_card_identity(card) for card in refreshed_cards_response.json()] == desired_order

    async def test_preview_returns_current_draft_card_order(
        self,
        client: AsyncClient,
        npo_admin_client: AsyncClient,
        test_event: object,
    ) -> None:
        event_id = str(test_event.id)  # type: ignore[attr-defined]

        first_create = await npo_admin_client.post(
            f"/api/v1/admin/events/{event_id}/cause-page/cards",
            json={
                "draft_version": 1,
                "card_type": "text",
                "title": "First Preview Card",
                "show_header": True,
                "content_html": "<p>First Preview Card</p>",
            },
        )
        assert first_create.status_code == 201

        second_create = await npo_admin_client.post(
            f"/api/v1/admin/events/{event_id}/cause-page/cards",
            json={
                "draft_version": 2,
                "card_type": "text",
                "title": "Second Preview Card",
                "show_header": True,
                "content_html": "<p>Second Preview Card</p>",
            },
        )
        assert second_create.status_code == 201

        cards_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{event_id}/cause-page/cards"
        )
        assert cards_response.status_code == 200
        cards = cards_response.json()
        desired_order = [_card_identity(card) for card in reversed(cards)]
        requested_order_ids = [card["id"] for card in reversed(cards)]

        reorder_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/cause-page/cards/reorder",
            json={"draft_version": 3, "card_ids": requested_order_ids},
        )
        assert reorder_response.status_code == 200

        token_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{event_id}/preview-token"
        )
        assert token_response.status_code == 200
        token = token_response.json()["token"]

        preview_response = await client.get(
            f"/api/v1/events/preview/{event_id}",
            params={"token": token},
        )
        assert preview_response.status_code == 200
        preview_cards = preview_response.json()["cause_page_cards"]
        assert [_card_identity(card) for card in preview_cards] == desired_order

    async def test_create_publish_and_read_public_cards(
        self,
        client: AsyncClient,
        npo_admin_client: AsyncClient,
        test_event: object,
    ) -> None:
        event_id = str(test_event.id)  # type: ignore[attr-defined]

        create_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{event_id}/cause-page/cards",
            json={
                "draft_version": 1,
                "card_type": "text",
                "title": "Mission Impact",
                "show_header": True,
                "content_html": "<p>Help families thrive.</p><script>alert('x')</script>",
            },
        )
        assert create_response.status_code == 201
        created_card = create_response.json()
        assert created_card["card_type"] == "text"
        assert "<script" not in (created_card["content_html"] or "")

        unpublished_response = await client.get(f"/api/v1/events/{event_id}/cause-page/cards")
        assert unpublished_response.status_code == 200
        assert unpublished_response.json() == []

        publish_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{event_id}/cause-page/publish",
            json={"draft_version": 2},
        )
        assert publish_response.status_code == 200
        assert publish_response.json()["published_version"] == 2

        public_response = await client.get(f"/api/v1/events/{event_id}/cause-page/cards")
        assert public_response.status_code == 200
        public_cards = public_response.json()
        text_cards = [card for card in public_cards if card["card_type"] == "text"]
        assert len(text_cards) == 1
        assert "Help families thrive." in (text_cards[0]["content_html"] or "")

    async def test_delete_built_in_card_rejected(
        self,
        npo_admin_client: AsyncClient,
        test_event: object,
    ) -> None:
        event_id = str(test_event.id)  # type: ignore[attr-defined]

        cards_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{event_id}/cause-page/cards"
        )
        assert cards_response.status_code == 200
        built_in_card = cards_response.json()[0]

        delete_response = await npo_admin_client.request(
            "DELETE",
            f"/api/v1/admin/events/{event_id}/cause-page/cards/{built_in_card['id']}",
            json={"draft_version": 1},
        )
        assert delete_response.status_code == 422
        assert delete_response.json()["detail"]["message"] == "Built-in cards cannot be deleted"

    async def test_update_card_with_stale_version_returns_conflict(
        self,
        npo_admin_client: AsyncClient,
        test_event: object,
    ) -> None:
        event_id = str(test_event.id)  # type: ignore[attr-defined]

        create_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{event_id}/cause-page/cards",
            json={
                "draft_version": 1,
                "card_type": "text",
                "title": "Draft Card",
                "content_html": "<p>First draft</p>",
            },
        )
        assert create_response.status_code == 201
        card_id = create_response.json()["id"]

        stale_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/cause-page/cards/{card_id}",
            json={
                "draft_version": 1,
                "title": "Outdated Save",
            },
        )
        assert stale_response.status_code == 409
        detail = stale_response.json()["detail"]
        assert detail["current_draft_version"] == 2
        assert detail["requested_draft_version"] == 1


@pytest.mark.asyncio
class TestCauseSectionSlideNames:
    async def test_slide_name_can_be_created_and_updated(
        self,
        npo_admin_client: AsyncClient,
        test_event: object,
    ) -> None:
        event_id = str(test_event.id)  # type: ignore[attr-defined]

        create_card_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{event_id}/cause-page/cards",
            json={
                "draft_version": 1,
                "card_type": "slideshow",
                "title": "Story Slides",
            },
        )
        assert create_card_response.status_code == 201
        card_id = create_card_response.json()["id"]

        create_slide_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{event_id}/cause-page/cards/{card_id}/slides",
            json={
                "draft_version": 2,
                "slide_variant": "image_only",
                "media_url": "https://example.com/slide-1.jpg",
                "media_source": "external",
                "slide_name": "Opening Slide",
                "alt_text": "Opening hero image",
                "overlay_html": "<p>Welcome</p>",
            },
        )
        assert create_slide_response.status_code == 201
        created_slide = create_slide_response.json()
        assert created_slide["slide_name"] == "Opening Slide"

        update_slide_response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{event_id}/cause-page/cards/{created_slide['card_id']}/slides/{created_slide['id']}",
            json={
                "draft_version": 3,
                "slide_name": "Updated Opening Slide",
            },
        )
        assert update_slide_response.status_code == 200
        updated_slide = update_slide_response.json()
        assert updated_slide["slide_name"] == "Updated Opening Slide"

        cards_response = await npo_admin_client.get(
            f"/api/v1/admin/events/{event_id}/cause-page/cards"
        )
        assert cards_response.status_code == 200
        slideshow_cards = [
            card for card in cards_response.json() if card["card_type"] == "slideshow"
        ]
        assert len(slideshow_cards) == 1
        assert slideshow_cards[0]["slides"][0]["slide_name"] == "Updated Opening Slide"
