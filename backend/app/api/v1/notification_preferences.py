"""Notification preferences API endpoints (T059).

GET/PUT notification preferences per user.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_active_user
from app.models.notification import DeliveryChannelEnum, NotificationTypeEnum
from app.models.notification_preference import NotificationPreference
from app.models.user import User

logger = get_logger(__name__)

router = APIRouter(prefix="/notifications/preferences", tags=["notifications"])


# ---------- Schemas ----------


class PreferenceItem(BaseModel):
    notification_type: str
    channel: str
    enabled: bool


class PreferencesResponse(BaseModel):
    preferences: list[PreferenceItem]


class UpdatePreferencesRequest(BaseModel):
    preferences: list[PreferenceItem] = Field(..., description="List of preference updates")


# ---------- Default preferences seed ----------

# All notification types paired with channels; in-app always enabled
_ALL_TYPES = [e.value for e in NotificationTypeEnum]
_ALL_CHANNELS = [e.value for e in DeliveryChannelEnum]


async def _seed_defaults(db: AsyncSession, user_id: uuid.UUID) -> list[NotificationPreference]:
    """Create default preferences for a user if none exist."""
    prefs: list[NotificationPreference] = []
    for ntype in _ALL_TYPES:
        for channel in _ALL_CHANNELS:
            pref = NotificationPreference(
                user_id=user_id,
                notification_type=NotificationTypeEnum(ntype),
                channel=DeliveryChannelEnum(channel),
                enabled=channel == DeliveryChannelEnum.INAPP.value,
            )
            db.add(pref)
            prefs.append(pref)
    await db.flush()
    return prefs


# ---------- Endpoints ----------


@router.get("", response_model=PreferencesResponse)
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> PreferencesResponse:
    """Return current notification preferences for the authenticated user.

    Seeds defaults on first access.
    """
    stmt = select(NotificationPreference).where(
        NotificationPreference.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    prefs = list(result.scalars().all())

    if not prefs:
        prefs = await _seed_defaults(db, current_user.id)
        await db.commit()

    return PreferencesResponse(
        preferences=[
            PreferenceItem(
                notification_type=p.notification_type.value
                if hasattr(p.notification_type, "value")
                else str(p.notification_type),
                channel=p.channel.value if hasattr(p.channel, "value") else str(p.channel),
                enabled=p.enabled,
            )
            for p in prefs
        ]
    )


@router.put("", response_model=PreferencesResponse)
async def update_preferences(
    body: UpdatePreferencesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> PreferencesResponse:
    """Bulk update notification preferences.

    Rules:
    - In-app channel cannot be disabled.
    - SMS channel requires phone number (validated client-side).
    """
    valid_types = {e.value for e in NotificationTypeEnum}
    valid_channels = {e.value for e in DeliveryChannelEnum}

    for item in body.preferences:
        if item.notification_type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid notification type: {item.notification_type}",
            )
        if item.channel not in valid_channels:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid channel: {item.channel}",
            )
        # In-app channel cannot be disabled
        if item.channel == DeliveryChannelEnum.INAPP.value and not item.enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="In-app notifications cannot be disabled",
            )

    # Ensure defaults exist
    existing_stmt = select(NotificationPreference).where(
        NotificationPreference.user_id == current_user.id,
    )
    existing_result = await db.execute(existing_stmt)
    existing = list(existing_result.scalars().all())

    if not existing:
        existing = await _seed_defaults(db, current_user.id)
        await db.flush()

    # Build lookup
    lookup: dict[tuple[str, str], NotificationPreference] = {}
    for p in existing:
        key = (
            p.notification_type.value
            if hasattr(p.notification_type, "value")
            else str(p.notification_type),
            p.channel.value if hasattr(p.channel, "value") else str(p.channel),
        )
        lookup[key] = p

    # Apply updates
    for item in body.preferences:
        key = (item.notification_type, item.channel)
        if key in lookup:
            lookup[key].enabled = item.enabled
        else:
            pref = NotificationPreference(
                user_id=current_user.id,
                notification_type=NotificationTypeEnum(item.notification_type),
                channel=DeliveryChannelEnum(item.channel),
                enabled=item.enabled,
            )
            db.add(pref)

    await db.commit()

    # Re-query
    result = await db.execute(existing_stmt)
    all_prefs = list(result.scalars().all())

    return PreferencesResponse(
        preferences=[
            PreferenceItem(
                notification_type=p.notification_type.value
                if hasattr(p.notification_type, "value")
                else str(p.notification_type),
                channel=p.channel.value if hasattr(p.channel, "value") else str(p.channel),
                enabled=p.enabled,
            )
            for p in all_prefs
        ]
    )
