"""Unit tests for RegistrationImportService."""

import io
import json

import pytest
from openpyxl import Workbook
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.schemas.registration_import import (
    ImportRowStatus,
    ValidationIssueSeverity,
)
from app.services.registration_import_service import (
    MAX_IMPORT_ROWS,
    RegistrationImportError,
    RegistrationImportService,
)


@pytest.fixture
async def import_service(db_session: AsyncSession):
    """Create a RegistrationImportService instance."""
    return RegistrationImportService(db_session)


@pytest.mark.asyncio
class TestFileDetection:
    """Test file type detection."""

    async def test_detect_json_file(self, import_service: RegistrationImportService):
        """Test JSON file detection."""
        file_type = import_service._detect_file_type("registrations.json")
        assert file_type == "json"

    async def test_detect_csv_file(self, import_service: RegistrationImportService):
        """Test CSV file detection."""
        file_type = import_service._detect_file_type("registrations.csv")
        assert file_type == "csv"

    async def test_detect_xlsx_file(self, import_service: RegistrationImportService):
        """Test Excel file detection."""
        file_type = import_service._detect_file_type("registrations.xlsx")
        assert file_type == "xlsx"

    async def test_detect_xls_file(self, import_service: RegistrationImportService):
        """Test old Excel file detection."""
        file_type = import_service._detect_file_type("registrations.xls")
        assert file_type == "xlsx"

    async def test_reject_unsupported_file(self, import_service: RegistrationImportService):
        """Test unsupported file type rejection."""
        with pytest.raises(RegistrationImportError, match="Unsupported file type"):
            import_service._detect_file_type("registrations.txt")


@pytest.mark.asyncio
class TestJSONParsing:
    """Test JSON file parsing."""

    async def test_parse_valid_json(self, import_service: RegistrationImportService):
        """Test parsing valid JSON array."""
        data = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "quantity": 2,
                "external_registration_id": "REG-001",
            }
        ]
        json_bytes = json.dumps(data).encode("utf-8")

        rows = import_service._parse_json(json_bytes)

        assert len(rows) == 1
        assert rows[0].row_number == 1
        assert rows[0].data["registrant_name"] == "John Doe"
        assert rows[0].data["registrant_email"] == "john@example.com"

    async def test_parse_json_with_optional_fields(self, import_service: RegistrationImportService):
        """Test parsing JSON with optional fields."""
        data = [
            {
                "registrant_name": "Jane Smith",
                "registrant_email": "jane@example.com",
                "registration_date": "2026-02-02",
                "quantity": 1,
                "external_registration_id": "REG-002",
                "registrant_phone": "555-1234",
                "bidder_number": 100,
                "table_number": 5,
                "guest_count": 1,
                "notes": "Special request",
            }
        ]
        json_bytes = json.dumps(data).encode("utf-8")

        rows = import_service._parse_json(json_bytes)

        assert rows[0].data["registrant_phone"] == "555-1234"
        assert rows[0].data["bidder_number"] == 100
        assert rows[0].data["table_number"] == 5

    async def test_reject_non_array_json(self, import_service: RegistrationImportService):
        """Test rejection of non-array JSON."""
        data = {"not": "an array"}
        json_bytes = json.dumps(data).encode("utf-8")

        with pytest.raises(RegistrationImportError, match="must contain an array"):
            import_service._parse_json(json_bytes)

    async def test_reject_empty_json(self, import_service: RegistrationImportService):
        """Test rejection of empty JSON array."""
        json_bytes = json.dumps([]).encode("utf-8")

        with pytest.raises(RegistrationImportError, match="contains no data"):
            import_service._parse_json(json_bytes)

    async def test_reject_invalid_json(self, import_service: RegistrationImportService):
        """Test rejection of invalid JSON syntax."""
        invalid_json = b'{"invalid": json}'

        with pytest.raises(RegistrationImportError, match="Invalid JSON"):
            import_service._parse_json(invalid_json)

    async def test_enforce_row_limit_json(self, import_service: RegistrationImportService):
        """Test enforcement of maximum row limit in JSON."""
        data = [
            {
                "registrant_name": f"Person {i}",
                "registrant_email": f"person{i}@example.com",
                "registration_date": "2026-02-01",
                "quantity": 1,
                "external_registration_id": f"REG-{i:05d}",
            }
            for i in range(MAX_IMPORT_ROWS + 1)
        ]
        json_bytes = json.dumps(data).encode("utf-8")

        with pytest.raises(RegistrationImportError, match=f"exceeds maximum of {MAX_IMPORT_ROWS}"):
            import_service._parse_json(json_bytes)


