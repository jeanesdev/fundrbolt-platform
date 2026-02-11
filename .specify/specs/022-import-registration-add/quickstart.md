# Quickstart: Event Registration Import

## Purpose
Verify the admin registration import flow (preflight + confirm) for JSON, CSV, and Excel files.

## Preconditions
- Admin user with registration management permissions
- Target event selected in the admin PWA

## Files
- Prepare a JSON, CSV, and Excel file that match the example schema in the spec
- Ensure required fields are present and `external_registration_id` values are unique within the selected event
- If linking to ticket sales, include either `ticket_purchase_id` OR both `ticket_purchaser_email` and `ticket_purchase_date`
- If importing guests, include `guest_of_email` to link to the parent registrant email and keep guest rows within the parent `guest_count`

## Steps
1. Open the admin PWA registrations page for the target event.
2. Click the Import button.
3. Upload a valid file and run preflight.
4. Verify the preflight summary shows zero errors (warnings allowed for existing duplicates).
5. Confirm import and verify the summary counts match expectations.
6. Re-run with an invalid file (missing required field) and confirm preflight blocks import.

## Expected Results
- Preflight completes within 60 seconds for up to 5,000 rows.
- Import creates registrations for valid rows and skips duplicates with warnings.
- No registrations are created if preflight has errors.
