"""Service helpers for event cause page cards."""

from __future__ import annotations

import ipaddress
import socket
import uuid
from datetime import UTC, datetime
from urllib.parse import urlparse

import bleach
from bleach.css_sanitizer import CSSSanitizer
from fastapi import HTTPException, status
from sqlalchemy import Select, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.event_media_urls import (
    extract_blob_name,
    get_media_variant_urls,
    get_signed_asset_url,
)
from app.models.cause_section_card import (
    CardTypeEnum,
    CauseSectionCard,
    CauseSectionCardRevision,
    CauseSectionSlideItem,
    EventCausePageConfig,
    MediaSourceEnum,
    RevisionActionEnum,
    SlideVariantEnum,
)
from app.schemas.cause_section_card import (
    CausePageConfigResponse,
    CauseSectionCardResponse,
    ConflictResponse,
    CreateCardRequest,
    CreateSlideRequest,
    PublicCauseSectionCardResponse,
    PublishRequest,
    ReorderRequest,
    RevisionResponse,
    SlideItemResponse,
    SlideReorderRequest,
    UpdateCardRequest,
    UpdateSlideRequest,
)

_ALLOWED_TAGS = [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "a",
    "span",
    "h1",
    "h2",
    "h3",
]
_ALLOWED_ATTRS = {"a": ["href", "title"], "span": ["style"], "p": ["style"]}
_ALLOWED_CSS = ["color", "font-family", "text-align", "font-weight"]
_CSS_SANITIZER = CSSSanitizer(allowed_css_properties=_ALLOWED_CSS)
_BUILT_IN_CARDS = (
    ("about", "About This Event"),
    ("sponsors", "Sponsors"),
    ("event_details", "Event Details"),
)


def sanitize_html(value: str | None) -> str | None:
    """Sanitize rich text HTML before persistence."""
    if not value:
        return None
    return (
        bleach.clean(
            value,
            tags=_ALLOWED_TAGS,
            attributes=_ALLOWED_ATTRS,
            css_sanitizer=_CSS_SANITIZER,
            strip=True,
        ).strip()
        or None
    )


def validate_external_url(url: str | None) -> str | None:
    """Reject unsafe external URLs without making an outbound HTTP request."""
    if not url:
        return None

    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("External media URLs must use HTTPS")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: missing hostname")

    try:
        addr = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(addr)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise ValueError("External media URLs must not resolve to private/loopback addresses")
    except socket.gaierror:
        pass

    return url


