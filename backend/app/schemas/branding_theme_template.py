"""Pydantic schemas for shared branding theme templates."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class BrandingThemeTemplateBase(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    primary_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]
    secondary_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]
    background_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]
    accent_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]

    page_background_style: Annotated[str, Field(pattern=r"^(solid|gradient|image)$")]
    page_background_gradient_start_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]
    page_background_gradient_end_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]

    action_card_background_style: Annotated[str, Field(pattern=r"^(solid|gradient)$")]
    action_card_gradient_start_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]
    action_card_gradient_end_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]
    action_card_background_opacity: Annotated[float, Field(ge=0, le=1)]


class BrandingThemeTemplateCreate(BrandingThemeTemplateBase):
    pass


class BrandingThemeTemplateUpdate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=120)] | None = None
    primary_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")] | None = None
    secondary_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")] | None = None
    background_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")] | None = None
    accent_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")] | None = None
    page_background_style: Annotated[str, Field(pattern=r"^(solid|gradient|image)$")] | None = None
    page_background_gradient_start_color: (
        Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")] | None
    ) = None
    page_background_gradient_end_color: (
        Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")] | None
    ) = None
    action_card_background_style: Annotated[str, Field(pattern=r"^(solid|gradient)$")] | None = None
    action_card_gradient_start_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")] | None = (
        None
    )
    action_card_gradient_end_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")] | None = (
        None
    )
    action_card_background_opacity: Annotated[float, Field(ge=0, le=1)] | None = None


class BrandingThemeTemplateResponse(BrandingThemeTemplateBase):
    id: uuid.UUID
    created_by: uuid.UUID | None = None
    updated_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
