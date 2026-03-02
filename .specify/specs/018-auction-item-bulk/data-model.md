# Data Model: Bulk Import Auction Items via Workbook + Images

## Entities

### Import Package
Represents the uploaded ZIP file for a single import attempt.
- **Attributes**: filename, uploaded_by, uploaded_at, total_rows, has_images
- **Notes**: ZIP-only; contains `auction_items.xlsx` and `images/` folder.

### Import Row
Represents one row parsed from the workbook.
- **Attributes**: external_id, title, description, category, starting_bid, fair_market_value, buy_it_now, quantity, donor_name, tags, restrictions, fulfillment_notes, is_featured, sort_order, image_filename
- **Rules**:
  - `external_id` required and unique per event within a single import
  - `starting_bid` and `fair_market_value` must be non-negative
  - `starting_bid` ≤ `fair_market_value`
  - `category` must be in controlled list (includes “Other”)
  - Text length limits apply to title/description

### Import Report
Summary of preflight or commit results.
- **Attributes**: total_rows, created_count, updated_count, skipped_count, error_count, warnings_count
- **Relationships**: contains many Import Row Results

### Import Row Result
Row-level outcome for validation or commit.
- **Attributes**: row_number, external_id, status (created/updated/skipped/error), message, image_status

### Auction Item
Existing domain entity associated with an event.
- **Attributes**: event_id, external_id, title, description, category, starting_bid, fair_market_value, buy_it_now, quantity, donor_name, tags, restrictions, fulfillment_notes, is_featured, sort_order, image_url
- **Relationships**: belongs to Event; may reference Image Asset

### Image Asset
Referenced image stored for an auction item.
- **Attributes**: filename, url, size, content_type

## Relationships
- Import Package → Import Rows (1:N)
- Import Report → Import Row Results (1:N)
- Event → Auction Items (1:N)
- Auction Item → Image Asset (1:1 or 1:N if multiple images are later supported)

## Constraints & Validation
- Event selected in UI; workbook omits event identifiers.
- ZIP-only import; workbook must be named `auction_items.xlsx`.
- Maximum 500 rows per import.
- Reject unknown categories; “Other” is the only allowed fallback.
- Missing or mismatched image filenames fail preflight for those rows.
