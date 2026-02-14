# Quickstart: Import Auction Bids

## Purpose
Provide a fast way to validate and import auction bids for an event using JSON, CSV, or Excel files, plus view a bids dashboard in the admin PWA.

## Prerequisites
- Event with auction items and donors
- Donor emails and item codes for import matching

## Workflow
1. Open the auction bids dashboard for the event in the admin PWA.
2. Select Import and upload a JSON, CSV, or Excel file.
3. Review preflight results and fix any invalid rows.
4. Confirm the import to create bids atomically (upload the same file to confirm).
5. Verify totals and recent bids on the dashboard.

## Sample File Fields
- donor_email
- auction_item_code
- bid_amount
- bid_time

## Expected Outcomes
- Preflight identifies invalid rows and blocks confirmation until all rows are valid.
- Confirmation creates all bids and records an import summary.
