"""Set Azure Blob Storage container to public access for development.

This script sets the 'npo-assets' container to allow public read access to blobs.
This is suitable for development but should use SAS URLs in production.
"""

from azure.storage.blob import BlobServiceClient, PublicAccess

from app.core.config import get_settings

settings = get_settings()

# Validate required settings
if not settings.azure_storage_connection_string:
    raise ValueError(
        "Azure storage connection string not configured. "
        "Set AZURE_STORAGE_CONNECTION_STRING environment variable."
    )

# Initialize blob service client
blob_service_client = BlobServiceClient.from_connection_string(
    settings.azure_storage_connection_string
)

# Get container client
container_name = settings.azure_storage_container_name
container_client = blob_service_client.get_container_client(container_name)

# Set public access level to Blob (allows anonymous read access to blobs but not container listing)
print(f"Setting container '{container_name}' to public blob access...")
container_client.set_container_access_policy(
    signed_identifiers={},
    public_access=PublicAccess.Blob,  # type: ignore[arg-type]
)
print(f"✓ Container '{container_name}' is now publicly accessible for blob reads")
print("Note: This is for development. Use SAS URLs in production.")
