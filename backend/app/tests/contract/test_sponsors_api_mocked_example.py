"""Example: Sponsor API tests using mocked Azure Storage.

This file demonstrates how to refactor sponsor tests to use the existing
mock_azure_storage fixture instead of requiring real Azure credentials.

To use these mocked tests:
1. Copy test functions from test_sponsors_api.py
2. Add 'mock_azure_storage' parameter to test signature
3. Remove '@pytest.mark.requires_azure_storage' marker
4. Tests will now run in CI without Azure Storage credentials!
"""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


class TestSponsorCreationMocked:
    """Example: Sponsor creation tests with mocked Azure Storage."""

    async def test_create_sponsor_with_default_logo_size(
        self,
        mock_azure_storage: Any,  # <-- Add this fixture
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test sponsor creation defaults logo_size to 'large' (MOCKED VERSION)."""
        from app.models.sponsor import Sponsor

        payload = {
            "name": "Acme Corporation",
            "logo_file_name": "acme-logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }

        # This now uses the mocked Azure Storage from the fixture
        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        # Assert response contract (same as before)
        assert response.status_code == 201
        data = response.json()

        # Verify sponsor data
        assert "sponsor" in data
        sponsor = data["sponsor"]
        assert sponsor["name"] == "Acme Corporation"
        assert sponsor["logo_size"] == "large"  # Default value per Sponsor model
        assert sponsor["event_id"] == str(test_event.id)

        # Verify upload_url returned (mocked SAS URL)
        assert "upload_url" in data
        assert data["upload_url"].startswith("https://")
        assert "mock_sas_token" in data["upload_url"]  # From mock
        assert "expires_at" in data

        # Verify database persistence
        from sqlalchemy import select

        stmt = select(Sponsor).where(Sponsor.id == sponsor["id"])
        result = await db_session.execute(stmt)
        db_sponsor = result.scalar_one()

        assert db_sponsor.name == "Acme Corporation"
        assert db_sponsor.logo_size == "large"

    async def test_create_sponsor_with_all_logo_sizes(
        self,
        mock_azure_storage: Any,  # <-- Add this fixture
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test logo_size accepts all enum values (MOCKED VERSION)."""
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

            # Verify mock was used
            assert "mock_sas_token" in data["upload_url"]


# ============================================================================
# MIGRATION GUIDE: How to Convert Existing Tests
# ============================================================================
#
# 1. Find the test in test_sponsors_api.py that has this marker:
#    @pytest.mark.requires_azure_storage
#
# 2. Copy the entire test function
#
# 3. Add 'mock_azure_storage' parameter:
#    Before:
#      async def test_example(
#          self,
#          npo_admin_client: AsyncClient,
#      ) -> None:
#
#    After:
#      async def test_example(
#          self,
#          mock_azure_storage: Any,  # <-- ADD THIS
#          npo_admin_client: AsyncClient,
#      ) -> None:
#
# 4. Remove the @pytest.mark.requires_azure_storage decorator
#
# 5. Update assertions to check for mocked values:
#    Before:
#      assert "upload_url" in data
#
#    After (optionally verify mock):
#      assert "upload_url" in data
#      assert "mock_sas_token" in data["upload_url"]
#
# 6. Move the test to this file OR replace the original in test_sponsors_api.py
#
# 7. Run the test:
#    poetry run pytest app/tests/contract/test_sponsors_api_mocked_example.py -v
#
# The test will now run WITHOUT requiring Azure Storage credentials!
#
# ============================================================================


@pytest.mark.asyncio
class TestAuctionMediaMocked:
    """Example: Auction item media tests with mocked Azure Storage."""

    async def test_generate_upload_url_for_image(
        self,
        mock_azure_storage: Any,  # <-- Add this fixture
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test generating upload URL for auction item image (MOCKED VERSION)."""
        from app.models.auction_item import AuctionItem

        # Create auction item first
        item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            starting_bid=100.00,
            bid_increment=10.00,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)

        # Request upload URL for image
        payload = {
            "file_name": "item-photo.jpg",
            "file_type": "image/jpeg",
            "file_size": 1024000,  # 1MB
            "media_type": "image",
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items/{item.id}/media/upload-url",
            json=payload,
        )

        # Assert response
        assert response.status_code == 200
        data = response.json()

        # Verify upload URL structure
        assert "upload_url" in data
        assert isinstance(data["upload_url"], str)
        assert "mock_sas_token" in data["upload_url"]  # Mocked SAS token

        # Verify media metadata
        assert "media_id" in data
        assert "expires_at" in data


# ============================================================================
# BENEFITS OF MOCKING
# ============================================================================
#
# ✅ Faster tests - No network calls to Azure
# ✅ No cost - No Azure API usage charges
# ✅ No rate limits - Run unlimited times
# ✅ Deterministic - Same results every time
# ✅ Offline testing - Works without internet
# ✅ CI/CD friendly - No secrets configuration needed
# ✅ Better test isolation - No external dependencies
#
# When to use REAL Azure services:
# - E2E tests (run less frequently, e.g., nightly)
# - Production deployment validation
# - Performance/load testing
# - Manual testing during development
#
# ============================================================================