@pytest.mark.asyncio
class TestCSVParsing:
    """Test CSV file parsing."""

    async def test_parse_valid_csv(self, import_service: RegistrationImportService):
        """Test parsing valid CSV file."""
        csv_content = """registrant_name,registrant_email,registration_date,quantity,external_registration_id
    John Doe,john@example.com,2026-02-01,2,REG-001
    Jane Smith,jane@example.com,2026-02-02,1,REG-002"""

        csv_bytes = csv_content.encode("utf-8")
        rows = import_service._parse_csv(csv_bytes)

        assert len(rows) == 2
        assert rows[0].row_number == 2  # First data row after header
        assert rows[0].data["registrant_name"] == "John Doe"
        assert rows[1].data["registrant_email"] == "jane@example.com"

    async def test_parse_csv_with_optional_fields(self, import_service: RegistrationImportService):
        """Test parsing CSV with optional fields."""
        csv_content = """registrant_name,registrant_email,registration_date,quantity,external_registration_id,registrant_phone,bidder_number
    John Doe,john@example.com,2026-02-01,2,REG-001,555-1234,100"""

        csv_bytes = csv_content.encode("utf-8")
        rows = import_service._parse_csv(csv_bytes)

        assert rows[0].data["registrant_phone"] == "555-1234"
        assert rows[0].data["bidder_number"] == "100"

    async def test_skip_empty_csv_rows(self, import_service: RegistrationImportService):
        """Test skipping empty rows in CSV."""
        csv_content = """registrant_name,registrant_email,registration_date,quantity,external_registration_id
    John Doe,john@example.com,2026-02-01,2,REG-001

    Jane Smith,jane@example.com,2026-02-02,1,REG-002"""

        csv_bytes = csv_content.encode("utf-8")
        rows = import_service._parse_csv(csv_bytes)

        assert len(rows) == 2  # Empty row skipped

    async def test_reject_csv_missing_required_headers(
        self, import_service: RegistrationImportService
    ):
        """Test rejection of CSV with missing required headers."""
        csv_content = """registrant_name,registrant_email
John Doe,john@example.com"""

        csv_bytes = csv_content.encode("utf-8")

        with pytest.raises(RegistrationImportError, match="Missing required columns"):
            import_service._parse_csv(csv_bytes)

    async def test_reject_empty_csv(self, import_service: RegistrationImportService):
        """Test rejection of empty CSV."""
        csv_bytes = b""

        with pytest.raises(RegistrationImportError, match="CSV is empty"):
            import_service._parse_csv(csv_bytes)

    async def test_reject_non_utf8_csv(self, import_service: RegistrationImportService):
        """Test rejection of non-UTF-8 encoded CSV."""
        csv_bytes = b"\xff\xfe"  # Invalid UTF-8

        with pytest.raises(RegistrationImportError, match="must be UTF-8 encoded"):
            import_service._parse_csv(csv_bytes)


