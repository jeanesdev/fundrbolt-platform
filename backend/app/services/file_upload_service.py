"""File upload service for Azure Blob Storage with image validation.

This service handles:
- Logo image uploads for NPO branding
- Image validation (type, size, dimensions)
- Azure Blob Storage SAS URL generation (production)
- Local file storage fallback (development)
- Secure file naming and path management
"""

import hashlib
import uuid
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path

from azure.storage.blob import (
    BlobSasPermissions,
    BlobServiceClient,
    ContentSettings,
    generate_blob_sas,
)
from PIL import Image

from app.core.config import Settings


class FileUploadService:
    """Service for handling file uploads to Azure Blob Storage."""

    blob_service_client: BlobServiceClient | None

    # Allowed image MIME types
    ALLOWED_IMAGE_TYPES = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
    }

    # Allowed file extensions
    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

    # Maximum file size (5MB)
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB in bytes

    # Maximum image dimensions (increased for high-res logos)
    MAX_WIDTH = 4000
    MAX_HEIGHT = 4000

    # Minimum image dimensions
    MIN_WIDTH = 100
    MIN_HEIGHT = 100

    # SAS URL expiration (15 minutes for upload)
    SAS_EXPIRY_HOURS = 0.25  # 15 minutes

    def __init__(self, settings: Settings):
        """Initialize the file upload service.

        Args:
            settings: Application settings containing Azure credentials
        """
        self.settings = settings
        self.container_name = settings.azure_storage_container_name

        # Initialize blob service client if connection string is provided
        if settings.azure_storage_connection_string:
            self.blob_service_client = BlobServiceClient.from_connection_string(
                settings.azure_storage_connection_string
            )
        else:
            self.blob_service_client = None

        # Local storage directory (used when Azure is not configured)
        self.local_storage_dir = Path("static/uploads/logos")
        self.local_storage_dir.mkdir(parents=True, exist_ok=True)

    def validate_image_file(
        self, file_content: bytes, content_type: str, file_name: str
    ) -> tuple[bool, str | None]:
        """Validate image file type, size, and dimensions.

        Args:
            file_content: File content as bytes
            content_type: MIME type
            file_name: Original file name

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check MIME type
        if content_type not in self.ALLOWED_IMAGE_TYPES:
            return False, f"Invalid file type. Allowed types: {', '.join(self.ALLOWED_IMAGE_TYPES)}"

        # Check file extension
        file_ext = "." + file_name.lower().split(".")[-1] if "." in file_name else ""
        if file_ext not in self.ALLOWED_EXTENSIONS:
            return False, f"Invalid file extension. Allowed: {', '.join(self.ALLOWED_EXTENSIONS)}"

        # Check file size
        if len(file_content) > self.MAX_FILE_SIZE:
            max_mb = self.MAX_FILE_SIZE / (1024 * 1024)
            return False, f"File size exceeds {max_mb}MB limit"

        # Validate image with PIL
        try:
            image = Image.open(BytesIO(file_content))
            width, height = image.size

            # Check minimum dimensions
            if width < self.MIN_WIDTH or height < self.MIN_HEIGHT:
                return (
                    False,
                    f"Image dimensions too small. Minimum: {self.MIN_WIDTH}x{self.MIN_HEIGHT}px",
                )

            # Check maximum dimensions
            if width > self.MAX_WIDTH or height > self.MAX_HEIGHT:
                return (
                    False,
                    f"Image dimensions too large. Maximum: {self.MAX_WIDTH}x{self.MAX_HEIGHT}px",
                )

            # Verify image format matches MIME type
            image_format = image.format.lower() if image.format else None
            if not image_format:
                return False, "Unable to determine image format"

            return True, None

        except Exception as e:
            return False, f"Invalid image file: {str(e)}"

    def generate_blob_name(self, npo_id: uuid.UUID, file_name: str) -> str:
        """Generate a unique blob name for the file.

        Args:
            npo_id: NPO ID
            file_name: Original file name

        Returns:
            Blob name in format: logos/{npo_id}/{timestamp}_{hash}_{filename}
        """
        # Generate timestamp
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        # Generate hash from npo_id and timestamp for uniqueness
        hash_input = f"{npo_id}{timestamp}{file_name}".encode()
        file_hash = hashlib.sha256(hash_input).hexdigest()[:8]

        # Sanitize filename (keep only alphanumeric and extension)
        safe_name = "".join(c for c in file_name if c.isalnum() or c in "._-")

        # Construct blob name
        blob_name = f"logos/{npo_id}/{timestamp}_{file_hash}_{safe_name}"
        return blob_name

    def generate_upload_sas_url(
        self, npo_id: uuid.UUID, file_name: str, content_type: str
    ) -> tuple[str, str]:
        """Generate a pre-signed SAS URL for direct upload to Azure Blob Storage.

        Args:
            npo_id: NPO ID
            file_name: Original file name
            content_type: MIME type of the file

        Returns:
            Tuple of (upload_sas_url, final_blob_url)

        Raises:
            ValueError: If Azure Storage is not configured
        """
        if not self.blob_service_client or not self.settings.azure_storage_account_name:
            raise ValueError(
                "Azure Blob Storage is not configured. "
                "Set AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_ACCOUNT_NAME."
            )

        # Generate blob name
        blob_name = self.generate_blob_name(npo_id, file_name)

        # Get blob client
        blob_client = self.blob_service_client.get_blob_client(
            container=self.container_name, blob=blob_name
        )

        # Generate SAS token with write permissions
        sas_token = generate_blob_sas(
            account_name=self.settings.azure_storage_account_name,
            container_name=self.container_name,
            blob_name=blob_name,
            account_key=self._get_account_key(),
            permission=BlobSasPermissions(write=True, create=True),
            expiry=datetime.utcnow() + timedelta(hours=self.SAS_EXPIRY_HOURS),
        )

        # Construct SAS URL
        sas_url = f"{blob_client.url}?{sas_token}"

        # Final public URL (without SAS)
        public_url = blob_client.url

        return sas_url, public_url

    def generate_upload_url(
        self, npo_id: uuid.UUID, file_name: str, content_type: str, file_size: int
    ) -> dict[str, str | int]:
        """Generate upload URL for logo with validation.

        Uses Azure Blob Storage if configured, otherwise falls back to local storage.

        Args:
            npo_id: NPO ID
            file_name: Original file name
            content_type: MIME type
            file_size: File size in bytes

        Returns:
            Dict with upload_url, logo_url, and expires_in

        Raises:
            ValueError: If validation fails
        """
        # Validate content type
        if content_type not in self.ALLOWED_IMAGE_TYPES:
            raise ValueError(
                f"Invalid content type: {content_type}. "
                f"Allowed: {', '.join(self.ALLOWED_IMAGE_TYPES)}"
            )

        # Validate file size
        if file_size > self.MAX_FILE_SIZE:
            max_mb = self.MAX_FILE_SIZE / (1024 * 1024)
            raise ValueError(f"File size {file_size} bytes exceeds {max_mb}MB limit")

        if file_size <= 0:
            raise ValueError("File size must be greater than 0")

        # Validate file extension
        file_ext = "." + file_name.lower().split(".")[-1] if "." in file_name else ""
        if file_ext not in self.ALLOWED_EXTENSIONS:
            raise ValueError(
                f"Invalid file extension: {file_ext}. Allowed: {', '.join(self.ALLOWED_EXTENSIONS)}"
            )

        # Use Azure Storage if configured, otherwise use local storage
        if self.blob_service_client and self.settings.azure_storage_account_name:
            return self._generate_azure_upload_url(npo_id, file_name, content_type)
        else:
            return self._generate_local_upload_url(npo_id, file_name, content_type)

    def _generate_azure_upload_url(
        self, npo_id: uuid.UUID, file_name: str, content_type: str
    ) -> dict[str, str | int]:
        """Generate Azure Blob Storage SAS URL for upload.

        Args:
            npo_id: NPO ID
            file_name: Original file name
            content_type: MIME type

        Returns:
            Dict with upload_url, logo_url, and expires_in
        """
        # Generate blob name
        blob_name = self.generate_blob_name(npo_id, file_name)

        # Generate upload SAS URL (short expiry for upload)
        upload_url, _public_url = self.generate_upload_sas_url(npo_id, file_name, content_type)

        # Generate read SAS URL with long expiry for logo_url
        # This allows logos to be accessible even when public access is disabled
        logo_url = self.generate_read_sas_url(blob_name, expiry_days=365)

        # Calculate expiry time in seconds
        expires_in = int(self.SAS_EXPIRY_HOURS * 3600)  # Convert hours to seconds

        return {
            "upload_url": upload_url,
            "logo_url": logo_url,
            "expires_in": expires_in,
        }

    def _generate_local_upload_url(
        self, npo_id: uuid.UUID, file_name: str, content_type: str
    ) -> dict[str, str | int]:
        """Generate local storage URL for upload (development mode).

        Args:
            npo_id: NPO ID
            file_name: Original file name
            content_type: MIME type

        Returns:
            Dict with upload_url (local path), logo_url, and expires_in
        """
        # Generate blob name (same format as Azure)
        blob_name = self.generate_blob_name(npo_id, file_name)

        # Strip "logos/" prefix for local storage since our base dir already includes it
        # Azure blob names include "logos/" but local_storage_dir is "static/uploads/logos/"
        if blob_name.startswith("logos/"):
            blob_name = blob_name[6:]  # Remove "logos/" prefix

        # Create NPO-specific directory
        npo_dir = self.local_storage_dir / str(npo_id)
        npo_dir.mkdir(parents=True, exist_ok=True)

        # Local file path
        local_file_path = self.local_storage_dir / blob_name

        # URL that will be returned (for local access)
        # This will be served by FastAPI static files
        logo_url = f"/static/uploads/logos/{blob_name}"

        return {
            "upload_url": str(local_file_path),  # Local path for direct file write
            "logo_url": logo_url,  # Public URL
            "expires_in": 900,  # 15 minutes (same as Azure)
            "is_local": True,  # Flag to indicate local storage
        }

    def upload_file(
        self,
        npo_id: uuid.UUID,
        file_name: str,
        content_type: str,
        file_content: bytes,
    ) -> str:
        """Upload file to Azure Blob Storage or local storage.

        Args:
            npo_id: NPO ID
            file_name: Original file name
            content_type: MIME type
            file_content: File bytes

        Returns:
            Final logo URL (SAS URL for Azure, local URL for local storage)

        Raises:
            ValueError: If upload fails
        """
        # Validate file size
        file_size = len(file_content)
        if file_size > self.MAX_FILE_SIZE:
            max_mb = self.MAX_FILE_SIZE / (1024 * 1024)
            raise ValueError(f"File size {file_size} bytes exceeds {max_mb}MB limit")

        # Validate content type
        if content_type not in self.ALLOWED_IMAGE_TYPES:
            raise ValueError(
                f"Invalid content type: {content_type}. "
                f"Allowed: {', '.join(self.ALLOWED_IMAGE_TYPES)}"
            )

        # Use Azure Storage if configured, otherwise use local storage
        if self.blob_service_client and self.settings.azure_storage_account_name:
            return self._upload_to_azure(npo_id, file_name, content_type, file_content)
        else:
            return self._upload_to_local(npo_id, file_name, file_content)

    def _upload_to_azure(
        self,
        npo_id: uuid.UUID,
        file_name: str,
        content_type: str,
        file_content: bytes,
    ) -> str:
        """Upload file directly to Azure Blob Storage.

        Args:
            npo_id: NPO ID
            file_name: Original file name
            content_type: MIME type
            file_content: File bytes

        Returns:
            Read SAS URL with 365-day expiry

        Raises:
            ValueError: If upload fails
        """
        # Generate blob name
        blob_name = self.generate_blob_name(npo_id, file_name)

        # Get blob client
        if not self.blob_service_client:
            raise ValueError("Azure Blob Storage is not configured")

        blob_client = self.blob_service_client.get_blob_client(
            container=self.container_name, blob=blob_name
        )

        # Upload to Azure
        blob_client.upload_blob(
            file_content,
            blob_type="BlockBlob",
            content_settings=ContentSettings(content_type=content_type),
            overwrite=True,
        )

        # Generate read SAS URL for the uploaded blob
        logo_url = self.generate_read_sas_url(blob_name, expiry_days=365)

        return logo_url

    def _upload_to_local(self, npo_id: uuid.UUID, file_name: str, file_content: bytes) -> str:
        """Upload file to local storage (development mode).

        Args:
            npo_id: NPO ID
            file_name: Original file name
            file_content: File bytes

        Returns:
            Local URL path
        """
        # Generate blob name (same format as Azure)
        blob_name = self.generate_blob_name(npo_id, file_name)

        # Strip "logos/" prefix since local_storage_dir already includes it
        if blob_name.startswith("logos/"):
            blob_name = blob_name[6:]

        # Create NPO-specific directory
        npo_dir = self.local_storage_dir / str(npo_id)
        npo_dir.mkdir(parents=True, exist_ok=True)

        # Local file path
        local_file_path = self.local_storage_dir / blob_name

        # Write file
        local_file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(local_file_path, "wb") as f:
            f.write(file_content)

        # Return URL that will be served by FastAPI static files
        return f"/static/uploads/logos/{blob_name}"

    def generate_read_sas_url(self, blob_name: str, expiry_days: int = 365) -> str:
        """Generate a read-only SAS URL for an uploaded blob.

        This is used for logo_url to allow read access even when
        the storage account has public access disabled.

        Args:
            blob_name: Blob name (e.g., logos/npo-id/filename.png)
            expiry_days: Number of days until SAS token expires (default: 365)

        Returns:
            SAS URL with read permissions

        Raises:
            ValueError: If Azure Storage is not configured
        """
        if not self.blob_service_client or not self.settings.azure_storage_account_name:
            raise ValueError(
                "Azure Blob Storage is not configured. "
                "Set AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_ACCOUNT_NAME."
            )

        # Get blob client
        blob_client = self.blob_service_client.get_blob_client(
            container=self.container_name, blob=blob_name
        )

        # Generate SAS token with read permissions
        sas_token = generate_blob_sas(
            account_name=self.settings.azure_storage_account_name,
            container_name=self.container_name,
            blob_name=blob_name,
            account_key=self._get_account_key(),
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(days=expiry_days),
        )

        # Construct SAS URL
        sas_url = f"{blob_client.url}?{sas_token}"
        return sas_url

    def _get_account_key(self) -> str:
        """Extract account key from connection string.

        Returns:
            Account key

        Raises:
            ValueError: If account key not found in connection string
        """
        if not self.settings.azure_storage_connection_string:
            raise ValueError("Azure Storage connection string not configured")

        # Parse connection string to extract AccountKey
        conn_parts = dict(
            part.split("=", 1)
            for part in self.settings.azure_storage_connection_string.split(";")
            if "=" in part
        )

        account_key = conn_parts.get("AccountKey")
        if not account_key:
            raise ValueError("AccountKey not found in connection string")

        return account_key

    async def delete_file(self, blob_url: str) -> bool:
        """Delete a file from Azure Blob Storage.

        Args:
            blob_url: Full URL of the blob to delete

        Returns:
            True if deleted successfully, False otherwise
        """
        if not self.blob_service_client:
            return False

        try:
            # Extract blob name from URL
            # Format: https://{account}.blob.core.windows.net/{container}/{blob_name}
            blob_name = blob_url.split(f"/{self.container_name}/")[-1]

            # Get blob client
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name, blob=blob_name
            )

            # Delete blob
            blob_client.delete_blob()
            return True

        except Exception:
            return False

    def is_storage_configured(self) -> bool:
        """Check if Azure Blob Storage is properly configured.

        Returns:
            True if storage is configured, False otherwise
        """
        return bool(
            self.settings.azure_storage_connection_string
            and self.settings.azure_storage_account_name
        )
