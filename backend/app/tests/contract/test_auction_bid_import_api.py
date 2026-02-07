"""Contract tests for auction bid import API."""

import io
import json
from decimal import Decimal
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from openpyxl import Workbook
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.event import Event
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.registration_guest import RegistrationGuest
from app.models.user import User


@pytest.fixture
async def event(db_session: AsyncSession, test_npo, test_user):
    """Create a test event."""
    event = Event(
        npo_id=test_npo.id,
        name="Test Event",
        slug="test-event",
        event_date=datetime.now(UTC),
        description="Test event description",
        created_by=test_user.id,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


@pytest.fixture
async def donor_user(db_session: AsyncSession, test_role):
    """Create a donor user."""
    user = User(
        email="donor@example.com",
        password_hash="hashed",
        first_name="Donor",
        last_name="User",
        role_id=test_role.id,
        email_verified=True,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def auction_item(db_session: AsyncSession, event, test_user):
    """Create an auction item."""
    item = AuctionItem(
        event_id=event.id,
        created_by=test_user.id,
        external_id="ITEM-100",
        bid_number=100,
        title="Test Auction Item",
        description="Test description",
        auction_type=AuctionType.SILENT.value,
        starting_bid=Decimal("100.00"),
        bid_increment=Decimal("10.00"),
        donor_value=Decimal("200.00"),
        status=ItemStatus.PUBLISHED.value,
        quantity_available=1,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


@pytest.fixture
async def registration(db_session: AsyncSession, event, donor_user):
    """Create event registration with bidder number."""
    registration = EventRegistration(
        event_id=event.id,
        user_id=donor_user.id,
        status=RegistrationStatus.CONFIRMED,
        number_of_guests=1,
    )
    db_session.add(registration)
    await db_session.commit()
    await db_session.refresh(registration)

    guest = RegistrationGuest(
        registration_id=registration.id,
        user_id=donor_user.id,
        name="Donor User",
        bidder_number=100,
    )
    db_session.add(guest)
    await db_session.commit()

    return registration


@pytest.mark.asyncio
class TestDashboardEndpoint:
    """Test dashboard API endpoint."""

    async def test_get_dashboard(
        self,
        authenticated_client: AsyncClient,
        event: Event,
    ):
        """Test getting auction bids dashboard."""
        response = await authenticated_client.get(
            f"/api/v1/events/{event.id}/auction/bids/dashboard"
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_bid_count" in data
        assert "total_bid_value" in data
        assert "highest_bids" in data
        assert "recent_bids" in data
        assert isinstance(data["highest_bids"], list)
        assert isinstance(data["recent_bids"], list)

    async def test_dashboard_requires_auth(self, client: AsyncClient, event: Event):
        """Test dashboard requires authentication."""
        response = await client.get(f"/api/v1/events/{event.id}/auction/bids/dashboard")

        assert response.status_code == 401

    async def test_dashboard_event_not_found(self, authenticated_client: AsyncClient):
        """Test dashboard with non-existent event."""
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        response = await authenticated_client.get(
            f"/api/v1/events/{fake_uuid}/auction/bids/dashboard"
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestPreflightEndpoint:
    """Test preflight API endpoint."""

    async def test_preflight_json_success(
        self,
        authenticated_client: AsyncClient,
        event: Event,
        donor_user: User,
        auction_item: AuctionItem,
        registration: EventRegistration,
    ):
        """Test successful preflight with JSON file."""
        data = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_content = json.dumps(data).encode("utf-8")

        response = await authenticated_client.post(
            f"/api/v1/events/{event.id}/auction/bids/import/preflight",
            data={"file_type": "json"},
            files={"file": ("bids.json", io.BytesIO(file_content), "application/json")},
        )

        assert response.status_code == 200
        result = response.json()
        assert "import_batch_id" in result
        assert result["total_rows"] == 1
        assert result["valid_rows"] == 1
        assert result["invalid_rows"] == 0
        assert len(result["row_errors"]) == 0

    async def test_preflight_csv_success(
        self,
        authenticated_client: AsyncClient,
        event: Event,
        donor_user: User,
        auction_item: AuctionItem,
        registration: EventRegistration,
    ):
        """Test successful preflight with CSV file."""
        csv_content = "donor_email,auction_item_code,bid_amount,bid_time\n"
        csv_content += "donor@example.com,ITEM-100,110.00,2026-02-01T19:45:00-06:00\n"
        file_content = csv_content.encode("utf-8")

        response = await authenticated_client.post(
            f"/api/v1/events/{event.id}/auction/bids/import/preflight",
            data={"file_type": "csv"},
            files={"file": ("bids.csv", io.BytesIO(file_content), "text/csv")},
        )

        assert response.status_code == 200
        result = response.json()
        assert result["valid_rows"] == 1

    async def test_preflight_excel_success(
        self,
        authenticated_client: AsyncClient,
        event: Event,
        donor_user: User,
        auction_item: AuctionItem,
        registration: EventRegistration,
    ):
        """Test successful preflight with Excel file."""
        wb = Workbook()
        ws = wb.active
        ws.append(["donor_email", "auction_item_code", "bid_amount", "bid_time"])
        ws.append(["donor@example.com", "ITEM-100", 110.00, "2026-02-01T19:45:00-06:00"])

        output = io.BytesIO()
        wb.save(output)
        file_content = output.getvalue()

        response = await authenticated_client.post(
            f"/api/v1/events/{event.id}/auction/bids/import/preflight",
            data={"file_type": "xlsx"},
            files={
                "file": (
                    "bids.xlsx",
                    io.BytesIO(file_content),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )

        assert response.status_code == 200
        result = response.json()
        assert result["valid_rows"] == 1

    async def test_preflight_with_validation_errors(
        self,
        authenticated_client: AsyncClient,
        event: Event,
    ):
        """Test preflight with validation errors."""
        data = [
            {
                "donor_email": "nonexistent@example.com",
                "auction_item_code": "ITEM-999",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_content = json.dumps(data).encode("utf-8")

        response = await authenticated_client.post(
            f"/api/v1/events/{event.id}/auction/bids/import/preflight",
            data={"file_type": "json"},
            files={"file": ("bids.json", io.BytesIO(file_content), "application/json")},
        )

        assert response.status_code == 200
        result = response.json()
        assert result["total_rows"] == 1
        assert result["valid_rows"] == 0
        assert result["invalid_rows"] == 1
        assert len(result["row_errors"]) == 1
        assert result["row_errors"][0]["status"] == "error"

    async def test_preflight_invalid_file_type(
        self,
        authenticated_client: AsyncClient,
        event: Event,
    ):
        """Test preflight with invalid file type."""
        file_content = b"test"

        response = await authenticated_client.post(
            f"/api/v1/events/{event.id}/auction/bids/import/preflight",
            data={"file_type": "pdf"},
            files={"file": ("bids.pdf", io.BytesIO(file_content), "application/pdf")},
        )

        assert response.status_code == 400
        assert "Invalid file_type" in response.json()["detail"]

    async def test_preflight_requires_auth(self, client: AsyncClient, event: Event):
        """Test preflight requires authentication."""
        file_content = b"test"

        response = await client.post(
            f"/api/v1/events/{event.id}/auction/bids/import/preflight",
            data={"file_type": "json"},
            files={"file": ("bids.json", io.BytesIO(file_content), "application/json")},
        )

        assert response.status_code == 401


@pytest.mark.asyncio
class TestConfirmEndpoint:
    """Test confirm API endpoint."""

    async def test_confirm_success(
        self,
        authenticated_client: AsyncClient,
        event: Event,
        donor_user: User,
        auction_item: AuctionItem,
        registration: EventRegistration,
    ):
        """Test successful import confirmation."""
        data = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_content = json.dumps(data).encode("utf-8")

        # First, run preflight
        preflight_response = await authenticated_client.post(
            f"/api/v1/events/{event.id}/auction/bids/import/preflight",
            data={"file_type": "json"},
            files={"file": ("bids.json", io.BytesIO(file_content), "application/json")},
        )
        assert preflight_response.status_code == 200
        import_batch_id = preflight_response.json()["import_batch_id"]

        # Now confirm
        response = await authenticated_client.post(
            f"/api/v1/events/{event.id}/auction/bids/import/confirm",
            data={"file_type": "json", "import_batch_id": import_batch_id},
            files={"file": ("bids.json", io.BytesIO(file_content), "application/json")},
        )

        assert response.status_code == 200
        result = response.json()
        assert "import_batch_id" in result
        assert result["created_bids"] == 1
        assert "started_at" in result
        assert "completed_at" in result

    async def test_confirm_without_preflight(
        self,
        authenticated_client: AsyncClient,
        event: Event,
    ):
        """Test confirm without preflight."""
        data = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_content = json.dumps(data).encode("utf-8")

        fake_batch_id = "00000000-0000-0000-0000-000000000000"
        response = await authenticated_client.post(
            f"/api/v1/events/{event.id}/auction/bids/import/confirm",
            data={"file_type": "json", "import_batch_id": fake_batch_id},
            files={"file": ("bids.json", io.BytesIO(file_content), "application/json")},
        )

        assert response.status_code == 400
        assert "not found" in response.json()["detail"]

    async def test_confirm_altered_file(
        self,
        authenticated_client: AsyncClient,
        event: Event,
        donor_user: User,
        auction_item: AuctionItem,
        registration: EventRegistration,
    ):
        """Test confirm with file different from preflight."""
        data1 = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_content1 = json.dumps(data1).encode("utf-8")

        # Run preflight
        preflight_response = await authenticated_client.post(
            f"/api/v1/events/{event.id}/auction/bids/import/preflight",
            data={"file_type": "json"},
            files={"file": ("bids.json", io.BytesIO(file_content1), "application/json")},
        )
        import_batch_id = preflight_response.json()["import_batch_id"]

        # Try to confirm with different file
        data2 = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 120.00,  # Different amount
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_content2 = json.dumps(data2).encode("utf-8")

        response = await authenticated_client.post(
            f"/api/v1/events/{event.id}/auction/bids/import/confirm",
            data={"file_type": "json", "import_batch_id": import_batch_id},
            files={"file": ("bids.json", io.BytesIO(file_content2), "application/json")},
        )

        assert response.status_code == 400
        assert "changed since preflight" in response.json()["detail"]

    async def test_confirm_requires_auth(self, client: AsyncClient, event: Event):
        """Test confirm requires authentication."""
        file_content = b"test"

        response = await client.post(
            f"/api/v1/events/{event.id}/auction/bids/import/confirm",
            data={"file_type": "json", "import_batch_id": "fake-id"},
            files={"file": ("bids.json", io.BytesIO(file_content), "application/json")},
        )

        assert response.status_code == 401
