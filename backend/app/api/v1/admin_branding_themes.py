"""Admin endpoints for shared branding theme templates."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.branding_theme_template import BrandingThemeTemplate
from app.models.user import User
from app.schemas.branding_theme_template import (
    BrandingThemeTemplateCreate,
    BrandingThemeTemplateResponse,
    BrandingThemeTemplateUpdate,
)

router = APIRouter(tags=["admin-branding-themes"])


@router.get(
    "/admin/branding-theme-templates",
    response_model=list[BrandingThemeTemplateResponse],
)
@require_role("super_admin", "npo_admin", "event_coordinator", "npo_staff", "donor")
async def list_branding_theme_templates(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[BrandingThemeTemplateResponse]:
    del current_user
    try:
        result = await db.execute(
            select(BrandingThemeTemplate).order_by(BrandingThemeTemplate.name.asc())
        )
    except ProgrammingError as exc:
        if 'relation "branding_theme_templates" does not exist' in str(exc):
            return []
        raise

    return [BrandingThemeTemplateResponse.model_validate(theme) for theme in result.scalars().all()]


@router.post(
    "/admin/branding-theme-templates",
    response_model=BrandingThemeTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
@require_role("super_admin")
async def create_branding_theme_template(
    payload: BrandingThemeTemplateCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BrandingThemeTemplateResponse:
    template = BrandingThemeTemplate(
        **payload.model_dump(),
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(template)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Theme name already exists",
        ) from exc
    return BrandingThemeTemplateResponse.model_validate(template)


@router.patch(
    "/admin/branding-theme-templates/{template_id}",
    response_model=BrandingThemeTemplateResponse,
)
@require_role("super_admin")
async def update_branding_theme_template(
    template_id: uuid.UUID,
    payload: BrandingThemeTemplateUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BrandingThemeTemplateResponse:
    result = await db.execute(
        select(BrandingThemeTemplate).where(BrandingThemeTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(template, key, value)
    template.updated_by = current_user.id

    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Theme name already exists",
        ) from exc

    return BrandingThemeTemplateResponse.model_validate(template)
