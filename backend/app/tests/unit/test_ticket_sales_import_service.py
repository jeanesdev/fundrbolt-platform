"""Unit tests for TicketSalesImportService."""

from decimal import Decimal
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ticket_management import TicketPurchase
from app.models.ticket_sales_import import (
    ImportFormat,
    ImportStatus,
    IssueSeverity,
    TicketSalesImportBatch,
)
from app.services.ticket_sales_import_service import (
    MAX_IMPORT_ROWS,
    TicketSalesImportError,
    TicketSalesImportService,
)


@pytest.mark.asyncio
class TestTicketSalesImportService:
    """Test TicketSalesImportService parsing and validation."""

    async def test_detect_format_csv(self, db_session: AsyncSession) -> None:
        """Test CSV format detection."""
        service = TicketSalesImportService(db_session)
        csv_content = b"ticket_type,purchaser_name\nVIP,John"

        detected = service._detect_format(csv_content, "sales.csv")
        assert detected == ImportFormat.CSV

    async def test_detect_format_json(self, db_session: AsyncSession) -> None:
        """Test JSON format detection."""
        service = TicketSalesImportService(db_session)
        json_content = b'[{"ticket_type": "VIP"}]'

        detected = service._detect_format(json_content, "sales.json")
        assert detected == ImportFormat.JSON

    async def test_parse_csv_valid(self, db_session: AsyncSession) -> None:
        """Test parsing valid CSV file."""
        service = TicketSalesImportService(db_session)
        csv_content = b"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
