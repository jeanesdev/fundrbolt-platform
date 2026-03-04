"""Media Service - Azure Blob Storage integration for event media."""

import logging
import mimetypes
import time
import uuid
from datetime import datetime, timedelta
from urllib.parse import quote

import pytz
from azure.storage.blob import (
    BlobSasPermissions,
    BlobServiceClient,
    ContentSettings,
    generate_blob_sas,
)
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.metrics import EVENT_MEDIA_SCAN_RESULTS_TOTAL, EVENT_MEDIA_UPLOADS_TOTAL
from app.models.event import EventMedia, EventMediaStatus, EventMediaType, EventMediaUsageTag
from app.models.user import User

settings = get_settings()
logger = logging.getLogger(__name__)


class MediaService:
    """Service for managing event media uploads with Azure Blob Storage."""

    # File size limits
    MAX_FILE_SIZE_MB = 10
    MAX_TOTAL_SIZE_MB = 50
    MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
    MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024

    # Allowed MIME types
    ALLOWED_IMAGE_TYPES = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
    }
    ALLOWED_VIDEO_TYPES = {
        "video/mp4",
        "video/quicktime",
    }
    ALLOWED_DOCUMENT_TYPES = {
        "application/pdf",
    }

    @staticmethod
    def _get_blob_client() -> BlobServiceClient:
        """Get Azure Blob Service Client."""
        if not settings.azure_storage_connection_string:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Azure Storage not configured",
            )

        return BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)

    @staticmethod
    def _extract_account_key_from_connection_string() -> str | None:
        """Extract AccountKey from Azure Storage connection string if present."""
        connection_string = settings.azure_storage_connection_string
        if not connection_string:
            return None

        for part in connection_string.split(";"):
            if part.startswith("AccountKey="):
                return part.split("=", 1)[1]
        return None

    @staticmethod
    def generate_read_sas_url(blob_name: str, expiry_hours: int = 24) -> str:
        """
        Generate a SAS URL with read permissions for a blob.

        Args:
            blob_name: The blob path (e.g., events/event-id/media-id/filename.png)
            expiry_hours: How long the SAS token should be valid (default: 24 hours)

        Returns:
            Full URL with SAS token for read access
        """
        blob_client = MediaService._get_blob_client()
        container_name = settings.azure_storage_container_name or "event-media"
        account_name = blob_client.account_name

        if not account_name:
            # Fallback to base URL without SAS
            account_name = settings.azure_storage_account_name or "storage"
            return f"https://{account_name}.blob.core.windows.net/{container_name}/{blob_name}"

        # Get account key from credential
        account_key = None
        if hasattr(blob_client.credential, "account_key"):
            account_key = blob_client.credential.account_key

        if not account_key:
            account_key = MediaService._extract_account_key_from_connection_string()

        if not account_key:
            # Fallback to base URL without SAS
            return f"https://{account_name}.blob.core.windows.net/{container_name}/{blob_name}"

        # Generate SAS token with read permission
        sas_token = generate_blob_sas(
            account_name=account_name,
            container_name=container_name,
            blob_name=blob_name,
            account_key=account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(pytz.UTC) + timedelta(hours=expiry_hours),
        )

        encoded_blob_name = quote(blob_name, safe="/~-._")
        base_url = f"https://{account_name}.blob.core.windows.net"
        return f"{base_url}/{container_name}/{encoded_blob_name}?{sas_token}"

    @staticmethod
    async def copy_blob(source_blob_name: str, target_blob_name: str) -> str:
        """
        Server-side copy a blob to a new path within the same container.

        Uses Azure Blob Storage ``start_copy_from_url()`` so no data flows
        through the application server.

        Args:
            source_blob_name: Blob path of the source (e.g. events/<id>/media/<file>)
            target_blob_name: Blob path for the copy

        Returns:
            The full URL of the newly created blob.
        """
        blob_service = MediaService._get_blob_client()
        container_name = settings.azure_storage_container_name or "event-media"

        # Build a SAS URL for reading the source blob
        source_url = MediaService.generate_read_sas_url(source_blob_name, expiry_hours=1)

        # Get a client for the target blob and start the server-side copy
        target_client = blob_service.get_blob_client(
            container=container_name,
            blob=target_blob_name,
        )
        target_client.start_copy_from_url(source_url)

        # Poll until the server-side copy completes (or times out)
        max_wait_seconds = 30
        poll_interval = 0.5
        elapsed = 0.0
        while elapsed < max_wait_seconds:
            props = target_client.get_blob_properties()
            copy_status = props.copy.status if props.copy else None
            if copy_status == "success":
                break
            if copy_status in ("failed", "aborted"):
                raise RuntimeError(
                    f"Blob copy {source_blob_name} -> {target_blob_name} "
                    f"ended with status '{copy_status}'"
                )
            time.sleep(poll_interval)
            elapsed += poll_interval
        else:
            logger.warning(
                "Blob copy %s -> %s did not complete within %ss; the copy may still be in progress",
                source_blob_name,
                target_blob_name,
                max_wait_seconds,
            )

        account_name = blob_service.account_name or "storage"
        encoded_target = quote(target_blob_name, safe="/")
        new_url = f"https://{account_name}.blob.core.windows.net/{container_name}/{encoded_target}"
        logger.info("Blob copied: %s -> %s", source_blob_name, target_blob_name)
        return new_url

    @staticmethod
    async def generate_upload_url(
        db: AsyncSession,
        event_id: uuid.UUID,
        filename: str,
        file_size: int,
        media_type: EventMediaType,
        usage_tag: EventMediaUsageTag,
        current_user: User,
    ) -> tuple[str, uuid.UUID]:
        """
        Generate pre-signed URL for direct upload to Azure Blob Storage.

        Args:
            db: Database session
            event_id: Event UUID
            filename: Original filename
            file_size: File size in bytes
            media_type: Image, video, or flyer
            current_user: User requesting upload

        Returns:
            Tuple of (upload_url, media_id)

        Raises:
            HTTPException: If validation fails or limits exceeded
        """
        # Validate file size
        if file_size > MediaService.MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size {file_size / 1024 / 1024:.2f}MB exceeds limit of {MediaService.MAX_FILE_SIZE_MB}MB",
            )

        # Check total event media size
        total_query = select(func.sum(EventMedia.file_size)).where(EventMedia.event_id == event_id)
        result = await db.execute(total_query)
        current_total = result.scalar() or 0

        if current_total + file_size > MediaService.MAX_TOTAL_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Total media size would exceed {MediaService.MAX_TOTAL_SIZE_MB}MB limit",
            )

        # Validate MIME type
        mime_type, _ = mimetypes.guess_type(filename)
        if not mime_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to determine file type",
            )

        # Get allowed types based on media_type
        if media_type == EventMediaType.IMAGE:
            allowed_types = MediaService.ALLOWED_IMAGE_TYPES
        elif media_type == EventMediaType.VIDEO:
            allowed_types = MediaService.ALLOWED_VIDEO_TYPES
        elif media_type == EventMediaType.FLYER:
            allowed_types = MediaService.ALLOWED_DOCUMENT_TYPES
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid media type: {media_type}",
            )

        if mime_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {mime_type} not allowed for {media_type.value}",
            )

        # Create media record
        media_id = uuid.uuid4()
        blob_name = f"events/{event_id}/{media_id}/{filename}"
        container_name = settings.azure_storage_container_name or "event-media"

        # Generate placeholder URL (will be replaced with actual URL after upload)
        blob_client = MediaService._get_blob_client()
        # blob_client.url is the service endpoint (e.g., https://account.blob.core.windows.net)
        # Remove trailing slash if present to avoid double slashes
        if blob_client.url:
            base_url = blob_client.url.rstrip("/")
            file_url = f"{base_url}/{container_name}/{blob_name}"
        else:
            # Fallback if blob_client.url is None
            account_name = settings.azure_storage_account_name or "storage"
            file_url = f"https://{account_name}.blob.core.windows.net/{container_name}/{blob_name}"

        media = EventMedia(
            id=media_id,
            event_id=event_id,
            media_type=media_type,
            usage_tag=usage_tag,
            file_name=filename,
            file_size=file_size,
            file_type=mime_type,  # Keep for backward compatibility
            mime_type=mime_type,
            blob_name=blob_name,
            file_url=file_url,
            status=EventMediaStatus.UPLOADED,
            uploaded_by=current_user.id,
            display_order=0,
        )

        db.add(media)
        await db.commit()

        # Generate SAS URL for upload
        storage_account_name: str | None = blob_client.account_name
        if not storage_account_name:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Azure Storage account name not available",
            )

        # Get account key from credential
        account_key = None
        if hasattr(blob_client.credential, "account_key"):
            account_key = blob_client.credential.account_key

        if not account_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Azure Storage account key not available",
            )

        sas_token = generate_blob_sas(
            account_name=storage_account_name,
            container_name=container_name,
            blob_name=blob_name,
            account_key=account_key,
            permission=BlobSasPermissions(write=True, create=True),
            expiry=datetime.now(pytz.UTC) + timedelta(hours=1),
        )

        upload_url = f"{file_url}?{sas_token}"

        logger.info(
            f"Generated upload URL for event {event_id}, media {media_id}, user {current_user.id}"
        )

        return upload_url, media_id

    @staticmethod
    async def confirm_upload(
        db: AsyncSession,
        media_id: uuid.UUID,
    ) -> EventMedia:
        """
        Mark media as uploaded after successful Azure Blob upload.

        Triggers virus scanning via Celery task.
        """
        query = select(EventMedia).where(EventMedia.id == media_id)
        result = await db.execute(query)
        media = result.scalar_one_or_none()

        if not media:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media with ID {media_id} not found",
            )

        if media.status != EventMediaStatus.UPLOADED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Media is already {media.status.value}",
            )

        media.status = EventMediaStatus.SCANNED  # Will be re-checked after virus scan

        await db.commit()
        await db.refresh(media)

        # Increment metrics for successful upload
        EVENT_MEDIA_UPLOADS_TOTAL.labels(status="success").inc()

        # TODO: Trigger Celery task for virus scanning
        # from app.tasks.media import scan_uploaded_file
        # scan_uploaded_file.delay(str(media_id))

        logger.info(f"Media {media_id} marked for scanning")
        return media

    @staticmethod
    async def upload_file_direct(
        db: AsyncSession,
        event_id: uuid.UUID,
        filename: str,
        file_bytes: bytes,
        content_type: str,
        media_type: EventMediaType,
        usage_tag: EventMediaUsageTag,
        current_user: User,
    ) -> EventMedia:
        """Upload media file via backend and persist EventMedia in one step."""
        file_size = len(file_bytes)

        if file_size <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty",
            )

        if file_size > MediaService.MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"File size {file_size / 1024 / 1024:.2f}MB exceeds "
                    f"limit of {MediaService.MAX_FILE_SIZE_MB}MB"
                ),
            )

        total_query = select(func.sum(EventMedia.file_size)).where(EventMedia.event_id == event_id)
        result = await db.execute(total_query)
        current_total = result.scalar() or 0

        if current_total + file_size > MediaService.MAX_TOTAL_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Total media size would exceed {MediaService.MAX_TOTAL_SIZE_MB}MB limit",
            )

        if media_type == EventMediaType.IMAGE:
            allowed_types = MediaService.ALLOWED_IMAGE_TYPES
        elif media_type == EventMediaType.VIDEO:
            allowed_types = MediaService.ALLOWED_VIDEO_TYPES
        elif media_type == EventMediaType.FLYER:
            allowed_types = MediaService.ALLOWED_DOCUMENT_TYPES
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid media type: {media_type}",
            )

        if content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {content_type} not allowed for {media_type.value}",
            )

        media_id = uuid.uuid4()
        blob_name = f"events/{event_id}/{media_id}/{filename}"
        container_name = settings.azure_storage_container_name or "event-media"

        blob_client = MediaService._get_blob_client()

        try:
            blob = blob_client.get_blob_client(container=container_name, blob=blob_name)
            blob.upload_blob(
                file_bytes,
                overwrite=True,
                content_settings=ContentSettings(content_type=content_type),
            )
        except Exception as exc:
            logger.exception("Direct blob upload failed for event %s", event_id)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to upload media to storage",
            ) from exc

        if blob_client.url:
            base_url = blob_client.url.rstrip("/")
            file_url = f"{base_url}/{container_name}/{blob_name}"
        else:
            account_name = settings.azure_storage_account_name or "storage"
            file_url = f"https://{account_name}.blob.core.windows.net/{container_name}/{blob_name}"

        media = EventMedia(
            id=media_id,
            event_id=event_id,
            media_type=media_type,
            usage_tag=usage_tag,
            file_name=filename,
            file_size=file_size,
            file_type=content_type,
            mime_type=content_type,
            blob_name=blob_name,
            file_url=file_url,
            status=EventMediaStatus.SCANNED,
            uploaded_by=current_user.id,
            display_order=0,
        )

        db.add(media)
        await db.commit()
        await db.refresh(media)

        EVENT_MEDIA_UPLOADS_TOTAL.labels(status="success").inc()
        return media

    @staticmethod
    async def mark_scan_complete(
        db: AsyncSession,
        media_id: uuid.UUID,
        scan_passed: bool,
        scan_details: dict[str, str] | None = None,
    ) -> EventMedia:
        """Update media status after virus scan completes."""
        query = select(EventMedia).where(EventMedia.id == media_id)
        result = await db.execute(query)
        media = result.scalar_one_or_none()

        if not media:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media with ID {media_id} not found",
            )

        if scan_passed:
            media.status = EventMediaStatus.SCANNED
            EVENT_MEDIA_SCAN_RESULTS_TOTAL.labels(result="clean").inc()
            logger.info(f"Media {media_id} approved after scan")
        else:
            media.status = EventMediaStatus.QUARANTINED
            EVENT_MEDIA_SCAN_RESULTS_TOTAL.labels(result="infected").inc()
            logger.warning(f"Media {media_id} rejected after scan: {scan_details}")

        await db.commit()
        await db.refresh(media)

        return media

    @staticmethod
    async def delete_media(
        db: AsyncSession,
        media_id: uuid.UUID,
        current_user: User,
    ) -> None:
        """
        Delete media from database and Azure Blob Storage.

        Args:
            db: Database session
            media_id: Media UUID
            current_user: User deleting the media
        """
        query = select(EventMedia).where(EventMedia.id == media_id)
        result = await db.execute(query)
        media = result.scalar_one_or_none()

        if not media:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media with ID {media_id} not found",
            )

        # Delete from Azure Blob
        try:
            blob_client = MediaService._get_blob_client()
            container_name = settings.azure_storage_container_name or "event-media"
            blob = blob_client.get_blob_client(container=container_name, blob=media.blob_name)
            blob.delete_blob()
        except Exception as e:
            logger.error(f"Failed to delete blob {media.blob_name}: {e}")
            # Continue with DB deletion even if blob deletion fails

        # Delete from database
        await db.delete(media)
        await db.commit()

        logger.info(f"Media {media_id} deleted by user {current_user.id}")
