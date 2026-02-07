"""Unit tests for AuctionBidImportService."""

import io
import json
from decimal import Decimal
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from openpyxl import Workbook
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_bid import AuctionBid
from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.event import Event
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.registration_guest import RegistrationGuest
from app.models.user import User
from app.schemas.auction_bid_import import ImportRowStatus
from app.services.auction_bid_import_service import (
    AuctionBidImportService,
    ImportValidationError,
)


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
async def donor_user2(db_session: AsyncSession, test_role):
    """Create a second donor user."""
    user = User(
        email="donor2@example.com",
        password_hash="hashed",
        first_name="Donor",
        last_name="Two",
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
async def auction_item2(db_session: AsyncSession, event, test_user):
    """Create a second auction item."""
    item = AuctionItem(
        event_id=event.id,
        created_by=test_user.id,
        external_id="ITEM-200",
        bid_number=200,
        title="Second Auction Item",
        description="Second test description",
        auction_type=AuctionType.LIVE.value,
        starting_bid=Decimal("50.00"),
        bid_increment=Decimal("5.00"),
        donor_value=Decimal("100.00"),
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


class TestFileParsingJSON:
    """Test JSON file parsing."""

    async def test_parse_valid_json(self, db_session):
        """Test parsing valid JSON file."""
        service = AuctionBidImportService(db_session)
        data = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 150.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_bytes = json.dumps(data).encode("utf-8")

        rows = service._parse_file(file_bytes, "json")

        assert len(rows) == 1
        assert rows[0].row_number == 1
        assert rows[0].data["donor_email"] == "donor@example.com"
        assert rows[0].data["auction_item_code"] == "ITEM-100"

    async def test_parse_empty_json(self, db_session):
        """Test parsing empty JSON file."""
        service = AuctionBidImportService(db_session)
        file_bytes = json.dumps([]).encode("utf-8")

        with pytest.raises(ImportValidationError, match="no data rows"):
            service._parse_file(file_bytes, "json")

    async def test_parse_invalid_json(self, db_session):
        """Test parsing invalid JSON."""
        service = AuctionBidImportService(db_session)
        file_bytes = b"not valid json"

        with pytest.raises(ImportValidationError, match="Invalid JSON"):
            service._parse_file(file_bytes, "json")

    async def test_parse_json_not_array(self, db_session):
        """Test JSON that is not an array."""
        service = AuctionBidImportService(db_session)
        file_bytes = json.dumps({"key": "value"}).encode("utf-8")

        with pytest.raises(ImportValidationError, match="must contain an array"):
            service._parse_file(file_bytes, "json")


class TestFileParsingCSV:
    """Test CSV file parsing."""

    async def test_parse_valid_csv(self, db_session):
        """Test parsing valid CSV file."""
        service = AuctionBidImportService(db_session)
        csv_content = "donor_email,auction_item_code,bid_amount,bid_time\n"
        csv_content += "donor@example.com,ITEM-100,150.00,2026-02-01T19:45:00-06:00\n"
        file_bytes = csv_content.encode("utf-8")

        rows = service._parse_file(file_bytes, "csv")

        assert len(rows) == 1
        assert rows[0].row_number == 2  # Header is row 1
        assert rows[0].data["donor_email"] == "donor@example.com"

    async def test_parse_csv_with_bom(self, db_session):
        """Test parsing CSV with BOM (UTF-8-SIG)."""
        service = AuctionBidImportService(db_session)
        csv_content = "donor_email,auction_item_code,bid_amount,bid_time\n"
        csv_content += "donor@example.com,ITEM-100,150.00,2026-02-01T19:45:00-06:00\n"
        file_bytes = csv_content.encode("utf-8-sig")

        rows = service._parse_file(file_bytes, "csv")

        assert len(rows) == 1

    async def test_parse_empty_csv(self, db_session):
        """Test parsing CSV with only headers."""
        service = AuctionBidImportService(db_session)
        csv_content = "donor_email,auction_item_code,bid_amount,bid_time\n"
        file_bytes = csv_content.encode("utf-8")

        with pytest.raises(ImportValidationError, match="no data rows"):
            service._parse_file(file_bytes, "csv")


class TestFileParsingExcel:
    """Test Excel file parsing."""

    async def test_parse_valid_excel(self, db_session):
        """Test parsing valid Excel file."""
        service = AuctionBidImportService(db_session)

        # Create Excel workbook
        wb = Workbook()
        ws = wb.active
        ws.append(["donor_email", "auction_item_code", "bid_amount", "bid_time"])
        ws.append(["donor@example.com", "ITEM-100", 150.00, "2026-02-01T19:45:00-06:00"])

        # Save to bytes
        output = io.BytesIO()
        wb.save(output)
        file_bytes = output.getvalue()

        rows = service._parse_file(file_bytes, "xlsx")

        assert len(rows) == 1
        assert rows[0].row_number == 2
        assert rows[0].data["donor_email"] == "donor@example.com"


class TestValidation:
    """Test validation logic."""

    async def test_validate_valid_rows(
        self, db_session, event, donor_user, auction_item, registration
    ):
        """Test validation of valid rows."""
        service = AuctionBidImportService(db_session)
        data = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_bytes = json.dumps(data).encode("utf-8")
        parsed_rows = service._parse_file(file_bytes, "json")

        results = await service._validate_rows(event.id, parsed_rows)

        assert len(results) == 1
        assert results[0].status == ImportRowStatus.VALID

    async def test_validate_missing_donor(
        self, db_session, event, auction_item
    ):
        """Test validation with non-existent donor."""
        service = AuctionBidImportService(db_session)
        data = [
            {
                "donor_email": "nonexistent@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_bytes = json.dumps(data).encode("utf-8")
        parsed_rows = service._parse_file(file_bytes, "json")

        results = await service._validate_rows(event.id, parsed_rows)

        assert len(results) == 1
        assert results[0].status == ImportRowStatus.ERROR
        assert "Donor not found" in results[0].message

    async def test_validate_missing_auction_item(
        self, db_session, event, donor_user, registration
    ):
        """Test validation with non-existent auction item."""
        service = AuctionBidImportService(db_session)
        data = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-999",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_bytes = json.dumps(data).encode("utf-8")
        parsed_rows = service._parse_file(file_bytes, "json")

        results = await service._validate_rows(event.id, parsed_rows)

        assert len(results) == 1
        assert results[0].status == ImportRowStatus.ERROR
        assert "Auction item not found" in results[0].message

    async def test_validate_bid_below_minimum(
        self, db_session, event, donor_user, auction_item, registration
    ):
        """Test validation with bid amount below minimum."""
        service = AuctionBidImportService(db_session)

        # Create an existing bid
        existing_bid = AuctionBid(
            event_id=event.id,
            auction_item_id=auction_item.id,
            user_id=donor_user.id,
            bidder_number=100,
            bid_amount=Decimal("120.00"),
            bid_type="regular",
            bid_status="active",
            transaction_status="pending",
            placed_at=datetime.now(UTC),
            created_by=donor_user.id,
        )
        db_session.add(existing_bid)
        await db_session.commit()

        # Try to import bid below minimum (120 + 10 = 130)
        data = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 125.00,  # Below 130
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_bytes = json.dumps(data).encode("utf-8")
        parsed_rows = service._parse_file(file_bytes, "json")

        results = await service._validate_rows(event.id, parsed_rows)

        assert len(results) == 1
        assert results[0].status == ImportRowStatus.ERROR
        assert "below minimum" in results[0].message

    async def test_validate_duplicate_rows(
        self, db_session, event, donor_user, auction_item, registration
    ):
        """Test validation detects duplicate rows."""
        service = AuctionBidImportService(db_session)
        data = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            },
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            },
        ]
        file_bytes = json.dumps(data).encode("utf-8")
        parsed_rows = service._parse_file(file_bytes, "json")

        results = await service._validate_rows(event.id, parsed_rows)

        # Both rows should be marked as errors
        assert len(results) == 2
        assert all(r.status == ImportRowStatus.ERROR for r in results)
        assert all("Duplicate row" in r.message for r in results)

    async def test_validate_missing_required_fields(self, db_session, event):
        """Test validation with missing required fields."""
        service = AuctionBidImportService(db_session)
        data = [
            {
                "donor_email": "donor@example.com",
                # Missing auction_item_code, bid_amount, bid_time
            }
        ]
        file_bytes = json.dumps(data).encode("utf-8")
        parsed_rows = service._parse_file(file_bytes, "json")

        results = await service._validate_rows(event.id, parsed_rows)

        assert len(results) == 1
        assert results[0].status == ImportRowStatus.ERROR
        assert "Missing" in results[0].message


class TestPreflight:
    """Test preflight operation."""

    async def test_preflight_success(
        self, db_session, event, donor_user, auction_item, registration, test_user
    ):
        """Test successful preflight."""
        service = AuctionBidImportService(db_session)
        data = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_bytes = json.dumps(data).encode("utf-8")

        result = await service.preflight(event.id, file_bytes, "json", test_user.id)

        assert result.total_rows == 1
        assert result.valid_rows == 1
        assert result.invalid_rows == 0
        assert len(result.row_errors) == 0

    async def test_preflight_with_errors(
        self, db_session, event, test_user
    ):
        """Test preflight with validation errors."""
        service = AuctionBidImportService(db_session)
        data = [
            {
                "donor_email": "nonexistent@example.com",
                "auction_item_code": "ITEM-999",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_bytes = json.dumps(data).encode("utf-8")

        result = await service.preflight(event.id, file_bytes, "json", test_user.id)

        assert result.total_rows == 1
        assert result.valid_rows == 0
        assert result.invalid_rows == 1
        assert len(result.row_errors) == 1


class TestConfirm:
    """Test confirm operation."""

    async def test_confirm_success(
        self, db_session, event, donor_user, auction_item, registration, test_user
    ):
        """Test successful import confirmation."""
        service = AuctionBidImportService(db_session)
        data = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_bytes = json.dumps(data).encode("utf-8")

        # Run preflight first
        preflight_result = await service.preflight(event.id, file_bytes, "json", test_user.id)
        import_batch_id = preflight_result.import_batch_id

        # Confirm import
        result = await service.confirm(event.id, import_batch_id, file_bytes, "json")

        assert result.created_bids == 1

        # Verify bid was created
        from sqlalchemy import select
        stmt = select(AuctionBid).where(AuctionBid.event_id == event.id)
        bid_result = await db_session.execute(stmt)
        bids = list(bid_result.scalars().all())
        assert len(bids) == 1
        assert bids[0].bid_amount == Decimal("110.00")

    async def test_confirm_file_hash_mismatch(
        self, db_session, event, donor_user, auction_item, registration, test_user
    ):
        """Test confirm with altered file."""
        service = AuctionBidImportService(db_session)
        data1 = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 110.00,
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_bytes1 = json.dumps(data1).encode("utf-8")

        # Run preflight
        preflight_result = await service.preflight(event.id, file_bytes1, "json", test_user.id)

        # Try to confirm with different file
        data2 = [
            {
                "donor_email": "donor@example.com",
                "auction_item_code": "ITEM-100",
                "bid_amount": 120.00,  # Different amount
                "bid_time": "2026-02-01T19:45:00-06:00",
            }
        ]
        file_bytes2 = json.dumps(data2).encode("utf-8")

        with pytest.raises(ImportValidationError, match="changed since preflight"):
            await service.confirm(event.id, preflight_result.import_batch_id, file_bytes2, "json")


class TestDashboard:
    """Test dashboard functionality."""

    async def test_dashboard_with_no_bids(self, db_session, event):
        """Test dashboard with no bids."""
        service = AuctionBidImportService(db_session)

        dashboard = await service.get_dashboard(event.id)

        assert dashboard.total_bid_count == 0
        assert dashboard.total_bid_value == Decimal("0")
        assert len(dashboard.highest_bids) == 0
        assert len(dashboard.recent_bids) == 0

    async def test_dashboard_with_bids(
        self, db_session, event, donor_user, auction_item, registration
    ):
        """Test dashboard with existing bids."""
        # Create some bids
        bid1 = AuctionBid(
            event_id=event.id,
            auction_item_id=auction_item.id,
            user_id=donor_user.id,
            bidder_number=100,
            bid_amount=Decimal("110.00"),
            bid_type="regular",
            bid_status="active",
            transaction_status="pending",
            placed_at=datetime.now(UTC),
            created_by=donor_user.id,
        )
        bid2 = AuctionBid(
            event_id=event.id,
            auction_item_id=auction_item.id,
            user_id=donor_user.id,
            bidder_number=100,
            bid_amount=Decimal("120.00"),
            bid_type="regular",
            bid_status="active",
            transaction_status="pending",
            placed_at=datetime.now(UTC),
            created_by=donor_user.id,
        )
        db_session.add_all([bid1, bid2])
        await db_session.commit()

        service = AuctionBidImportService(db_session)
        dashboard = await service.get_dashboard(event.id)

        assert dashboard.total_bid_count == 2
        assert dashboard.total_bid_value == Decimal("230.00")
        assert len(dashboard.highest_bids) >= 1
        assert len(dashboard.recent_bids) == 2
