# Quickstart: Ticket Sales Import

## Admin Flow
1. Open the Admin PWA and navigate to the event’s Tickets page.
2. Select **Import Ticket Sales**.
3. Upload a JSON, CSV, or Excel workbook file.
4. Run **Preflight** to validate the file.
5. Review the preflight summary and fix any errors.
6. Confirm **Import** to create ticket sales.
7. Review the import summary for created and skipped rows.

## Notes
- Preflight must succeed before import is enabled.
- Rows with existing `external_sale_id` values are skipped and reported as warnings.
- The maximum import size is 5,000 rows.
