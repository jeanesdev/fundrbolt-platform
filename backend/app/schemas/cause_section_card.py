"""Pydantic schemas for cause section cards."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, ClassVar

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.cause_section_card import (
    CardTypeEnum,
    MediaSourceEnum,
    RevisionActionEnum,
    SlideVariantEnum,
)

ALLOWED_COLOR_TOKENS = {
    "slate-50",
    "slate-100",
    "slate-200",
    "white",
    "transparent",
}


class CausePageConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    draft_version: int
    published_version: int
    last_published_at: datetime | None = None
    last_published_by_user_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class SlideItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    card_id: uuid.UUID
    display_order: int
    slide_variant: SlideVariantEnum
    media_url: str | None = None
    media_source: MediaSourceEnum | None = None
    slide_name: str | None = None
    alt_text: str | None = None
    overlay_html: str | None = None
    created_at: datetime
    updated_at: datetime


class CauseSectionCardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    draft_version: int
    card_type: CardTypeEnum
    built_in_section_key: str | None = None
    display_order: int
    is_enabled: bool
    title: str | None = None
    show_header: bool
    is_collapsible: bool
    background_color_token: str | None = None
    border_color_token: str | None = None
    content_html: str | None = None
    video_url: str | None = None
    video_media_source: MediaSourceEnum | None = None
    video_autoplay: bool | None = None
    video_muted_by_default: bool | None = None
    slides: list[SlideItemResponse] = []
    created_at: datetime
    updated_at: datetime


class PublicCauseSectionCardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    card_type: CardTypeEnum
    built_in_section_key: str | None = None
    display_order: int
    is_enabled: bool
    title: str | None = None
    show_header: bool
    is_collapsible: bool
    background_color_token: str | None = None
    border_color_token: str | None = None
    content_html: str | None = None
    video_url: str | None = None
    video_media_source: MediaSourceEnum | None = None
    video_autoplay: bool | None = None
    video_muted_by_default: bool | None = None
    slides: list[SlideItemResponse] = []


class _ColorTokenMixin(BaseModel):
    _color_fields: ClassVar[tuple[str, ...]] = (
        "background_color_token",
        "border_color_token",
    )

    @field_validator(
        "background_color_token",
        "border_color_token",
        mode="before",
        check_fields=False,
    )
    @classmethod
    def validate_color_token(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if normalized == "":
            return None
        if normalized not in ALLOWED_COLOR_TOKENS:
            raise ValueError("Color token must be one of the allowed palette values")
        return normalized


class CreateCardRequest(_ColorTokenMixin):
    draft_version: int = Field(ge=1)
    card_type: CardTypeEnum
    is_enabled: bool = True
    title: str | None = Field(default=None, max_length=200)
    show_header: bool = False
    is_collapsible: bool = False
    background_color_token: str | None = None
    border_color_token: str | None = None
    content_html: str | None = None
    video_url: str | None = Field(default=None, max_length=2048)
    video_media_source: MediaSourceEnum | None = None
    video_autoplay: bool | None = None
    video_muted_by_default: bool | None = None

    @field_validator("title", "content_html", "video_url", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @model_validator(mode="after")
    def validate_create_payload(self) -> CreateCardRequest:
        if self.card_type == CardTypeEnum.BUILT_IN:
            raise ValueError(
                "Built-in cards are seeded automatically and cannot be created manually"
            )
        if self.card_type == CardTypeEnum.TEXT and self.video_url is not None:
            raise ValueError("Text cards cannot include a video URL")
        if self.card_type == CardTypeEnum.SLIDESHOW and self.video_url is not None:
            raise ValueError("Slideshow cards cannot include a video URL")
        if self.card_type == CardTypeEnum.VIDEO and self.video_url is None:
            raise ValueError("Video cards require a video URL")
        return self


class UpdateCardRequest(_ColorTokenMixin):
    draft_version: int = Field(ge=1)
    is_enabled: bool | None = None
    title: str | None = Field(default=None, max_length=200)
    show_header: bool | None = None
    is_collapsible: bool | None = None
    background_color_token: str | None = None
    border_color_token: str | None = None
    content_html: str | None = None
    video_url: str | None = Field(default=None, max_length=2048)
    video_media_source: MediaSourceEnum | None = None
    video_autoplay: bool | None = None
    video_muted_by_default: bool | None = None

    @field_validator("title", "content_html", "video_url", mode="before")
    @classmethod
    def normalize_optional_update_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ReorderRequest(BaseModel):
    draft_version: int = Field(ge=1)
    card_ids: list[uuid.UUID] = Field(min_length=1)


class CreateSlideRequest(BaseModel):
    draft_version: int = Field(ge=1)
    slide_variant: SlideVariantEnum
    media_url: str | None = Field(default=None, max_length=2048)
    media_source: MediaSourceEnum | None = None
    slide_name: str | None = Field(default=None, max_length=200)
    alt_text: str | None = Field(default=None, max_length=500)
    overlay_html: str | None = None

    @field_validator("media_url", "slide_name", "alt_text", "overlay_html", mode="before")
    @classmethod
    def normalize_slide_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @model_validator(mode="after")
    def validate_slide(self) -> CreateSlideRequest:
        if self.slide_variant == SlideVariantEnum.TEXT_ONLY:
            return self
        if not self.media_url:
            raise ValueError("Image slides require a media URL")
        if not self.alt_text:
            raise ValueError("Image slides require alt text")
        if self.media_source is None:
            raise ValueError("Image slides require a media source")
        return self


class UpdateSlideRequest(BaseModel):
    draft_version: int = Field(ge=1)
    slide_variant: SlideVariantEnum | None = None
    media_url: str | None = Field(default=None, max_length=2048)
    media_source: MediaSourceEnum | None = None
    slide_name: str | None = Field(default=None, max_length=200)
    alt_text: str | None = Field(default=None, max_length=500)
    overlay_html: str | None = None

    @field_validator("media_url", "slide_name", "alt_text", "overlay_html", mode="before")
    @classmethod
    def normalize_slide_update_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class SlideReorderRequest(BaseModel):
    draft_version: int = Field(ge=1)
    slide_ids: list[uuid.UUID] = Field(min_length=1)


class PublishRequest(BaseModel):
    draft_version: int = Field(ge=1)


class ConflictResponse(BaseModel):
    code: str = "draft_version_conflict"
    message: str
    current_draft_version: int
    requested_draft_version: int
    published_version: int
    latest_revision_action: RevisionActionEnum | None = None
    latest_revision_changed_at: datetime | None = None
    latest_change_summary: dict[str, Any] | None = None


class RevisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    changed_by_user_id: uuid.UUID
    action: RevisionActionEnum
    draft_version: int
    changed_at: datetime
    change_summary: dict[str, Any] | None = None
