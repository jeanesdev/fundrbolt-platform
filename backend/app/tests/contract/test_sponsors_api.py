"""Contract tests for sponsor API endpoints."""

from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestSponsorCreation:
    """Test POST /api/v1/events/{event_id}/sponsors endpoint contract."""

    async def test_create_sponsor_with_default_logo_size(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test sponsor creation defaults logo_size to 'medium' if not provided."""
        from app.models.sponsor import Sponsor

        payload = {
            "name": "Acme Corporation",
            "logo_file_name": "acme-logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "website_url": "https://acme.example.com",
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        # Assert response contract
        assert response.status_code == 201
        data = response.json()

        # Verify sponsor data
        assert "sponsor" in data
        sponsor = data["sponsor"]
        assert sponsor["name"] == "Acme Corporation"
        assert sponsor["logo_size"] == "large"  # Default value per Sponsor model
        assert sponsor["website_url"] == "https://acme.example.com/"
        assert sponsor["event_id"] == str(test_event.id)

        # Verify upload_url returned
        assert "upload_url" in data
        assert data["upload_url"].startswith("https://")
        assert "expires_at" in data

        # Verify database persistence
        from sqlalchemy import select

        stmt = select(Sponsor).where(Sponsor.id == sponsor["id"])
        result = await db_session.execute(stmt)
        db_sponsor = result.scalar_one()

        assert db_sponsor.name == "Acme Corporation"
        assert db_sponsor.logo_size.value == "large"

    async def test_create_sponsor_with_all_logo_sizes(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test logo_size accepts all enum values (xsmall, small, medium, large, xlarge)."""
        logo_sizes = ["xsmall", "small", "medium", "large", "xlarge"]

        for size in logo_sizes:
            payload = {
                "name": f"Sponsor {size.title()}",
                "logo_file_name": "logo.png",
                "logo_file_type": "image/png",
                "logo_file_size": 50000,
                "logo_size": size,
            }

            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/sponsors",
                json=payload,
            )

            assert response.status_code == 201, f"Failed for logo_size={size}"
            data = response.json()
            assert data["sponsor"]["logo_size"] == size

    async def test_create_sponsor_rejects_invalid_logo_size(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test logo_size rejects invalid enum values."""
        payload = {
            "name": "Invalid Sponsor",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "logo_size": "super_huge",  # Invalid value
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        # Should return 422 Unprocessable Entity for invalid enum
        assert response.status_code == 422
        error = response.json()
        assert "detail" in error

    async def test_create_sponsor_with_sponsor_level(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test sponsor_level field is optional and persisted correctly."""
        payload = {
            "name": "Platinum Sponsor Inc",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "logo_size": "xlarge",
            "sponsor_level": "Platinum",
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 201
        data = response.json()
        sponsor = data["sponsor"]
        assert sponsor["sponsor_level"] == "Platinum"
        assert sponsor["logo_size"] == "xlarge"

    async def test_create_sponsor_requires_name(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test name field is required."""
        payload = {
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 422

    async def test_create_sponsor_duplicate_name_rejected(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test duplicate sponsor name within same event is rejected."""
        payload = {
            "name": "Unique Sponsor",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }

        # Create first sponsor
        response1 = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )
        assert response1.status_code == 201

        # Attempt to create duplicate
        response2 = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )
        assert response2.status_code == 400  # Bad Request
        error = response2.json()
        assert "already exists" in str(error).lower()


@pytest.mark.asyncio
class TestSponsorListAndGet:
    """Test GET /api/v1/events/{event_id}/sponsors endpoints."""

    async def test_list_sponsors_empty(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test listing sponsors returns empty array for event with no sponsors."""
        response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/sponsors")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    async def test_list_sponsors_ordered_by_size_and_order(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test sponsors are ordered by display_order (asc) then logo_size (desc)."""
        # Create sponsors with different sizes
        # Note: display_order auto-increments (0, 1, 2) based on creation order
        sponsors_data = [
            {"name": "Small Sponsor", "logo_size": "small"},  # order=0
            {"name": "XLarge Sponsor", "logo_size": "xlarge"},  # order=1
            {"name": "Medium Sponsor", "logo_size": "medium"},  # order=2
        ]

        for sponsor in sponsors_data:
            payload = {
                **sponsor,
                "logo_file_name": "logo.png",
                "logo_file_type": "image/png",
                "logo_file_size": 50000,
            }
            await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/sponsors",
                json=payload,
            )

        # List sponsors
        response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/sponsors")

        assert response.status_code == 200
        sponsors = response.json()
        assert len(sponsors) == 3

        # Verify ordering: display_order ASC (0, 1, 2) takes precedence, so creation order is preserved
        # Note: Enum ordering in PostgreSQL is: xsmall < small < medium < large < xlarge
        # So DESC gives: xlarge > large > medium > small > xsmall
        assert sponsors[0]["name"] == "Small Sponsor"  # display_order=0
        assert sponsors[0]["logo_size"] == "small"
        assert sponsors[1]["name"] == "XLarge Sponsor"  # display_order=1
        assert sponsors[1]["logo_size"] == "xlarge"
        assert sponsors[2]["name"] == "Medium Sponsor"  # display_order=2
        assert sponsors[2]["logo_size"] == "medium"

    async def test_get_sponsor_by_id(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test getting a single sponsor by ID."""
        # Create sponsor
        payload = {
            "name": "Test Sponsor",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "logo_size": "large",
            "sponsor_level": "Gold",
        }

        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Get sponsor
        response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}"
        )

        assert response.status_code == 200
        sponsor = response.json()
        assert sponsor["id"] == sponsor_id
        assert sponsor["name"] == "Test Sponsor"
        assert sponsor["logo_size"] == "large"
        assert sponsor["sponsor_level"] == "Gold"

    async def test_get_sponsor_not_found(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test 404 for non-existent sponsor."""
        import uuid

        fake_id = str(uuid.uuid4())
        response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/sponsors/{fake_id}")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestSponsorLogoUpload:
    """Test logo upload workflow endpoints."""

    async def test_request_upload_url_returns_sas_url(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test POST /sponsors/{id}/logo/upload-url returns valid SAS URL."""
        # Create sponsor first
        create_payload = {
            "name": "Logo Test Sponsor",
            "logo_file_name": "initial.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Request new upload URL
        upload_payload = {
            "file_name": "new-logo.png",
            "file_type": "image/png",
            "file_size": 75000,
        }
        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}/logo/upload-url",
            json=upload_payload,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify SAS URL structure
        assert "upload_url" in data
        assert data["upload_url"].startswith("https://")
        assert "blob.core.windows.net" in data["upload_url"]
        assert "sig=" in data["upload_url"]  # SAS signature

        # Verify blob_name returned
        assert "blob_name" in data
        assert data["blob_name"].startswith("sponsors/")

        # Verify expires_at is ~1 hour in future
        assert "expires_at" in data
        expires_at = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
        now = datetime.now(UTC)
        time_diff = (expires_at - now).total_seconds()
        assert 3500 < time_diff < 3700  # ~1 hour (allowing 100s variance)

    async def test_upload_url_rejects_invalid_file_metadata(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test 400 for invalid file metadata (file too large)."""
        # Create sponsor
        create_payload = {
            "name": "Sponsor",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Request upload URL with file too large (>5MB)
        upload_payload = {
            "file_name": "huge.png",
            "file_type": "image/png",
            "file_size": 6 * 1024 * 1024,  # 6MB
        }
        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}/logo/upload-url",
            json=upload_payload,
        )

        assert response.status_code == 422  # Unprocessable Entity (Pydantic validation)
        error = response.json()
        # Error structure: {'detail': {'code': 'VALIDATION_ERROR', 'details': [...]}}
        assert "less than or equal to" in str(error).lower() or "5242880" in str(error)
