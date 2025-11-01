"""File upload service for Azure Blob Storage with image validation.

This service handles:
- Logo image uploads for NPO branding
- Image validation (type, size, dimensions)
- Azure Blob Storage SAS URL generation
- Secure file naming and path management
"""

import hashlib
import uuid
from datetime import datetime, timedelta
from io import BytesIO

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

    # Maximum image dimensions
    MAX_WIDTH = 2000
    MAX_HEIGHT = 2000

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

        Convenience wrapper around generate_upload_sas_url that includes
        validation and returns a dict format expected by the API.

        Args:
            npo_id: NPO ID
            file_name: Original file name
            content_type: MIME type
            file_size: File size in bytes

        Returns:
            Dict with upload_url, logo_url, and expires_in

        Raises:
            ValueError: If validation fails or storage not configured
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

        # Generate SAS URL
        upload_url, logo_url = self.generate_upload_sas_url(npo_id, file_name, content_type)

        # Calculate expiry time in seconds
        expires_in = int(self.SAS_EXPIRY_HOURS * 3600)  # Convert hours to seconds

        return {
            "upload_url": upload_url,
            "logo_url": logo_url,
            "expires_in": expires_in,
        }

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

    async def upload_file(
        self, npo_id: uuid.UUID, file_content: bytes, file_name: str, content_type: str
    ) -> str:
        """Upload file directly to Azure Blob Storage (server-side upload).

        Use this method for server-side uploads. For client-side uploads,
        use generate_upload_sas_url() instead.

        Args:
            npo_id: NPO ID
            file_content: File content as bytes
            file_name: Original file name
            content_type: MIME type

        Returns:
            Public URL of the uploaded blob

        Raises:
            ValueError: If validation fails or Azure Storage not configured
        """
        # Validate file
        is_valid, error_msg = self.validate_image_file(file_content, content_type, file_name)
        if not is_valid:
            raise ValueError(error_msg)

        if not self.blob_service_client:
            raise ValueError("Azure Blob Storage is not configured")

        # Generate blob name
        blob_name = self.generate_blob_name(npo_id, file_name)

        # Get blob client
        blob_client = self.blob_service_client.get_blob_client(
            container=self.container_name, blob=blob_name
        )

        # Upload file
        blob_client.upload_blob(
            file_content,
            blob_type="BlockBlob",
            content_settings=ContentSettings(content_type=content_type),
            overwrite=True,
        )

        return str(blob_client.url)

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
