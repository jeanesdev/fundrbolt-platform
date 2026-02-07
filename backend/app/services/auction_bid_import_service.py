"""Service for auction bid bulk import."""

from __future__ import annotations

import csv
import hashlib
import io
import json
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_bid import AuctionBid, BidStatus, BidType, TransactionStatus
from app.models.auction_bid_import import AuctionBidImportBatch, ImportBatchStatus
from app.models.auction_item import AuctionItem
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest
from app.models.user import User
from app.schemas.auction_bid_import import (
    BidImportRow,
    BidsDashboard,
    HighestBid,
    ImportRowResult,
    ImportRowStatus,
    ImportSummary,
    PreflightResult,
    RecentBid,
)

MAX_IMPORT_ROWS = 10000


class ImportValidationError(Exception):
    """Raised when import file validation fails."""


@dataclass
class ParsedRow:
    """Parsed row from import file."""

    row_number: int
    data: dict[str, Any]


class AuctionBidImportService:
    """Bulk import service for auction bids."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_dashboard(self, event_id: UUID) -> BidsDashboard:
        """Get auction bids dashboard summary."""
        # Get total bid count and value
        count_query = select(AuctionBid).where(AuctionBid.event_id == event_id)
        result = await self.db.execute(count_query)
        all_bids = list(result.scalars().all())

        total_bid_count = len(all_bids)
        total_bid_value = sum(bid.bid_amount for bid in all_bids)

        # Get highest bid per item
        highest_bids_data: dict[UUID, AuctionBid] = {}
        for bid in all_bids:
            if bid.auction_item_id not in highest_bids_data or (
                bid.bid_amount > highest_bids_data[bid.auction_item_id].bid_amount
            ):
                highest_bids_data[bid.auction_item_id] = bid

        # Fetch auction items and users for highest bids
        highest_bids: list[HighestBid] = []
        for bid in list(highest_bids_data.values())[:10]:  # Limit to top 10
            item_query = select(AuctionItem).where(AuctionItem.id == bid.auction_item_id)
            item_result = await self.db.execute(item_query)
            item = item_result.scalar_one_or_none()

            user_query = select(User).where(User.id == bid.user_id)
            user_result = await self.db.execute(user_query)
            user = user_result.scalar_one_or_none()

            if item and user:
                highest_bids.append(
                    HighestBid(
                        auction_item_code=item.external_id,
                        bid_amount=bid.bid_amount,
                        bidder_email=user.email,
                    )
                )

        # Get recent bids (last 20)
        recent_bids_list = sorted(all_bids, key=lambda b: b.placed_at, reverse=True)[:20]
        recent_bids: list[RecentBid] = []
        for bid in recent_bids_list:
            item_query = select(AuctionItem).where(AuctionItem.id == bid.auction_item_id)
            item_result = await self.db.execute(item_query)
            item = item_result.scalar_one_or_none()

            user_query = select(User).where(User.id == bid.user_id)
            user_result = await self.db.execute(user_query)
            user = user_result.scalar_one_or_none()

            if item and user:
                recent_bids.append(
                    RecentBid(
                        auction_item_code=item.external_id,
                        bid_amount=bid.bid_amount,
                        bidder_email=user.email,
                        bid_time=bid.placed_at,
                    )
                )

        return BidsDashboard(
            total_bid_count=total_bid_count,
            total_bid_value=Decimal(str(total_bid_value)),
            highest_bids=highest_bids,
            recent_bids=recent_bids,
        )

    async def preflight(
        self, event_id: UUID, file_bytes: bytes, file_type: str, user_id: UUID
    ) -> PreflightResult:
        """Run preflight validation on import file."""
        # Parse file based on type
        parsed_rows = self._parse_file(file_bytes, file_type)

        # Validate rows
        results = await self._validate_rows(event_id, parsed_rows)

        # Count results
        valid_count = sum(1 for r in results if r.status == ImportRowStatus.VALID)
        invalid_count = sum(1 for r in results if r.status == ImportRowStatus.ERROR)

        # Calculate file hash for confirmation
        file_hash = hashlib.sha256(file_bytes).hexdigest()

        # Create import batch record
        batch = AuctionBidImportBatch(
            event_id=event_id,
            initiated_by_user_id=user_id,
            status=ImportBatchStatus.PREFLIGHTED.value,
            total_rows=len(parsed_rows),
            valid_rows=valid_count,
            invalid_rows=invalid_count,
            created_bids=0,
            file_hash=file_hash,
            validation_errors={"errors": [r.model_dump() for r in results if r.status == ImportRowStatus.ERROR]},
            preflighted_at=datetime.now(UTC),
        )
        self.db.add(batch)
        await self.db.commit()
        await self.db.refresh(batch)

        return PreflightResult(
            import_batch_id=str(batch.id),
            total_rows=len(parsed_rows),
            valid_rows=valid_count,
            invalid_rows=invalid_count,
            row_errors=[r for r in results if r.status == ImportRowStatus.ERROR],
        )

    async def confirm(
        self, event_id: UUID, import_batch_id: str, file_bytes: bytes, file_type: str
    ) -> ImportSummary:
        """Confirm and execute the import."""
        # Verify batch exists and is in correct state
        batch_query = select(AuctionBidImportBatch).where(
            AuctionBidImportBatch.id == UUID(import_batch_id),
            AuctionBidImportBatch.event_id == event_id,
            AuctionBidImportBatch.status == ImportBatchStatus.PREFLIGHTED.value,
        )
        result = await self.db.execute(batch_query)
        batch = result.scalar_one_or_none()
        if not batch:
            raise ImportValidationError("Import batch not found or already processed")

        # Verify file hash matches
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        if batch.file_hash != file_hash:
            raise ImportValidationError(
                "File has changed since preflight. Please run preflight again."
            )

        started_at = datetime.now(UTC)

        # Parse and validate again
        parsed_rows = self._parse_file(file_bytes, file_type)
        results = await self._validate_rows(event_id, parsed_rows)

        # Check if any errors exist
        error_results = [r for r in results if r.status == ImportRowStatus.ERROR]
        if error_results:
            batch.status = ImportBatchStatus.FAILED.value
            batch.completed_at = datetime.now(UTC)
            batch.import_notes = "Import failed due to validation errors"
            await self.db.commit()
            raise ImportValidationError("Validation errors found. Import aborted.")

        # Create all bids
        created_count = 0
        try:
            for parsed in parsed_rows:
                row_data = BidImportRow(**self._coerce_row(parsed.data))
                await self._create_bid(event_id, row_data)
                created_count += 1

            # Update batch status
            batch.status = ImportBatchStatus.COMPLETED.value
            batch.created_bids = created_count
            batch.completed_at = datetime.now(UTC)
            await self.db.commit()

        except Exception as exc:
            await self.db.rollback()
            batch.status = ImportBatchStatus.FAILED.value
            batch.completed_at = datetime.now(UTC)
            batch.import_notes = f"Import failed: {str(exc)}"
            await self.db.commit()
            raise ImportValidationError(f"Import failed: {str(exc)}") from exc

        return ImportSummary(
            import_batch_id=str(batch.id),
            created_bids=created_count,
            started_at=started_at,
            completed_at=datetime.now(UTC),
        )

    def _parse_file(self, file_bytes: bytes, file_type: str) -> list[ParsedRow]:
        """Parse import file based on type."""
        if file_type == "json":
            return self._parse_json(file_bytes)
        elif file_type == "csv":
            return self._parse_csv(file_bytes)
        elif file_type == "xlsx":
            return self._parse_excel(file_bytes)
        else:
            raise ImportValidationError(f"Unsupported file type: {file_type}")

    def _parse_json(self, file_bytes: bytes) -> list[ParsedRow]:
        """Parse JSON file."""
        try:
            content = file_bytes.decode("utf-8")
            data = json.loads(content)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ImportValidationError("Invalid JSON file") from exc

        if not isinstance(data, list):
            raise ImportValidationError("JSON file must contain an array of bids")

        if len(data) > MAX_IMPORT_ROWS:
            raise ImportValidationError(f"File exceeds maximum of {MAX_IMPORT_ROWS} rows")

        if not data:
            raise ImportValidationError("File contains no data rows")

        parsed_rows: list[ParsedRow] = []
        for index, item in enumerate(data, start=1):
            if not isinstance(item, dict):
                raise ImportValidationError(f"Row {index} is not a valid object")
            parsed_rows.append(ParsedRow(row_number=index, data=item))

        return parsed_rows

    def _parse_csv(self, file_bytes: bytes) -> list[ParsedRow]:
        """Parse CSV file."""
        try:
            content = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ImportValidationError("CSV must be UTF-8 encoded") from exc

        reader = csv.DictReader(io.StringIO(content))
        if not reader.fieldnames:
            raise ImportValidationError("CSV is empty")

        # Normalize field names
        reader.fieldnames = [self._normalize_header(name) for name in reader.fieldnames]

        parsed_rows: list[ParsedRow] = []
        for index, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
            if self._is_empty_row(row.values()):
                continue
            if len(parsed_rows) >= MAX_IMPORT_ROWS:
                raise ImportValidationError(f"File exceeds maximum of {MAX_IMPORT_ROWS} rows")
            parsed_rows.append(ParsedRow(row_number=index, data=dict(row)))

        if not parsed_rows:
            raise ImportValidationError("File contains no data rows")

        return parsed_rows

    def _parse_excel(self, file_bytes: bytes) -> list[ParsedRow]:
        """Parse Excel file."""
        try:
            workbook = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        except Exception as exc:
            raise ImportValidationError("Invalid Excel file") from exc

        sheet = workbook.active
        if not sheet:
            raise ImportValidationError("Workbook is empty")

        row_iter = sheet.iter_rows(values_only=True)
        header_row = next(row_iter, None)
        if not header_row:
            raise ImportValidationError("Workbook is empty")

        headers = [self._normalize_header(value) for value in header_row]

        parsed_rows: list[ParsedRow] = []
        for index, values in enumerate(row_iter, start=2):
            if self._is_empty_row(values):
                continue
            if len(parsed_rows) >= MAX_IMPORT_ROWS:
                raise ImportValidationError(f"File exceeds maximum of {MAX_IMPORT_ROWS} rows")

            row_data = {
                headers[i]: values[i] if i < len(values) else None for i in range(len(headers))
            }
            parsed_rows.append(ParsedRow(row_number=index, data=row_data))

        if not parsed_rows:
            raise ImportValidationError("Workbook contains no data rows")

        return parsed_rows

    async def _validate_rows(
        self, event_id: UUID, parsed_rows: list[ParsedRow]
    ) -> list[ImportRowResult]:
        """Validate all rows in the import."""
        results: list[ImportRowResult] = []

        # Check for duplicate rows (exact match on all fields)
        row_hashes = Counter(
            self._hash_row(row.data)
            for row in parsed_rows
        )

        for parsed in parsed_rows:
            row_number = parsed.row_number
            data = parsed.data
            errors: list[str] = []

            # Check for exact duplicates
            row_hash = self._hash_row(data)
            if row_hashes[row_hash] > 1:
                errors.append("Duplicate row in file")

            # Validate required fields
            donor_email = data.get("donor_email")
            auction_item_code = data.get("auction_item_code")
            bid_amount = data.get("bid_amount")
            bid_time = data.get("bid_time")

            if not donor_email:
                errors.append("Missing donor_email")
            if not auction_item_code:
                errors.append("Missing auction_item_code")
            if bid_amount is None:
                errors.append("Missing bid_amount")
            if not bid_time:
                errors.append("Missing bid_time")

            if errors:
                results.append(
                    ImportRowResult(
                        row_number=row_number,
                        donor_email=str(donor_email) if donor_email else None,
                        auction_item_code=str(auction_item_code) if auction_item_code else None,
                        bid_amount=None,
                        status=ImportRowStatus.ERROR,
                        message="; ".join(errors),
                    )
                )
                continue

            # Coerce and validate data
            try:
                row_data = BidImportRow(**self._coerce_row(data))
            except Exception as exc:
                results.append(
                    ImportRowResult(
                        row_number=row_number,
                        donor_email=str(donor_email) if donor_email else None,
                        auction_item_code=str(auction_item_code) if auction_item_code else None,
                        bid_amount=None,
                        status=ImportRowStatus.ERROR,
                        message=f"Invalid data: {str(exc)}",
                    )
                )
                continue

            # Validate donor exists
            donor_query = select(User).where(User.email == row_data.donor_email.lower())
            donor_result = await self.db.execute(donor_query)
            donor = donor_result.scalar_one_or_none()
            if not donor:
                errors.append(f"Donor not found: {row_data.donor_email}")

            # Validate auction item exists for this event
            item_query = select(AuctionItem).where(
                AuctionItem.event_id == event_id,
                AuctionItem.external_id == row_data.auction_item_code,
            )
            item_result = await self.db.execute(item_query)
            item = item_result.scalar_one_or_none()
            if not item:
                errors.append(
                    f"Auction item not found for event: {row_data.auction_item_code}"
                )

            # If both donor and item exist, validate bid rules
            if donor and item:
                # Get current highest bid
                highest_bid_query = (
                    select(AuctionBid)
                    .where(AuctionBid.auction_item_id == item.id)
                    .order_by(AuctionBid.bid_amount.desc())
                    .limit(1)
                )
                highest_bid_result = await self.db.execute(highest_bid_query)
                highest_bid = highest_bid_result.scalar_one_or_none()

                # Determine minimum bid
                if highest_bid:
                    min_bid = highest_bid.bid_amount + item.bid_increment
                else:
                    min_bid = item.starting_bid

                # Validate bid amount
                if row_data.bid_amount < min_bid:
                    errors.append(
                        f"Bid amount {row_data.bid_amount} is below minimum {min_bid}"
                    )

            if errors:
                results.append(
                    ImportRowResult(
                        row_number=row_number,
                        donor_email=row_data.donor_email,
                        auction_item_code=row_data.auction_item_code,
                        bid_amount=row_data.bid_amount,
                        status=ImportRowStatus.ERROR,
                        message="; ".join(errors),
                    )
                )
            else:
                results.append(
                    ImportRowResult(
                        row_number=row_number,
                        donor_email=row_data.donor_email,
                        auction_item_code=row_data.auction_item_code,
                        bid_amount=row_data.bid_amount,
                        status=ImportRowStatus.VALID,
                        message="Valid",
                    )
                )

        return results

    async def _create_bid(self, event_id: UUID, row_data: BidImportRow) -> None:
        """Create a bid from import row."""
        # Get donor
        donor_query = select(User).where(User.email == row_data.donor_email.lower())
        donor_result = await self.db.execute(donor_query)
        donor = donor_result.scalar_one()

        # Get auction item
        item_query = select(AuctionItem).where(
            AuctionItem.event_id == event_id,
            AuctionItem.external_id == row_data.auction_item_code,
        )
        item_result = await self.db.execute(item_query)
        item = item_result.scalar_one()

        # Get bidder number
        bidder_query = (
            select(RegistrationGuest.bidder_number)
            .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.user_id == donor.id,
            )
        )
        bidder_result = await self.db.execute(bidder_query)
        bidder_number = bidder_result.scalar_one_or_none()
        if not bidder_number:
            # Assign a temporary bidder number if not registered
            # This allows imports for testing/demo purposes
            temp_bidder_query = (
                select(AuctionBid.bidder_number)
                .where(AuctionBid.event_id == event_id)
                .order_by(AuctionBid.bidder_number.desc())
                .limit(1)
            )
            temp_result = await self.db.execute(temp_bidder_query)
            max_bidder = temp_result.scalar_one_or_none()
            bidder_number = (max_bidder + 1) if max_bidder else 1000

        # Create bid
        bid = AuctionBid(
            event_id=event_id,
            auction_item_id=item.id,
            user_id=donor.id,
            bidder_number=bidder_number,
            bid_amount=row_data.bid_amount,
            max_bid=None,
            bid_type=BidType.REGULAR.value,
            bid_status=BidStatus.ACTIVE.value,
            transaction_status=TransactionStatus.PENDING.value,
            placed_at=row_data.bid_time,
            source_bid_id=None,
            created_by=donor.id,
        )
        self.db.add(bid)
        await self.db.flush()

    def _coerce_row(self, data: dict[str, Any]) -> dict[str, Any]:
        """Coerce row data to correct types."""

        def _to_str(value: Any) -> str | None:
            if value is None:
                return None
            return str(value).strip()

        def _to_decimal(value: Any) -> Decimal | None:
            if value is None or value == "":
                return None
            return Decimal(str(value))

        def _to_datetime(value: Any) -> datetime | None:
            if value is None or value == "":
                return None
            if isinstance(value, datetime):
                return value
            # Try to parse string datetime
            try:
                # Handle ISO format with timezone
                return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass
            return None

        return {
            "donor_email": _to_str(data.get("donor_email")),
            "auction_item_code": _to_str(data.get("auction_item_code")),
            "bid_amount": _to_decimal(data.get("bid_amount")),
            "bid_time": _to_datetime(data.get("bid_time")),
        }

    @staticmethod
    def _normalize_header(value: Any) -> str:
        """Normalize header names."""
        if value is None:
            return ""
        return str(value).strip().lower().replace(" ", "_")

    @staticmethod
    def _is_empty_row(values: Any) -> bool:
        """Check if a row is empty."""
        if isinstance(values, dict):
            values = values.values()
        return all(value is None or str(value).strip() == "" for value in values)

    @staticmethod
    def _hash_row(data: dict[str, Any]) -> str:
        """Create a hash of row data to detect duplicates."""
        # Create consistent string representation
        key_parts = [
            str(data.get("donor_email", "")).strip().lower(),
            str(data.get("auction_item_code", "")).strip(),
            str(data.get("bid_amount", "")).strip(),
            str(data.get("bid_time", "")).strip(),
        ]
        return hashlib.sha256("|".join(key_parts).encode()).hexdigest()