@pytest.mark.asyncio
class TestExcelParsing:
    """Test Excel file parsing."""

    async def test_parse_valid_excel(self, import_service: RegistrationImportService):
        """Test parsing valid Excel file."""
        wb = Workbook()
        ws = wb.active
        ws.append(
            [
                "registrant_name",
                "registrant_email",
                "registration_date",
                "quantity",
                "external_registration_id",
            ]
        )
        ws.append(
            [
                "John Doe",
                "john@example.com",
                "2026-02-01",
                2,
                "REG-001",
            ]
        )

        excel_buffer = io.BytesIO()
        wb.save(excel_buffer)
        excel_bytes = excel_buffer.getvalue()

        rows = import_service._parse_excel(excel_bytes)

        assert len(rows) == 1
        assert rows[0].row_number == 2
        assert rows[0].data["registrant_name"] == "John Doe"

    async def test_reject_empty_excel(self, import_service: RegistrationImportService):
        """Test rejection of empty Excel workbook."""
        wb = Workbook()
        excel_buffer = io.BytesIO()
        wb.save(excel_buffer)
        excel_bytes = excel_buffer.getvalue()

        with pytest.raises(RegistrationImportError, match="workbook is empty"):
            import_service._parse_excel(excel_bytes)

    async def test_reject_invalid_excel(self, import_service: RegistrationImportService):
        """Test rejection of invalid Excel file."""
        invalid_bytes = b"not an excel file"

        with pytest.raises(RegistrationImportError, match="Invalid Excel file"):
            import_service._parse_excel(invalid_bytes)


