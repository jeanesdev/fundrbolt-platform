"""Tests for SponsorLogoService."""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.sponsor_logo_service import SponsorLogoService

# File validation tests


@pytest.mark.asyncio
async def test_validate_file_size_valid():
    """Test file size validation with valid 4MB file."""
    # GIVEN
    file_size = 4 * 1024 * 1024  # 4MB

    # WHEN
    is_valid, error = SponsorLogoService.validate_logo_file("image/png", file_size)

    # THEN
    assert is_valid is True
    assert error is None


@pytest.mark.asyncio
async def test_validate_file_size_at_limit():
    """Test file size validation at 5MB limit."""
    # GIVEN
    file_size = 5 * 1024 * 1024  # 5MB exactly

    # WHEN
    is_valid, error = SponsorLogoService.validate_logo_file("image/png", file_size)

    # THEN
    assert is_valid is True
    assert error is None


@pytest.mark.asyncio
async def test_validate_file_size_too_large():
    """Test file size validation with 6MB file (exceeds limit)."""
    # GIVEN
    file_size = 6 * 1024 * 1024  # 6MB

    # WHEN
    is_valid, error = SponsorLogoService.validate_logo_file("image/png", file_size)

    # THEN
    assert is_valid is False
    assert "exceeds" in error.lower()
    assert "5" in error  # Should mention 5MB limit


@pytest.mark.asyncio
async def test_validate_file_type_png():
    """Test PNG file type validation."""
    is_valid, error = SponsorLogoService.validate_logo_file("image/png", 1024 * 1024)
    assert is_valid is True
    assert error is None


@pytest.mark.asyncio
async def test_validate_file_type_jpeg():
    """Test JPEG file type validation."""
    is_valid, error = SponsorLogoService.validate_logo_file("image/jpeg", 1024 * 1024)
    assert is_valid is True
    assert error is None


@pytest.mark.asyncio
async def test_validate_file_type_jpg():
    """Test JPG file type validation."""
    is_valid, error = SponsorLogoService.validate_logo_file("image/jpg", 1024 * 1024)
    assert is_valid is True
    assert error is None


@pytest.mark.asyncio
async def test_validate_file_type_webp():
    """Test WebP file type validation."""
    is_valid, error = SponsorLogoService.validate_logo_file("image/webp", 1024 * 1024)
    assert is_valid is True
    assert error is None


@pytest.mark.asyncio
async def test_validate_file_type_svg():
    """Test SVG file type validation."""
    is_valid, error = SponsorLogoService.validate_logo_file("image/svg+xml", 1024 * 1024)
    assert is_valid is True
    assert error is None


@pytest.mark.asyncio
async def test_validate_file_type_invalid():
    """Test PDF file type is rejected."""
    is_valid, error = SponsorLogoService.validate_logo_file("application/pdf", 1024 * 1024)
    assert is_valid is False
    assert "invalid file type" in error.lower()


@pytest.mark.asyncio
async def test_validate_file_zero_size():
    """Test zero file size is rejected."""
    is_valid, error = SponsorLogoService.validate_logo_file("image/png", 0)
    assert is_valid is False
    assert "greater than 0" in error.lower()


@pytest.mark.asyncio
async def test_validate_file_negative_size():
    """Test negative file size is rejected."""
    is_valid, error = SponsorLogoService.validate_logo_file("image/png", -100)
    assert is_valid is False
    assert "greater than 0" in error.lower()


# Blob name generation tests


@pytest.mark.asyncio
async def test_generate_blob_name_format():
    """Test blob name format includes npo_id, sponsor_id, timestamp, and filename."""
    # GIVEN
    npo_id = uuid.uuid4()
    sponsor_id = uuid.uuid4()
    filename = "test_logo.png"

    # WHEN
    blob_name = SponsorLogoService.generate_blob_name(npo_id, sponsor_id, filename)

    # THEN
    assert blob_name.startswith(f"sponsors/{npo_id}/{sponsor_id}/")
    assert "test_logo.png" in blob_name
    # Should have timestamp and hash
    parts = blob_name.split("/")[-1].split("_")
    assert len(parts) >= 3  # timestamp_hash_filename


@pytest.mark.asyncio
async def test_generate_upload_url_structure():
    """Test upload URL generation structure with mocked Azure."""
    # GIVEN
    npo_id = uuid.uuid4()
    sponsor_id = uuid.uuid4()
    file_name = "logo.png"
    file_type = "image/png"
    file_size = 1024 * 1024  # 1MB

    def mock_generate_sas(*args, **kwargs):
        """Mock SAS token generation."""
        return f"mock_sas_token_{datetime.utcnow().timestamp()}"

    # WHEN
    with (
        patch(
            "app.services.sponsor_logo_service.SponsorLogoService._get_blob_client"
        ) as mock_blob_client,
        patch("app.services.sponsor_logo_service.generate_blob_sas", side_effect=mock_generate_sas),
    ):
        # Mock blob service client
        mock_client = MagicMock()
        mock_client.account_name = "testaccount"
        mock_client.credential.account_key = "test_key"
        mock_blob_client.return_value = mock_client

        mock_db = AsyncMock()

        upload_url, expires_at = await SponsorLogoService.generate_upload_url(
            db=mock_db,
            sponsor_id=sponsor_id,
            npo_id=npo_id,
            file_name=file_name,
            file_type=file_type,
            file_size=file_size,
        )

        # THEN
        assert upload_url.startswith("https://testaccount.blob.core.windows.net/")
        assert f"sponsors/{npo_id}/{sponsor_id}/" in upload_url
        assert "logo.png" in upload_url
        assert "mock_sas_token" in upload_url

        # Check expiry is ~1 hour from now
        expiry_time = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        now = datetime.now(expiry_time.tzinfo)
        time_diff = (expiry_time - now).total_seconds()
        assert 3500 < time_diff < 3700  # ~1 hour (with some tolerance)


# Edge cases


@pytest.mark.asyncio
async def test_validate_file_empty_filename():
    """Test validation with empty filename still works (filename not validated in validate_logo_file)."""
    # validate_logo_file only checks file_type and file_size
    is_valid, error = SponsorLogoService.validate_logo_file("image/png", 1024)
    assert is_valid is True
    assert error is None


@pytest.mark.asyncio
async def test_generate_blob_name_sanitizes_filename():
    """Test blob name sanitizes special characters in filename."""
    # GIVEN
    npo_id = uuid.uuid4()
    sponsor_id = uuid.uuid4()
    filename = "test logo!@#$%^&*.png"

    # WHEN
    blob_name = SponsorLogoService.generate_blob_name(npo_id, sponsor_id, filename)

    # THEN
    # Should contain only alphanumeric, dots, dashes, underscores
    blob_filename = blob_name.split("/")[-1]
    for char in blob_filename:
        assert char.isalnum() or char in ".-_", f"Unexpected character '{char}' in blob name"
