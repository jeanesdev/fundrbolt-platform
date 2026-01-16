"""Service for managing ticket package images in Azure Blob Storage."""

import hashlib
import os
import uuid
from io import BytesIO
from typing import BinaryIO

from datetime import datetime, timedelta
from azure.core.exceptions import ResourceExistsError
from azure.storage.blob import (
    BlobSasPermissions,
    BlobServiceClient,
    ContentSettings,
    generate_blob_sas,
)
from PIL import Image

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)


class ImageService:
    """Service for uploading and managing ticket package images.

    Business Rules:
    - Supported formats: JPG, PNG, WebP
    - Max file size: 5 MB
    - Images stored in Azure Blob Storage container: ticket-package-images
    - Virus scanning via Azure Defender (configured at storage account level)
    - Generate unique blob names to avoid collisions
    """

    # Container comes from environment (e.g., npo-assets); fallback to npo-assets for safety
    CONTAINER_NAME = settings.azure_storage_container_name or "npo-assets"
    # Store images under this virtual folder inside the container
    FOLDER_PREFIX = "ticket-package-images"
    MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
    ALLOWED_FORMATS = {"jpg", "jpeg", "png", "webp"}
    ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}

    def __init__(self, blob_service_client: BlobServiceClient | None = None):
        """Initialize ImageService with optional blob client override (for testing)."""
        if blob_service_client:
            self.blob_service_client = blob_service_client
        else:
            self.blob_service_client = BlobServiceClient.from_connection_string(
                settings.azure_storage_connection_string
            )
        self._conn_settings = self._parse_connection_string(settings.azure_storage_connection_string)

    async def upload_image(
        self,
        file: BinaryIO,
        filename: str,
        event_id: uuid.UUID,
        package_id: uuid.UUID | None = None,
    ) -> str:
        """Upload ticket package image to Azure Blob Storage.

        Args:
            file: Binary file object
            filename: Original filename (for extension detection)
            event_id: Event UUID for organizing blobs
            package_id: Package UUID (optional, for updates)

        Returns:
            Azure Blob Storage URL

        Raises:
            ValueError: If file format, size, or content is invalid
        """
        # Validate file extension
        file_ext = self._get_file_extension(filename)
        if file_ext not in self.ALLOWED_FORMATS:
            raise ValueError(
                f"Invalid file format. Allowed formats: {', '.join(self.ALLOWED_FORMATS).upper()}"
            )

        # Read file content
        file_content = file.read()
        file_size = len(file_content)

        # Validate file size
        if file_size > self.MAX_SIZE_BYTES:
            raise ValueError(
                f"File size ({file_size / (1024 * 1024):.2f} MB) exceeds maximum allowed size (5 MB)"
            )

        # Validate image content (not just extension)
        try:
            image = Image.open(BytesIO(file_content))
            image.verify()  # Verify it's a valid image
            mime_type = Image.MIME.get(
                image.format if image.format else "UNKNOWN", "application/octet-stream"
            )
            if mime_type not in self.ALLOWED_MIME_TYPES:
                raise ValueError(f"Invalid image format: {image.format}")
        except Exception as e:
            logger.error(f"Image validation failed: {e}")
            raise ValueError("Invalid image file")

        # Generate unique blob name
        blob_name = self._generate_blob_name(
            event_id=event_id,
            package_id=package_id,
            file_ext=file_ext,
            file_content=file_content,
        )

        # Upload to Azure Blob Storage
        try:
            # Ensure container exists (Azurite/local dev may start empty)
            container_client = self.blob_service_client.get_container_client(self.CONTAINER_NAME)
            try:
                container_client.create_container(public_access="blob")
            except ResourceExistsError:
                # Ensure public blob access for existing container so thumbnails load
                try:
                    container_client.set_container_access_policy(public_access="blob")
                except Exception:
                    # Non-fatal; continue with existing policy
                    pass

            blob_client = self.blob_service_client.get_blob_client(
                container=self.CONTAINER_NAME,
                blob=blob_name,
            )

            # Upload with metadata
            blob_client.upload_blob(
                file_content,
                overwrite=True,
                metadata={
                    "event_id": str(event_id),
                    "package_id": str(package_id) if package_id else "new",
                    "original_filename": filename,
                },
                content_settings=ContentSettings(
                    content_type=mime_type,
                    cache_control="public, max-age=31536000",  # 1 year
                ),
            )

            blob_url: str = str(blob_client.url)

            # Generate a read SAS so thumbnails work even when the account blocks public access
            sas_token = generate_blob_sas(
                account_name=self._conn_settings["AccountName"],
                container_name=self.CONTAINER_NAME,
                blob_name=blob_name,
                account_key=self._conn_settings.get("AccountKey"),
                permission=BlobSasPermissions(read=True),
                expiry=datetime.utcnow() + timedelta(days=30),
            )

            signed_url = f"{blob_url}?{sas_token}" if sas_token else blob_url
            logger.info(f"Uploaded image to Azure Blob Storage: {signed_url}")
            return signed_url

        except Exception as e:
            logger.error(f"Failed to upload image to Azure Blob Storage: {e}")
            raise ValueError("Failed to upload image")

    async def delete_image(self, image_url: str) -> None:
        """Delete ticket package image from Azure Blob Storage.

        Args:
            image_url: Full Azure Blob Storage URL

        Raises:
            ValueError: If URL is invalid or deletion fails
        """
        try:
            # Extract blob name from URL
            blob_name = self._extract_blob_name_from_url(image_url)

            blob_client = self.blob_service_client.get_blob_client(
                container=self.CONTAINER_NAME,
                blob=blob_name,
            )

            blob_client.delete_blob()
            logger.info(f"Deleted image from Azure Blob Storage: {image_url}")

        except Exception as e:
            logger.error(f"Failed to delete image from Azure Blob Storage: {e}")
            # Don't raise exception - deletion failures shouldn't block operations

    @staticmethod
    def _get_file_extension(filename: str) -> str:
        """Extract file extension (lowercase, no dot)."""
        _, ext = os.path.splitext(filename.lower())
        return ext.lstrip(".")

    @staticmethod
    def _generate_blob_name(
        event_id: uuid.UUID,
        package_id: uuid.UUID | None,
        file_ext: str,
        file_content: bytes,
    ) -> str:
        """Generate unique blob name with hash to prevent collisions.

        Format: event_{event_id}/package_{package_id}_{hash}.{ext}
        """
        # Generate hash of file content (first 16 chars of SHA256)
        file_hash = hashlib.sha256(file_content).hexdigest()[:16]

        if package_id:
            blob_name = f"event_{event_id}/package_{package_id}_{file_hash}.{file_ext}"
        else:
            blob_name = f"event_{event_id}/new_{file_hash}.{file_ext}"

        return f"{ImageService.FOLDER_PREFIX}/{blob_name}"

    @staticmethod
    def _extract_blob_name_from_url(url: str) -> str:
        """Extract blob name from Azure Blob Storage URL.

        Example URL: https://fundrbolt.blob.core.windows.net/ticket-package-images/event_123/package_456_abc123.jpg
        Returns: event_123/package_456_abc123.jpg
        """
        # Split URL and get path after container name
        parts = url.split(f"/{ImageService.CONTAINER_NAME}/")
        if len(parts) != 2:
            raise ValueError("Invalid Azure Blob Storage URL")
        blob_name: str = parts[1]
        return blob_name

    @staticmethod
    def _parse_connection_string(conn_str: str) -> dict[str, str]:
        """Parse Azure storage connection string into a dict."""
        parts: dict[str, str] = {}
        for segment in conn_str.split(";"):
            if not segment or "=" not in segment:
                continue
            k, v = segment.split("=", 1)
            parts[k] = v
        return parts