@pytest.mark.asyncio
class TestValidation:
    """Test validation logic."""

    async def test_validate_all_required_fields_present(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
    ):
        """Test validation passes with all required fields."""
        from app.services.registration_import_service import ParsedRow

        rows = [
            ParsedRow(
                row_number=1,
                data={
                    "registrant_name": "John Doe",
                    "registrant_email": "john@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 2,
                    "external_registration_id": "REG-001",
                },
            )
        ]

        results = await import_service._validate_rows(test_event.id, rows, set())

        assert len(results) == 1
        assert results[0].status == ImportRowStatus.CREATED
        assert (
            len([i for i in results[0].issues if i.severity == ValidationIssueSeverity.ERROR]) == 0
        )

    async def test_validate_missing_required_field(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
    ):
        """Test validation fails with missing required field."""
        from app.services.registration_import_service import ParsedRow

        rows = [
            ParsedRow(
                row_number=1,
                data={
                    "registrant_name": "",  # Empty required field
                    "registrant_email": "john@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 2,
                    "external_registration_id": "REG-001",
                },
            )
        ]

        results = await import_service._validate_rows(test_event.id, rows, set())

        assert results[0].status == ImportRowStatus.ERROR
        errors = [i for i in results[0].issues if i.severity == ValidationIssueSeverity.ERROR]
        assert len(errors) > 0
        assert any("registrant_name" in e.message for e in errors)

    async def test_validate_duplicate_external_id_in_file(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
    ):
        """Test validation detects duplicate external IDs in file."""
        from app.services.registration_import_service import ParsedRow

        rows = [
            ParsedRow(
                row_number=1,
                data={
                    "registrant_name": "John Doe",
                    "registrant_email": "john@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 1,
                    "external_registration_id": "REG-DUP",
                },
            ),
            ParsedRow(
                row_number=2,
                data={
                    "registrant_name": "Jane Smith",
                    "registrant_email": "jane@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 1,
                    "external_registration_id": "REG-DUP",  # Duplicate
                },
            ),
        ]

        results = await import_service._validate_rows(test_event.id, rows, set())

        # Second row should have duplicate error
        assert results[1].status == ImportRowStatus.ERROR
        errors = [i for i in results[1].issues if i.severity == ValidationIssueSeverity.ERROR]
        assert any("Duplicate" in e.message for e in errors)

    async def test_validate_existing_external_id_warning(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
    ):
        """Test validation warns about existing external IDs."""
        from app.services.registration_import_service import ParsedRow

        existing_ids = {"REG-EXISTS"}
        rows = [
            ParsedRow(
                row_number=1,
                data={
                    "registrant_name": "John Doe",
                    "registrant_email": "john@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 1,
                    "external_registration_id": "REG-EXISTS",
                },
            )
        ]

        results = await import_service._validate_rows(test_event.id, rows, existing_ids)

        assert results[0].status == ImportRowStatus.SKIPPED
        warnings = [i for i in results[0].issues if i.severity == ValidationIssueSeverity.WARNING]
        assert len(warnings) > 0
        assert any("already exists" in w.message for w in warnings)

    async def test_validate_nonexistent_ticket_purchase(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
    ):
        """Test validation fails with non-existent ticket purchase."""
        from uuid import uuid4

        from app.services.registration_import_service import ParsedRow

        rows = [
            ParsedRow(
                row_number=1,
                data={
                    "registrant_name": "John Doe",
                    "registrant_email": "john@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 1,
                    "external_registration_id": "REG-001",
                    "ticket_purchase_id": str(uuid4()),
                },
            )
        ]

        results = await import_service._validate_rows(test_event.id, rows, set())

        assert results[0].status == ImportRowStatus.ERROR
        errors = [i for i in results[0].issues if i.severity == ValidationIssueSeverity.ERROR]
        assert any("Ticket purchase not found" in e.message for e in errors)

    async def test_validate_invalid_quantity(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
    ):
        """Test validation fails with invalid quantity."""
        from app.services.registration_import_service import ParsedRow

        rows = [
            ParsedRow(
                row_number=1,
                data={
                    "registrant_name": "John Doe",
                    "registrant_email": "john@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 0,  # Invalid: must be >= 1
                    "external_registration_id": "REG-001",
                },
            )
        ]

        results = await import_service._validate_rows(test_event.id, rows, set())

        assert results[0].status == ImportRowStatus.ERROR
        errors = [i for i in results[0].issues if i.severity == ValidationIssueSeverity.ERROR]
        assert any("quantity" in e.message.lower() for e in errors)

    async def test_validate_invalid_date_format(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
    ):
        """Test validation fails with invalid date format."""
        from app.services.registration_import_service import ParsedRow

        rows = [
            ParsedRow(
                row_number=1,
                data={
                    "registrant_name": "John Doe",
                    "registrant_email": "john@example.com",
                    "registration_date": "02/01/2026",  # Invalid format
                    "quantity": 1,
                    "external_registration_id": "REG-001",
                },
            )
        ]

        results = await import_service._validate_rows(test_event.id, rows, set())

        assert results[0].status == ImportRowStatus.ERROR
        errors = [i for i in results[0].issues if i.severity == ValidationIssueSeverity.ERROR]
        assert any("date" in e.message.lower() for e in errors)

    async def test_validate_event_id_mismatch_warning(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
    ):
        """Test validation warns about event_id mismatch."""
        from app.services.registration_import_service import ParsedRow

        rows = [
            ParsedRow(
                row_number=1,
                data={
                    "event_id": "DIFFERENT-EVENT-ID",
                    "registrant_name": "John Doe",
                    "registrant_email": "john@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 1,
                    "external_registration_id": "REG-001",
                },
            )
        ]

        results = await import_service._validate_rows(test_event.id, rows, set())

        warnings = [i for i in results[0].issues if i.severity == ValidationIssueSeverity.WARNING]
        assert any("event_id" in w.message for w in warnings)

    async def test_validate_guest_requires_parent(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
    ):
        """Test guest row fails when parent registration is missing."""
        from app.services.registration_import_service import ParsedRow

        rows = [
            ParsedRow(
                row_number=1,
                data={
                    "guest_of_email": "parent@example.com",
                    "registrant_name": "Guest User",
                    "registrant_email": "guest@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 1,
                    "external_registration_id": "",
                },
            )
        ]

        results = await import_service._validate_rows(test_event.id, rows, set())

        assert results[0].status == ImportRowStatus.ERROR
        errors = [i for i in results[0].issues if i.severity == ValidationIssueSeverity.ERROR]
        assert any("parent registration" in e.message.lower() for e in errors)

    async def test_validate_guest_duplicate_email_per_parent(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
    ):
        """Test duplicate guest email per parent fails preflight."""
        from app.services.registration_import_service import ParsedRow

        rows = [
            ParsedRow(
                row_number=1,
                data={
                    "registrant_name": "Parent User",
                    "registrant_email": "parent@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 2,
                    "guest_count": 2,
                    "external_registration_id": "REG-001",
                },
            ),
            ParsedRow(
                row_number=2,
                data={
                    "guest_of_email": "parent@example.com",
                    "registrant_name": "Guest One",
                    "registrant_email": "guest@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 1,
                    "external_registration_id": "",
                },
            ),
            ParsedRow(
                row_number=3,
                data={
                    "guest_of_email": "parent@example.com",
                    "registrant_name": "Guest Two",
                    "registrant_email": "guest@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 1,
                    "external_registration_id": "",
                },
            ),
        ]

        results = await import_service._validate_rows(test_event.id, rows, set())

        assert results[2].status == ImportRowStatus.ERROR
        errors = [i for i in results[2].issues if i.severity == ValidationIssueSeverity.ERROR]
        assert any("duplicate guest email" in e.message.lower() for e in errors)

    async def test_validate_guest_rows_exceed_guest_count(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
    ):
        """Test guest rows exceeding guest_count fail preflight."""
        from app.services.registration_import_service import ParsedRow

        rows = [
            ParsedRow(
                row_number=1,
                data={
                    "registrant_name": "Parent User",
                    "registrant_email": "parent@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 2,
                    "guest_count": 2,
                    "external_registration_id": "REG-001",
                },
            ),
            ParsedRow(
                row_number=2,
                data={
                    "guest_of_email": "parent@example.com",
                    "registrant_name": "Guest One",
                    "registrant_email": "guest1@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 1,
                    "external_registration_id": "",
                },
            ),
            ParsedRow(
                row_number=3,
                data={
                    "guest_of_email": "parent@example.com",
                    "registrant_name": "Guest Two",
                    "registrant_email": "guest2@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 1,
                    "external_registration_id": "",
                },
            ),
        ]

        results = await import_service._validate_rows(test_event.id, rows, set())

        assert results[2].status == ImportRowStatus.ERROR
        errors = [i for i in results[2].issues if i.severity == ValidationIssueSeverity.ERROR]
        assert any("guest rows exceed" in e.message.lower() for e in errors)

    async def test_validate_food_option_not_found(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
    ):
        """Test invalid food option fails preflight."""
        from app.services.registration_import_service import ParsedRow

        rows = [
            ParsedRow(
                row_number=1,
                data={
                    "registrant_name": "Parent User",
                    "registrant_email": "parent@example.com",
                    "registration_date": "2026-02-01",
                    "quantity": 1,
                    "external_registration_id": "REG-001",
                    "food_option": "No Such Option",
                },
            )
        ]

        results = await import_service._validate_rows(test_event.id, rows, set())

        assert results[0].status == ImportRowStatus.ERROR
        errors = [i for i in results[0].issues if i.severity == ValidationIssueSeverity.ERROR]
        assert any("food option" in e.message.lower() for e in errors)


