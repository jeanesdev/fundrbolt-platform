"""Event Media API endpoints."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.user import User
from app.schemas.event import (
    EventMediaResponse,
    MediaUploadUrlRequest,
    MediaUploadUrlResponse,
)
from app.services.event_service import EventService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events/{event_id}/media", tags=["events", "media"])


@router.post("/upload-url", response_model=MediaUploadUrlResponse, status_code=status.HTTP_200_OK)
async def request_upload_url(
    event_id: uuid.UUID,
    request: MediaUploadUrlRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MediaUploadUrlResponse:
    """
    Generate pre-signed URL for uploading media to Azure Blob Storage.

    **NOTE**: Media upload functionality is not yet fully implemented.
    This endpoint requires Azure Blob Storage configuration and
    media upload service implementation.

    Workflow:
    1. Request upload URL with file metadata
    2. Upload file to pre-signed URL (client-side)
    3. Call confirm endpoint to finalize upload

    Returns:
    - upload_url: Pre-signed Azure Blob URL (15-minute expiry)
    - media_id: UUID of created EventMedia record
    - expires_at: Upload URL expiration timestamp
    """
    # Verify event exists and user has permission
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # TODO: Implement media upload functionality
    # For now, return a not implemented error
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Media upload functionality is not yet implemented. Azure Blob Storage configuration and media service implementation required.",
    )


@router.post(
    "/{media_id}/confirm", response_model=EventMediaResponse, status_code=status.HTTP_200_OK
)
async def confirm_upload(
    event_id: uuid.UUID,
    media_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventMediaResponse:
    """
    Confirm media upload completion and trigger virus scan.

    **NOTE**: Media upload functionality is not yet fully implemented.

    Call this after successfully uploading file to Azure Blob Storage.
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Media upload functionality is not yet implemented.",
    )


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(
    event_id: uuid.UUID,
    media_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> None:
    """
    Delete media file.

    **NOTE**: Media upload functionality is not yet fully implemented.

    Removes file from Azure Blob Storage and database record.
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Media upload functionality is not yet implemented.",
    )