async def get_or_create_config(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> EventCausePageConfig:
    """Get or create cause page config and seed built-in cards."""
    result = await db.execute(
        select(EventCausePageConfig).where(EventCausePageConfig.event_id == event_id)
    )
    config = result.scalar_one_or_none()
    if config is not None:
        return config

    config = EventCausePageConfig(
        id=uuid.uuid4(),
        event_id=event_id,
        draft_version=1,
        published_version=0,
    )
    db.add(config)

    for display_order, (built_in_key, title) in enumerate(_BUILT_IN_CARDS):
        db.add(
            CauseSectionCard(
                id=uuid.uuid4(),
                event_id=event_id,
                draft_version=1,
                card_type=CardTypeEnum.BUILT_IN,
                built_in_section_key=built_in_key,
                display_order=display_order,
                is_enabled=True,
                title=title,
                show_header=False,
                is_collapsible=False,
            )
        )

    await db.commit()
    await db.refresh(config)
    return config


async def list_draft_cards(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> list[CauseSectionCard]:
    """Return the current draft cards."""
    config = await get_or_create_config(db, event_id)
    return await _get_cards_for_version(db, event_id, config.draft_version)


async def list_revisions(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> list[CauseSectionCardRevision]:
    """Return revisions newest-first."""
    result = await db.execute(
        select(CauseSectionCardRevision)
        .where(CauseSectionCardRevision.event_id == event_id)
        .order_by(CauseSectionCardRevision.changed_at.desc())
    )
    return list(result.scalars().all())


async def get_public_cards(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> list[CauseSectionCard]:
    """Return the published, enabled cards for donor views."""
    result = await db.execute(
        select(EventCausePageConfig).where(EventCausePageConfig.event_id == event_id)
    )
    config = result.scalar_one_or_none()
    if config is None or config.published_version <= 0:
        return []

    cards_result = await db.execute(
        _cards_for_version_stmt(event_id, config.published_version).where(
            CauseSectionCard.is_enabled.is_(True)
        )
    )
    return list(cards_result.scalars().all())


async def get_card_slides(
    db: AsyncSession,
    event_id: uuid.UUID,
    card_id: uuid.UUID,
) -> list[CauseSectionSlideItem]:
    """Return slides for a current draft card."""
    config = await get_or_create_config(db, event_id)
    card = await _get_card_for_version(db, event_id, config.draft_version, card_id)
    return list(card.slides)


async def create_card(
    db: AsyncSession,
    event_id: uuid.UUID,
    request: CreateCardRequest,
    user_id: uuid.UUID,
) -> CauseSectionCard:
    """Create a new custom card with copy-on-write versioning."""
    config = await _get_locked_config(db, event_id)
    await _ensure_version(db, event_id, config, request.draft_version)

    new_version, _, _, cloned_cards = await _copy_on_write(db, event_id, config)
    new_card = CauseSectionCard(
        id=uuid.uuid4(),
        event_id=event_id,
        draft_version=new_version,
        card_type=request.card_type,
        display_order=len(cloned_cards),
        is_enabled=request.is_enabled,
        title=request.title,
        show_header=request.show_header,
        is_collapsible=request.is_collapsible,
        background_color_token=request.background_color_token,
        border_color_token=request.border_color_token,
    )
    _apply_card_create_payload(new_card, request)
    db.add(new_card)

    await _record_revision(
        db,
        event_id=event_id,
        user_id=user_id,
        action=RevisionActionEnum.DRAFT_SAVED,
        draft_version=new_version,
        change_summary={
            "operation": "create_card",
            "card_type": request.card_type.value,
            "title": request.title,
        },
    )
    await db.commit()
    return await _get_card_for_version(db, event_id, new_version, new_card.id)


async def update_card(
    db: AsyncSession,
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    request: UpdateCardRequest,
    user_id: uuid.UUID,
) -> CauseSectionCard:
    """Update a draft card via copy-on-write."""
    config = await _get_locked_config(db, event_id)
    await _ensure_version(db, event_id, config, request.draft_version)
    current_card = await _get_card_for_version(db, event_id, config.draft_version, card_id)

    new_version, card_map, _, _ = await _copy_on_write(db, event_id, config)
    updated_card = card_map.get(card_id)
    if updated_card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    _apply_card_update_payload(updated_card, current_card.card_type, request)
    await _record_revision(
        db,
        event_id=event_id,
        user_id=user_id,
        action=RevisionActionEnum.DRAFT_SAVED,
        draft_version=new_version,
        change_summary={
            "operation": "update_card",
            "card_id": str(card_id),
        },
    )
    await db.commit()
    return await _get_card_for_version(db, event_id, new_version, updated_card.id)


async def delete_card(
    db: AsyncSession,
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    request_version: int,
    user_id: uuid.UUID,
) -> None:
    """Delete a non-built-in card via copy-on-write."""
    config = await _get_locked_config(db, event_id)
    await _ensure_version(db, event_id, config, request_version)
    current_card = await _get_card_for_version(db, event_id, config.draft_version, card_id)
    if current_card.card_type == CardTypeEnum.BUILT_IN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Built-in cards cannot be deleted",
        )

    new_version, card_map, _, _ = await _copy_on_write(db, event_id, config)
    new_card = card_map.get(card_id)
    if new_card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    await db.delete(new_card)
    await db.flush()
    await _renumber_cards(db, event_id, new_version)
    await _record_revision(
        db,
        event_id=event_id,
        user_id=user_id,
        action=RevisionActionEnum.DRAFT_SAVED,
        draft_version=new_version,
        change_summary={
            "operation": "delete_card",
            "card_id": str(card_id),
        },
    )
    await db.commit()


async def reorder_cards(
    db: AsyncSession,
    event_id: uuid.UUID,
    request: ReorderRequest,
    user_id: uuid.UUID,
) -> list[CauseSectionCard]:
    """Reorder cards in the current draft."""
    config = await _get_locked_config(db, event_id)
    await _ensure_version(db, event_id, config, request.draft_version)
    current_cards = await _get_cards_for_version(db, event_id, config.draft_version)
    current_ids = {card.id for card in current_cards}
    requested_ids = list(request.card_ids)
    if current_ids != set(requested_ids) or len(current_ids) != len(requested_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Card reorder payload must include each current draft card exactly once",
        )

    new_version, card_map, _, _ = await _copy_on_write(db, event_id, config)
    temp_order_base = max(card.display_order for card in current_cards) + len(requested_ids) + 1
    ordered_cards = [card_map[card_id] for card_id in requested_ids]
    for index, card_id in enumerate(requested_ids):
        await db.execute(
            text("UPDATE cause_section_cards SET display_order = :temp_order WHERE id = :card_id"),
            {"temp_order": temp_order_base + index, "card_id": card_map[card_id].id},
        )

    for index, card_id in enumerate(requested_ids):
        await db.execute(
            text(
                "UPDATE cause_section_cards SET display_order = :final_order, updated_at = now() WHERE id = :card_id"
            ),
            {"final_order": index, "card_id": card_map[card_id].id},
        )

    for card in ordered_cards:
        await db.refresh(card)

    await _record_revision(
        db,
        event_id=event_id,
        user_id=user_id,
        action=RevisionActionEnum.DRAFT_SAVED,
        draft_version=new_version,
        change_summary={
            "operation": "reorder_cards",
            "card_ids": [str(card_id) for card_id in requested_ids],
        },
    )
    await db.commit()
    return ordered_cards


async def add_slide(
    db: AsyncSession,
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    request: CreateSlideRequest,
    user_id: uuid.UUID,
) -> CauseSectionSlideItem:
    """Add a slide to a slideshow card."""
    config = await _get_locked_config(db, event_id)
    await _ensure_version(db, event_id, config, request.draft_version)
    current_card = await _get_card_for_version(db, event_id, config.draft_version, card_id)
    if current_card.card_type != CardTypeEnum.SLIDESHOW:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Slides can only be added to slideshow cards",
        )

    new_version, card_map, _, _ = await _copy_on_write(db, event_id, config)
    new_card = card_map[card_id]
    new_slide = CauseSectionSlideItem(
        id=uuid.uuid4(),
        card_id=new_card.id,
        display_order=len(current_card.slides),
        slide_variant=request.slide_variant,
    )
    _apply_slide_create_payload(new_slide, request)
    db.add(new_slide)

    await _record_revision(
        db,
        event_id=event_id,
        user_id=user_id,
        action=RevisionActionEnum.DRAFT_SAVED,
        draft_version=new_version,
        change_summary={
            "operation": "add_slide",
            "card_id": str(card_id),
        },
    )
    await db.commit()
    return await _get_slide_by_id(db, new_slide.id)


async def update_slide(
    db: AsyncSession,
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    slide_id: uuid.UUID,
    request: UpdateSlideRequest,
    user_id: uuid.UUID,
) -> CauseSectionSlideItem:
    """Update a slide in a slideshow card."""
    config = await _get_locked_config(db, event_id)
    await _ensure_version(db, event_id, config, request.draft_version)
    current_card = await _get_card_for_version(db, event_id, config.draft_version, card_id)
    current_slide = next((slide for slide in current_card.slides if slide.id == slide_id), None)
    if current_slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")

    new_version, card_map, slide_map, _ = await _copy_on_write(db, event_id, config)
    _ = card_map[card_id]
    new_slide = slide_map.get(slide_id)
    if new_slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")

    _apply_slide_update_payload(new_slide, current_slide, request)
    await _record_revision(
        db,
        event_id=event_id,
        user_id=user_id,
        action=RevisionActionEnum.DRAFT_SAVED,
        draft_version=new_version,
        change_summary={
            "operation": "update_slide",
            "card_id": str(card_id),
            "slide_id": str(slide_id),
        },
    )
    await db.commit()
    return await _get_slide_by_id(db, new_slide.id)


async def delete_slide(
    db: AsyncSession,
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    slide_id: uuid.UUID,
    request_version: int,
    user_id: uuid.UUID,
) -> None:
    """Delete a slide and renumber remaining slides."""
    config = await _get_locked_config(db, event_id)
    await _ensure_version(db, event_id, config, request_version)
    current_card = await _get_card_for_version(db, event_id, config.draft_version, card_id)
    if not any(slide.id == slide_id for slide in current_card.slides):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")

    new_version, card_map, slide_map, _ = await _copy_on_write(db, event_id, config)
    new_card = card_map[card_id]
    new_slide = slide_map.get(slide_id)
    if new_slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")

    await db.delete(new_slide)
    await db.flush()
    await _renumber_slides(new_card)
    await _record_revision(
        db,
        event_id=event_id,
        user_id=user_id,
        action=RevisionActionEnum.DRAFT_SAVED,
        draft_version=new_version,
        change_summary={
            "operation": "delete_slide",
            "card_id": str(card_id),
            "slide_id": str(slide_id),
        },
    )
    await db.commit()


async def reorder_slides(
    db: AsyncSession,
    event_id: uuid.UUID,
    card_id: uuid.UUID,
    request: SlideReorderRequest,
    user_id: uuid.UUID,
) -> list[CauseSectionSlideItem]:
    """Reorder slides within a card."""
    config = await _get_locked_config(db, event_id)
    await _ensure_version(db, event_id, config, request.draft_version)
    current_card = await _get_card_for_version(db, event_id, config.draft_version, card_id)
    current_ids = {slide.id for slide in current_card.slides}
    requested_ids = list(request.slide_ids)
    if current_ids != set(requested_ids) or len(current_ids) != len(requested_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Slide reorder payload must include each current slide exactly once",
        )

    new_version, card_map, slide_map, _ = await _copy_on_write(db, event_id, config)
    new_card = card_map[card_id]
    for display_order, old_slide_id in enumerate(requested_ids):
        slide_map[old_slide_id].display_order = display_order

    await _record_revision(
        db,
        event_id=event_id,
        user_id=user_id,
        action=RevisionActionEnum.DRAFT_SAVED,
        draft_version=new_version,
        change_summary={
            "operation": "reorder_slides",
            "card_id": str(card_id),
            "slide_ids": [str(slide_id) for slide_id in requested_ids],
        },
    )
    await db.commit()
    await db.refresh(new_card, ["slides"])
    return sorted(new_card.slides, key=lambda slide: slide.display_order)


async def publish(
    db: AsyncSession,
    event_id: uuid.UUID,
    request: PublishRequest,
    user_id: uuid.UUID,
) -> EventCausePageConfig:
    """Publish the current draft version."""
    config = await _get_locked_config(db, event_id)
    await _ensure_version(db, event_id, config, request.draft_version)
    config.published_version = config.draft_version
    config.last_published_at = datetime.now(UTC)
    config.last_published_by_user_id = user_id

    await _record_revision(
        db,
        event_id=event_id,
        user_id=user_id,
        action=RevisionActionEnum.PUBLISHED,
        draft_version=config.draft_version,
        change_summary={
            "operation": "publish",
            "published_version": config.draft_version,
        },
    )
    await db.commit()
    await db.refresh(config)
    return config


def config_to_response(config: EventCausePageConfig) -> CausePageConfigResponse:
    return CausePageConfigResponse.model_validate(config)


def card_to_response(card: CauseSectionCard) -> CauseSectionCardResponse:
    return CauseSectionCardResponse.model_validate(card)


def public_card_to_response(card: CauseSectionCard) -> PublicCauseSectionCardResponse:
    response = PublicCauseSectionCardResponse.model_validate(card)

    if response.video_media_source == MediaSourceEnum.UPLOAD:
        response.video_url = get_signed_asset_url(response.video_url)

    response.slides = [public_slide_to_response(slide) for slide in card.slides]
    return response


def slide_to_response(slide: CauseSectionSlideItem) -> SlideItemResponse:
    return SlideItemResponse.model_validate(slide)


def public_slide_to_response(slide: CauseSectionSlideItem) -> SlideItemResponse:
    response = SlideItemResponse.model_validate(slide)
    if response.media_source == MediaSourceEnum.UPLOAD:
        response.media_url = get_signed_asset_url(response.media_url)
        blob_name = extract_blob_name(response.media_url) if response.media_url else None
        if blob_name:
            response.media_variants = get_media_variant_urls(blob_name)
    return response


def revision_to_response(revision: CauseSectionCardRevision) -> RevisionResponse:
    return RevisionResponse.model_validate(revision)


async def _get_locked_config(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> EventCausePageConfig:
    await get_or_create_config(db, event_id)
    result = await db.execute(
        select(EventCausePageConfig)
        .where(EventCausePageConfig.event_id == event_id)
        .with_for_update()
    )
    config = result.scalar_one_or_none()
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cause page config not found"
        )
    return config


def _cards_for_version_stmt(
    event_id: uuid.UUID, draft_version: int
) -> Select[tuple[CauseSectionCard]]:
    return (
        select(CauseSectionCard)
        .where(
            CauseSectionCard.event_id == event_id,
            CauseSectionCard.draft_version == draft_version,
        )
        .options(selectinload(CauseSectionCard.slides))
        .order_by(CauseSectionCard.display_order)
    )


async def _get_cards_for_version(
    db: AsyncSession,
    event_id: uuid.UUID,
    draft_version: int,
) -> list[CauseSectionCard]:
    result = await db.execute(_cards_for_version_stmt(event_id, draft_version))
    return list(result.scalars().all())


async def _get_card_for_version(
    db: AsyncSession,
    event_id: uuid.UUID,
    draft_version: int,
    card_id: uuid.UUID,
) -> CauseSectionCard:
    result = await db.execute(
        _cards_for_version_stmt(event_id, draft_version).where(CauseSectionCard.id == card_id)
    )
    card = result.scalar_one_or_none()
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    return card


async def _get_slide_by_id(
    db: AsyncSession,
    slide_id: uuid.UUID,
) -> CauseSectionSlideItem:
    result = await db.execute(
        select(CauseSectionSlideItem).where(CauseSectionSlideItem.id == slide_id)
    )
    slide = result.scalar_one_or_none()
    if slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")
    return slide


async def _ensure_version(
    db: AsyncSession,
    event_id: uuid.UUID,
    config: EventCausePageConfig,
    request_version: int,
) -> None:
    if request_version == config.draft_version:
        return

    latest_revision = await _get_latest_revision(db, event_id)
    detail = ConflictResponse(
        message="Draft version mismatch. Reload the latest draft and retry your changes.",
        current_draft_version=config.draft_version,
        requested_draft_version=request_version,
        published_version=config.published_version,
        latest_revision_action=latest_revision.action if latest_revision else None,
        latest_revision_changed_at=latest_revision.changed_at if latest_revision else None,
        latest_change_summary=latest_revision.change_summary if latest_revision else None,
    )
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=detail.model_dump(mode="json"),
    )


async def _get_latest_revision(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> CauseSectionCardRevision | None:
    result = await db.execute(
        select(CauseSectionCardRevision)
        .where(CauseSectionCardRevision.event_id == event_id)
        .order_by(CauseSectionCardRevision.changed_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _copy_on_write(
    db: AsyncSession,
    event_id: uuid.UUID,
    config: EventCausePageConfig,
) -> tuple[
    int,
    dict[uuid.UUID, CauseSectionCard],
    dict[uuid.UUID, CauseSectionSlideItem],
    list[CauseSectionCard],
]:
    """Copy current draft rows to a new draft version."""
    current_cards = await _get_cards_for_version(db, event_id, config.draft_version)
    new_version = config.draft_version + 1
    card_map: dict[uuid.UUID, CauseSectionCard] = {}
    slide_map: dict[uuid.UUID, CauseSectionSlideItem] = {}
    cloned_cards: list[CauseSectionCard] = []

    for card in current_cards:
        cloned_card = CauseSectionCard(
            id=uuid.uuid4(),
            event_id=card.event_id,
            draft_version=new_version,
            card_type=card.card_type,
            built_in_section_key=card.built_in_section_key,
            display_order=card.display_order,
            is_enabled=card.is_enabled,
            title=card.title,
            show_header=card.show_header,
            is_collapsible=card.is_collapsible,
            background_color_token=card.background_color_token,
            border_color_token=card.border_color_token,
            content_html=card.content_html,
            video_url=card.video_url,
            video_media_source=card.video_media_source,
            video_autoplay=card.video_autoplay,
            video_muted_by_default=card.video_muted_by_default,
        )
        db.add(cloned_card)
        card_map[card.id] = cloned_card
        cloned_cards.append(cloned_card)

        for slide in card.slides:
            cloned_slide = CauseSectionSlideItem(
                id=uuid.uuid4(),
                card_id=cloned_card.id,
                display_order=slide.display_order,
                slide_variant=slide.slide_variant,
                media_url=slide.media_url,
                media_source=slide.media_source,
                slide_name=slide.slide_name,
                alt_text=slide.alt_text,
                overlay_html=slide.overlay_html,
            )
            db.add(cloned_slide)
            slide_map[slide.id] = cloned_slide

    config.draft_version = new_version
    await db.flush()
    return new_version, card_map, slide_map, cloned_cards


async def _renumber_cards(db: AsyncSession, event_id: uuid.UUID, draft_version: int) -> None:
    cards = await _get_cards_for_version(db, event_id, draft_version)
    for index, card in enumerate(cards):
        card.display_order = index


async def _renumber_slides(card: CauseSectionCard) -> None:
    ordered_slides = sorted(card.slides, key=lambda slide: slide.display_order)
    for index, slide in enumerate(ordered_slides):
        slide.display_order = index


async def _record_revision(
    db: AsyncSession,
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    action: RevisionActionEnum,
    draft_version: int,
    change_summary: dict[str, object] | None = None,
) -> None:
    db.add(
        CauseSectionCardRevision(
            id=uuid.uuid4(),
            event_id=event_id,
            changed_by_user_id=user_id,
            action=action,
            draft_version=draft_version,
            changed_at=datetime.now(UTC),
            change_summary=change_summary,
        )
    )


def _apply_card_create_payload(card: CauseSectionCard, request: CreateCardRequest) -> None:
    if request.card_type == CardTypeEnum.TEXT:
        card.content_html = sanitize_html(request.content_html)
        card.video_url = None
        card.video_media_source = None
        card.video_autoplay = None
        card.video_muted_by_default = None
        return

    if request.card_type == CardTypeEnum.SLIDESHOW:
        card.content_html = None
        card.video_url = None
        card.video_media_source = None
        card.video_autoplay = None
        card.video_muted_by_default = None
        return

    if request.card_type == CardTypeEnum.VIDEO:
        try:
            card.video_url = validate_external_url(request.video_url)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
            ) from exc
        card.video_media_source = request.video_media_source or MediaSourceEnum.EXTERNAL
        card.video_autoplay = (
            request.video_autoplay if request.video_autoplay is not None else False
        )
        card.video_muted_by_default = (
            request.video_muted_by_default if request.video_muted_by_default is not None else True
        )
        card.content_html = None


def _apply_card_update_payload(
    card: CauseSectionCard,
    current_card_type: CardTypeEnum,
    request: UpdateCardRequest,
) -> None:
    changes = request.model_dump(exclude_unset=True)
    for field_name in (
        "is_enabled",
        "title",
        "show_header",
        "is_collapsible",
        "background_color_token",
        "border_color_token",
    ):
        if field_name in changes:
            setattr(card, field_name, changes[field_name])

    if current_card_type == CardTypeEnum.TEXT and "content_html" in changes:
        card.content_html = sanitize_html(request.content_html)

    if current_card_type == CardTypeEnum.VIDEO:
        if "video_url" in changes:
            try:
                card.video_url = validate_external_url(request.video_url)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(exc),
                ) from exc
        if "video_media_source" in changes:
            card.video_media_source = request.video_media_source
        if "video_autoplay" in changes:
            card.video_autoplay = request.video_autoplay
        if "video_muted_by_default" in changes:
            card.video_muted_by_default = request.video_muted_by_default


def _apply_slide_create_payload(slide: CauseSectionSlideItem, request: CreateSlideRequest) -> None:
    slide.slide_name = request.slide_name
    slide.overlay_html = sanitize_html(request.overlay_html)
    if request.slide_variant == SlideVariantEnum.TEXT_ONLY:
        slide.media_url = None
        slide.media_source = None
        slide.alt_text = None
        return

    try:
        slide.media_url = validate_external_url(request.media_url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    slide.media_source = request.media_source
    slide.alt_text = request.alt_text


def _apply_slide_update_payload(
    slide: CauseSectionSlideItem,
    current_slide: CauseSectionSlideItem,
    request: UpdateSlideRequest,
) -> None:
    changes = request.model_dump(exclude_unset=True)
    effective_variant = request.slide_variant or current_slide.slide_variant

    if "slide_name" in changes:
        slide.slide_name = request.slide_name

    if "slide_variant" in changes:
        slide.slide_variant = effective_variant

    if "overlay_html" in changes:
        slide.overlay_html = sanitize_html(request.overlay_html)

    if effective_variant == SlideVariantEnum.TEXT_ONLY:
        slide.media_url = None
        slide.media_source = None
        slide.alt_text = None
        return

    media_url = request.media_url if "media_url" in changes else slide.media_url
    media_source = request.media_source if "media_source" in changes else slide.media_source
    alt_text = request.alt_text if "alt_text" in changes else slide.alt_text

    if not media_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Image slides require a media URL",
        )
    if not alt_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Image slides require alt text",
        )
    if media_source is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Image slides require a media source",
        )

    try:
        slide.media_url = validate_external_url(media_url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    slide.media_source = media_source
    slide.alt_text = alt_text