@pytest.mark.asyncio
class TestReportBuilding:
    """Test import report building."""

    async def test_build_report_with_all_statuses(self, import_service: RegistrationImportService):
        """Test report building with mixed results."""
        from app.schemas.registration_import import ImportRowResult, ValidationIssue

        results = [
            ImportRowResult(
                row_number=1,
                external_id="REG-001",
                registrant_name="John Doe",
                registrant_email="john@example.com",
                status=ImportRowStatus.CREATED,
                message="Valid",
                issues=[],
            ),
            ImportRowResult(
                row_number=2,
                external_id="REG-002",
                registrant_name="Jane Smith",
                registrant_email="jane@example.com",
                status=ImportRowStatus.SKIPPED,
                message="Skipped",
                issues=[
                    ValidationIssue(
                        row_number=2,
                        severity=ValidationIssueSeverity.WARNING,
                        field_name="external_registration_id",
                        message="Already exists",
                    )
                ],
            ),
            ImportRowResult(
                row_number=3,
                external_id="REG-003",
                registrant_name="Bob Jones",
                registrant_email="bob@example.com",
                status=ImportRowStatus.ERROR,
                message="Error",
                issues=[
                    ValidationIssue(
                        row_number=3,
                        severity=ValidationIssueSeverity.ERROR,
                        field_name="quantity",
                        message="Invalid quantity",
                    )
                ],
            ),
        ]

        report = import_service._build_report(results, "json")

        assert report.total_rows == 3
        assert report.created_count == 1
        assert report.skipped_count == 1
        assert report.failed_count == 1
        assert report.valid_rows == 1
        assert report.error_rows == 1
        assert report.warning_rows == 1
        assert report.file_type == "json"
