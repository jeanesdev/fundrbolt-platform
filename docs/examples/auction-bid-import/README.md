# Auction Bid Import Feature

## Overview

The auction bid import feature allows event staff to import auction bids from external files in bulk. This is primarily used for:
- Setting up demo and test environments
- Migrating data from other systems
- Importing historical bid data

## Supported File Formats

The import supports three file formats:
- **JSON** - Array of bid objects
- **CSV** - Comma-separated values with header row
- **Excel** - `.xlsx` workbook with header row in first sheet

## Import Flow

The import process uses a two-step approach:

### 1. Preflight Validation
Upload your file to run validation checks without creating any bids. The system will:
- Parse the file and extract bid data
- Validate each row against business rules
- Return a summary with valid/invalid counts
- List all validation errors with row numbers

**No bids are created during preflight.**

### 2. Confirm Import
After a successful preflight, confirm the import to create all valid bids. The system will:
- Verify the file hasn't changed since preflight (using file hash)
- Create all bids in a single database transaction
- Return an import summary with creation count and timestamps

**If any error occurs during confirmation, no bids are created (all-or-nothing).**

## File Format Specifications

### Required Fields

All import files must include these fields for each bid:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `donor_email` | String | Email address of the donor (must exist in system) | `donor@example.com` |
| `auction_item_code` | String | External ID of the auction item (must exist for event) | `ITEM-500` |
| `bid_amount` | Decimal | Bid amount in dollars | `150.00` |
| `bid_time` | ISO DateTime | When the bid was placed (accepts any valid timestamp) | `2026-02-01T19:45:00-06:00` |

### JSON Format

```json
[
  {
    "donor_email": "donor1001@example.org",
    "auction_item_code": "ITEM-500",
    "bid_amount": 150.00,
    "bid_time": "2026-02-01T19:45:00-06:00"
  },
  {
    "donor_email": "donor1002@example.org",
    "auction_item_code": "ITEM-501",
    "bid_amount": 200.00,
    "bid_time": "2026-02-01T19:47:30-06:00"
  }
]
```

**Notes:**
- File must contain a JSON array
- Each object represents one bid
- Field names are case-insensitive after parsing

### CSV Format

```csv
donor_email,auction_item_code,bid_amount,bid_time
donor1001@example.org,ITEM-500,150.00,2026-02-01T19:45:00-06:00
donor1002@example.org,ITEM-501,200.00,2026-02-01T19:47:30-06:00
```

**Notes:**
- First row must be header with column names
- Column names are case-insensitive
- Supports UTF-8 with BOM (UTF-8-SIG)
- Empty rows are automatically skipped

### Excel Format

Excel workbooks (`.xlsx`) must have:
- Header row in the first row of the first sheet
- Column names matching required fields (case-insensitive)
- Data starting from row 2
- Only the first sheet is read

**Notes:**
- Supports all Excel data types
- Dates can be in Excel date format or ISO string
- Empty rows are automatically skipped

## Validation Rules

### Donor Validation
- Donor email must match an existing user in the system (case-insensitive)
- Donor does not need to be registered for the event (bidder number auto-assigned if missing)

### Auction Item Validation
- Auction item code must match an existing item's `external_id` for the selected event
- Item must be active and published

### Bid Amount Validation
- Bid amount must be greater than or equal to the minimum bid
- Minimum bid = current highest bid + bid increment
- If no bids exist, minimum bid = starting bid
- Bid amounts are validated to 2 decimal places

### Bid Time Validation
- Must be a valid ISO 8601 datetime
- Can be any timestamp (past, present, or future)
- Timezone information is preserved

### Duplicate Detection
- Exact duplicate rows are rejected (same donor, item, amount, and time)
- Multiple bids from same donor on same item are allowed if amounts/times differ

## Error Handling

### Preflight Errors

The preflight validation will return errors for:
- Missing required fields
- Invalid data types or formats
- Non-existent donors or auction items
- Bid amounts below minimum
- Duplicate rows in file
- File exceeds 10,000 rows
- Invalid file format or encoding

Each error includes:
- Row number where error occurred
- Error code
- Human-readable error message

### Confirmation Errors

Confirmation will fail if:
- Import batch not found or already processed
- File has changed since preflight (hash mismatch)
- Any validation errors detected on re-validation
- Database transaction fails

## Limits and Constraints

- **Maximum file size:** 10,000 rows per import
- **File formats:** JSON, CSV, Excel (.xlsx)
- **Encoding:** UTF-8 (CSV supports UTF-8-SIG)
- **Decimal precision:** 2 places for bid amounts
- **Transaction safety:** All-or-nothing import on confirmation

## API Endpoints

### Dashboard
```
GET /api/v1/events/{event_id}/auction/bids/dashboard
```

Returns:
- Total bid count for event
- Total bid value
- Highest bid per item (top 10)
- Recent bids (last 20)

### Preflight
```
POST /api/v1/events/{event_id}/auction/bids/import/preflight
Content-Type: multipart/form-data

Parameters:
- file: File upload (JSON/CSV/Excel)
- file_type: "json" | "csv" | "xlsx"
```

Returns:
- `import_batch_id`: UUID for confirmation step
- `total_rows`: Total rows in file
- `valid_rows`: Count of valid rows
- `invalid_rows`: Count of invalid rows
- `row_errors`: Array of validation errors

### Confirm
```
POST /api/v1/events/{event_id}/auction/bids/import/confirm
Content-Type: multipart/form-data

Parameters:
- file: Same file from preflight
- file_type: "json" | "csv" | "xlsx"
- import_batch_id: UUID from preflight response
```

Returns:
- `import_batch_id`: UUID of completed import
- `created_bids`: Number of bids created
- `started_at`: Import start timestamp
- `completed_at`: Import completion timestamp

## Example Files

Example import files are provided in this directory:
- `example-bids.json` - JSON format example
- `example-bids.csv` - CSV format example

## Use Cases

### 1. Demo Environment Setup
Import historical bid data to create a realistic demo environment:
```bash
# Upload example-bids.json to preflight
# Review validation results
# Confirm import to create bids
```

### 2. Testing Bid Logic
Create specific bid scenarios for testing:
```bash
# Create JSON with edge cases
# Import to test bid validation rules
# Verify system behavior
```

### 3. Data Migration
Migrate bids from legacy auction system:
```bash
# Export bids from old system to CSV
# Map columns to required fields
# Run preflight to validate
# Fix any errors
# Confirm import
```

## Security and Permissions

- Only users with event admin permissions can import bids
- Requires authentication (JWT token)
- Event staff roles: `super_admin`, `npo_admin`, `npo_staff`
- Import batches are logged with user ID and timestamp
- File hash verification prevents tampering

## Troubleshooting

### "Donor not found" error
- Verify the email address exists in the system
- Check for typos or extra whitespace
- Email matching is case-insensitive

### "Auction item not found" error
- Verify the item code matches an existing item's external_id
- Check that the item belongs to the selected event
- Item codes are case-sensitive

### "Bid amount below minimum" error
- Check current highest bid for the item
- Ensure new bid ≥ (current high bid + bid increment)
- If no bids exist, ensure bid ≥ starting bid

### "File changed since preflight" error
- Do not modify the file between preflight and confirm
- Re-upload the same file used in preflight
- If changes needed, run a new preflight

### "Duplicate row" error
- Remove exact duplicate rows from file
- Multiple bids from same donor are OK if amounts/times differ
- Check for copy-paste errors in file
