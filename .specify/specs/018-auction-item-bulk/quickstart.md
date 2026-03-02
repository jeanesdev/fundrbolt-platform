# Quickstart: Bulk Import Auction Items via Workbook + Images

## Who this is for
Event administrators with access to an event’s auction items management area.

## What you need
- A ZIP file that contains:
  - `auction_items.xlsx` with the required columns
  - `images/` folder containing referenced image files
- An event selected in the admin UI (workbook does not include event identifiers)

## Suggested flow
1. Open the event’s auction items management area and choose “Import Auction Items.”
2. Upload the ZIP package and run the preflight validation.
3. Review the summary and row-level messages, and download the error report if needed.
4. Fix any issues and re-upload until preflight passes.
5. Commit the import and confirm the final report.

## Expected outcomes
- New items are created and existing items with matching external IDs are updated.
- Items reference their images and are immediately viewable after import.
- Re-importing the same workbook does not create duplicates.