VIP Table,John Doe,john@example.com,2,500.00,2026-02-01,EXT-001
General,Jane Smith,jane@example.com,1,50.00,2026-02-02,EXT-002"""

        rows = service._parse_csv(csv_content)

        assert len(rows) == 2
        assert rows[0].row_number == 2  # Header is row 1
        assert rows[0].data["ticket_type"] == "VIP Table"
        assert rows[0].data["purchaser_name"] == "John Doe"
        assert rows[1].row_number == 3

    async def test_parse_json_valid(self, db_session: AsyncSession) -> None:
        """Test parsing valid JSON file."""
        service = TicketSalesImportService(db_session)
        json_content = b"""[
            {
                "ticket_type": "VIP Table",
                "purchaser_name": "John Doe",
                "purchaser_email": "john@example.com",
                "quantity": 2,
                "total_amount": 500.00,
                "purchase_date": "2026-02-01",
                "external_sale_id": "EXT-001"
            }
        ]"""

        rows = service._parse_json(json_content)

        assert len(rows) == 1
        assert rows[0].row_number == 1
        assert rows[0].data["ticket_type"] == "VIP Table"
        assert rows[0].data["quantity"] == 2

    async def test_parse_json_invalid(self, db_session: AsyncSession) -> None:
        """Test parsing invalid JSON raises error."""
        service = TicketSalesImportService(db_session)
        invalid_json = b'{"incomplete": '

        with pytest.raises(TicketSalesImportError) as exc_info:
            service._parse_json(invalid_json)

        assert "Invalid JSON" in str(exc_info.value)

    async def test_validate_row_missing_required_field(
        self, db_session: AsyncSession
    ) -> None:
        """Test validation catches missing required fields."""
        service = TicketSalesImportService(db_session)
        from app.services.ticket_sales_import_service import ParsedRow

        row = ParsedRow(
            row_number=1,
            data={
                "ticket_type": "VIP",
                # Missing purchaser_name
                "purchaser_email": "test@example.com",
                "quantity": 1,
                "total_amount": 100.00,
                "purchase_date": "2026-02-01",
                "external_sale_id": "EXT-001",
            },
        )

        issues = service._validate_row(row, {"vip"}, set(), [])

        assert len(issues) == 1
        assert issues[0].severity == IssueSeverity.ERROR
        assert issues[0].field_name == "purchaser_name"
        assert "Missing required field" in issues[0].message

    async def test_validate_row_invalid_quantity(
        self, db_session: AsyncSession
    ) -> None:
        """Test validation catches invalid quantity."""
        service = TicketSalesImportService(db_session)
        from app.services.ticket_sales_import_service import ParsedRow

        row = ParsedRow(
            row_number=1,
            data={
                "ticket_type": "VIP",
                "purchaser_name": "John Doe",
                "purchaser_email": "test@example.com",
                "quantity": "invalid",  # Not a number
                "total_amount": 100.00,
                "purchase_date": "2026-02-01",
                "external_sale_id": "EXT-001",
            },
        )

        issues = service._validate_row(row, {"vip"}, set(), [])

        quantity_issues = [i for i in issues if i.field_name == "quantity"]
        assert len(quantity_issues) == 1
        assert "valid integer" in quantity_issues[0].message

    async def test_validate_row_ticket_type_not_found(
        self, db_session: AsyncSession
    ) -> None:
        """Test validation catches non-existent ticket type."""
        service = TicketSalesImportService(db_session)
        from app.services.ticket_sales_import_service import ParsedRow

        row = ParsedRow(
            row_number=1,
            data={
                "ticket_type": "NonExistent",
                "purchaser_name": "John Doe",
                "purchaser_email": "test@example.com",
                "quantity": 1,
                "total_amount": 100.00,
                "purchase_date": "2026-02-01",
                "external_sale_id": "EXT-001",
            },
        )

        issues = service._validate_row(row, {"vip", "general"}, set(), [])

        ticket_issues = [i for i in issues if i.field_name == "ticket_type"]
        assert len(ticket_issues) == 1
        assert "not found" in ticket_issues[0].message

    async def test_validate_row_duplicate_in_file(
        self, db_session: AsyncSession
    ) -> None:
        """Test validation catches duplicate external_sale_id in file."""
        service = TicketSalesImportService(db_session)
        from app.services.ticket_sales_import_service import ParsedRow

        row = ParsedRow(
            row_number=2,
            data={
                "ticket_type": "VIP",
                "purchaser_name": "John Doe",
                "purchaser_email": "test@example.com",
                "quantity": 1,
                "total_amount": 100.00,
                "purchase_date": "2026-02-01",
                "external_sale_id": "EXT-DUP",
            },
        )

        # Simulate duplicate by passing same ID twice in list
        issues = service._validate_row(
            row, {"vip"}, set(), ["EXT-DUP", "EXT-DUP"]
        )

        dup_issues = [i for i in issues if "Duplicate" in i.message]
        assert len(dup_issues) == 1
        assert dup_issues[0].severity == IssueSeverity.ERROR

    async def test_validate_row_existing_external_id(
        self, db_session: AsyncSession
    ) -> None:
        """Test validation warns about existing external_sale_id."""
        service = TicketSalesImportService(db_session)
        from app.services.ticket_sales_import_service import ParsedRow

        row = ParsedRow(
            row_number=1,
            data={
                "ticket_type": "VIP",
                "purchaser_name": "John Doe",
                "purchaser_email": "test@example.com",
                "quantity": 1,
                "total_amount": 100.00,
                "purchase_date": "2026-02-01",
                "external_sale_id": "EXT-EXISTS",
            },
        )

        # Pass existing ID in existing_ids set
        issues = service._validate_row(
            row, {"vip"}, {"EXT-EXISTS"}, ["EXT-EXISTS"]
        )

        warning_issues = [i for i in issues if i.severity == IssueSeverity.WARNING]
        assert len(warning_issues) == 1
        assert "already exists" in warning_issues[0].message

    async def test_validate_row_negative_amount(
        self, db_session: AsyncSession
    ) -> None:
        """Test validation catches negative total_amount."""
        service = TicketSalesImportService(db_session)
        from app.services.ticket_sales_import_service import ParsedRow

        row = ParsedRow(
            row_number=1,
            data={
                "ticket_type": "VIP",
                "purchaser_name": "John Doe",
                "purchaser_email": "test@example.com",
                "quantity": 1,
                "total_amount": -50.00,
                "purchase_date": "2026-02-01",
                "external_sale_id": "EXT-001",
            },
        )

        issues = service._validate_row(row, {"vip"}, set(), [])

        amount_issues = [i for i in issues if i.field_name == "total_amount"]
        assert len(amount_issues) == 1
        assert "non-negative" in amount_issues[0].message

    async def test_row_limit_enforcement(
        self, db_session: AsyncSession, test_event: any, test_user: any
    ) -> None:
        """Test that files over MAX_IMPORT_ROWS are rejected."""
        service = TicketSalesImportService(db_session)

        # Create CSV with MAX_IMPORT_ROWS + 1 rows
        header = "ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id\n"
        rows = "\n".join(
            [
                f"VIP,Person{i},email{i}@example.com,1,100.00,2026-02-01,EXT-{i}"
                for i in range(MAX_IMPORT_ROWS + 1)
            ]
        )
        csv_content = (header + rows).encode()

        with pytest.raises(TicketSalesImportError) as exc_info:
            await service.preflight(
                test_event.id, csv_content, "large.csv", created_by=test_user.id
            )

        assert "Maximum allowed is 5000" in str(exc_info.value)


@pytest.mark.asyncio
class TestTicketSalesImportPreflight:
    """Test preflight validation flow."""

    async def test_preflight_success_no_errors(
        self,
        db_session: AsyncSession,
        test_event: any,
        test_ticket_package: any,
        test_user: any,
    ) -> None:
        """Test successful preflight with valid data."""
        service = TicketSalesImportService(db_session)

        csv_content = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,1,100.00,2026-02-01,EXT-001
{test_ticket_package.name},Jane Smith,jane@example.com,2,200.00,2026-02-02,EXT-002""".encode()

        result = await service.preflight(
            test_event.id, csv_content, "sales.csv", created_by=test_user.id
        )

        assert result.total_rows == 2
        assert result.valid_rows == 2
        assert result.error_rows == 0
        assert result.warning_rows == 0
        assert result.detected_format == "csv"
        assert result.preflight_id  # Should have UUID

    async def test_preflight_creates_batch_record(
        self,
        db_session: AsyncSession,
        test_event: any,
        test_ticket_package: any,
        test_user: any,
    ) -> None:
        """Test that preflight creates import batch record."""
        service = TicketSalesImportService(db_session)

        csv_content = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,1,100.00,2026-02-01,EXT-001""".encode()

        result = await service.preflight(
            test_event.id, csv_content, "sales.csv", created_by=test_user.id
        )

        # Verify batch record was created
        stmt = select(TicketSalesImportBatch).where(
            TicketSalesImportBatch.id == UUID(result.preflight_id)
        )
        batch_result = await db_session.execute(stmt)
        batch = batch_result.scalar_one()

        assert batch.status == ImportStatus.PREFLIGHTED
        assert batch.source_filename == "sales.csv"
        assert batch.source_format == ImportFormat.CSV
        assert batch.row_count == 1
        assert batch.valid_count == 1


@pytest.mark.asyncio
class TestTicketSalesImportCommit:
    """Test import commit flow."""

    async def test_commit_creates_purchases(
        self,
        db_session: AsyncSession,
        test_event: any,
        test_ticket_package: any,
        test_user: any,
    ) -> None:
        """Test that commit creates ticket purchases."""
        service = TicketSalesImportService(db_session)

        csv_content = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,2,200.00,2026-02-01,EXT-001""".encode()

        # Run preflight first
        preflight_result = await service.preflight(
            test_event.id, csv_content, "sales.csv", created_by=test_user.id
        )
        await db_session.commit()

        # Run commit
        import_result = await service.commit_import(
            test_event.id,
            UUID(preflight_result.preflight_id),
            csv_content,
            test_user.id,
        )
        await db_session.commit()

        assert import_result.created_rows == 1
        assert import_result.skipped_rows == 0
        assert import_result.failed_rows == 0

        # Verify purchase was created
        stmt = select(TicketPurchase).where(
            TicketPurchase.external_sale_id == "EXT-001"
        )
        result = await db_session.execute(stmt)
        purchase = result.scalar_one()

        assert purchase.quantity == 2
        assert purchase.total_price == Decimal("200.00")
        assert purchase.purchaser_name == "John Doe"
        assert purchase.purchaser_email == "john@example.com"

    async def test_commit_updates_sold_count(
        self,
        db_session: AsyncSession,
        test_event: any,
        test_ticket_package: any,
        test_user: any,
    ) -> None:
        """Test that commit updates ticket package sold_count."""
        service = TicketSalesImportService(db_session)

        initial_sold_count = test_ticket_package.sold_count

        csv_content = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,3,300.00,2026-02-01,EXT-001""".encode()

        # Run preflight and commit
        preflight_result = await service.preflight(
            test_event.id, csv_content, "sales.csv", created_by=test_user.id
        )
        await db_session.commit()

        await service.commit_import(
            test_event.id,
            UUID(preflight_result.preflight_id),
            csv_content,
            test_user.id,
        )
        await db_session.commit()

        # Refresh package to get updated sold_count
        await db_session.refresh(test_ticket_package)

        assert test_ticket_package.sold_count == initial_sold_count + 3

    async def test_commit_skips_duplicate_external_id(
        self,
        db_session: AsyncSession,
        test_event: any,
        test_ticket_package: any,
        test_user: any,
    ) -> None:
        """Test that commit skips rows with existing external_sale_id."""
        service = TicketSalesImportService(db_session)

        # First import
        csv_content1 = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,1,100.00,2026-02-01,EXT-001""".encode()

        preflight1 = await service.preflight(
            test_event.id, csv_content1, "sales1.csv", created_by=test_user.id
        )
        await db_session.commit()
        await service.commit_import(
            test_event.id, UUID(preflight1.preflight_id), csv_content1, test_user.id
        )
        await db_session.commit()

        # Second import with same external_sale_id
        csv_content2 = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},Jane Smith,jane@example.com,1,100.00,2026-02-02,EXT-001""".encode()

        preflight2 = await service.preflight(
            test_event.id, csv_content2, "sales2.csv", created_by=test_user.id
        )
        await db_session.commit()

        import_result = await service.commit_import(
            test_event.id, UUID(preflight2.preflight_id), csv_content2, test_user.id
        )

        assert import_result.created_rows == 0
        assert import_result.skipped_rows == 1
        assert len(import_result.warnings) == 1

    async def test_commit_rejects_changed_file(
        self,
        db_session: AsyncSession,
        test_event: any,
        test_ticket_package: any,
        test_user: any,
    ) -> None:
        """Test that commit rejects file if checksum doesn't match."""
        service = TicketSalesImportService(db_session)

        csv_content1 = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,1,100.00,2026-02-01,EXT-001""".encode()

        # Run preflight
        preflight_result = await service.preflight(
            test_event.id, csv_content1, "sales.csv", created_by=test_user.id
        )
        await db_session.commit()

        # Try to commit with different file
        csv_content2 = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},Jane Smith,jane@example.com,1,100.00,2026-02-02,EXT-002""".encode()

        with pytest.raises(TicketSalesImportError) as exc_info:
            await service.commit_import(
                test_event.id,
                UUID(preflight_result.preflight_id),
                csv_content2,
                test_user.id,
            )

        assert "File has changed" in str(exc_info.value)

    async def test_commit_rejects_preflight_with_errors(
        self,
        db_session: AsyncSession,
        test_event: any,
        test_ticket_package: any,
        test_user: any,
    ) -> None:
        """Test that commit rejects preflight batch with errors."""
        service = TicketSalesImportService(db_session)

        # Create file with errors (missing required field)
        csv_content = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},,john@example.com,1,100.00,2026-02-01,EXT-001""".encode()

        # Run preflight (should have errors)
        preflight_result = await service.preflight(
            test_event.id, csv_content, "sales.csv", created_by=test_user.id
        )
        await db_session.commit()

        assert preflight_result.error_rows > 0

        # Try to commit
        with pytest.raises(TicketSalesImportError) as exc_info:
            await service.commit_import(
                test_event.id,
                UUID(preflight_result.preflight_id),
                csv_content,
                test_user.id,
            )

        assert "with errors" in str(exc_info.value)
