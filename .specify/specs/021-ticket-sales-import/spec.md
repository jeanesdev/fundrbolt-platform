# Feature Specification: Ticket Sales Import

**Feature Branch**: `021-ticket-sales-import`
**Created**: 2026-02-07
**Status**: Draft
**Input**: User description: "ticket-sales-import I need to be able to import ticet sales information in bulk from a json file, an excel workbook, or a csv. Please include an example format for the json and csv. Add a button on the tickets page of the admin PWA for importing, first with a preflight to verify everything works without error, and then once that passes to actually import the data. Look at the bulk import on the auction items page for an example."

## Clarifications

### Session 2026-02-07

- Q: What should happen if a row references a ticket type not found for the selected event? → A: Preflight fails if any row references a ticket type not found for the selected event.
- Q: How should `event_id` in the file be handled? → A: Preflight ignores `event_id` in the file and always imports into the selected event.
- Q: How should `external_sale_id` duplicates against existing records be handled? → A: Preflight passes but flags those rows as warnings and they are skipped during import.
- Q: What is the uniqueness scope for `external_sale_id`? → A: `external_sale_id` must be unique within the selected event.
- Q: What is the maximum number of rows allowed per import? → A: 5,000 rows.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Bulk import with preflight (Priority: P1)

As an admin, I want to upload a ticket sales file, run a preflight check, and then import the sales so I can add large volumes of ticket sales quickly and accurately.

**Why this priority**: This is the core value of the feature and enables bulk ingestion without manual entry.

**Independent Test**: Can be fully tested by uploading a valid file, passing preflight, completing import, and verifying the resulting ticket sales summary.

**Acceptance Scenarios**:

1. **Given** a valid ticket sales file, **When** I run preflight, **Then** I see a successful validation summary with no blocking issues.
2. **Given** a successful preflight, **When** I confirm import, **Then** the ticket sales are created and I see counts of created and skipped records.
3. **Given** a file with validation errors, **When** I run preflight, **Then** no data is imported and I see a list of issues to fix.

---

### User Story 2 - Use supported file formats (Priority: P2)

As an admin, I want to import ticket sales from JSON, CSV, or Excel so I can use the file type my source system provides.

**Why this priority**: Supporting multiple formats removes barriers to adoption and reduces rework for admins.

**Independent Test**: Can be fully tested by importing one valid file of each supported format and verifying each passes preflight.

**Acceptance Scenarios**:

1. **Given** a valid CSV file, **When** I run preflight, **Then** the file is accepted and validated.
2. **Given** a valid JSON file, **When** I run preflight, **Then** the file is accepted and validated.
3. **Given** a valid Excel workbook, **When** I run preflight, **Then** the file is accepted and validated.

---

### User Story 3 - Fix and re-run after errors (Priority: P3)

As an admin, I want clear error feedback from preflight so I can correct my file and retry without guessing.

**Why this priority**: Clear feedback prevents failed imports and reduces support requests.

**Independent Test**: Can be fully tested by running preflight on an invalid file and verifying the error list is actionable.

**Acceptance Scenarios**:

1. **Given** a file with missing required fields, **When** I run preflight, **Then** I see row-level errors that identify the missing fields.
2. **Given** a file with duplicate identifiers, **When** I run preflight, **Then** I see duplicate warnings and no data is imported.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- File is empty or only has headers.
- File includes rows for a different event than the one currently selected.
- File references a ticket type that does not exist for the selected event.
- Duplicate external sale identifiers appear in the same file.
- External sale identifiers already exist in the system.
- Required numeric fields contain text or negative values.
- File uses an unsupported encoding or corrupted Excel workbook.
- Row count exceeds the maximum allowed for a single import.
- Row count exceeds 5,000 rows.
- Preflight passes but the user cancels the import.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST provide an import action on the tickets page that matches the existing bulk import flow used for auction items.
- **FR-002**: System MUST support importing ticket sales from JSON, CSV, and Excel workbook files.
- **FR-003**: System MUST require a preflight validation step before any import is executed.
- **FR-004**: System MUST block import when preflight detects errors and must not create any ticket sales in that case.
- **FR-005**: System MUST allow import only after a successful preflight for the same uploaded file.
- **FR-006**: System MUST validate required fields: event identifier, ticket package/type, purchaser name, purchaser email, quantity, total amount, purchase date, and external sale identifier.
- **FR-007**: System MUST allow optional fields: fee amount, payment status, notes, and purchaser phone.
- **FR-008**: System MUST detect duplicate external sale identifiers within the uploaded file and flag them as errors during preflight.
- **FR-009**: System MUST report validation results with counts of total rows, valid rows, error rows, and warning rows.
- **FR-009a**: System MUST include warnings for rows skipped due to duplicate existing `external_sale_id` values.
- **FR-010**: System MUST provide a downloadable error report when preflight finds errors.
- **FR-011**: System MUST show a post-import summary including created, skipped, and failed records.
- **FR-012**: System MUST restrict import access to admins with ticket management permissions.
- **FR-013**: System MUST allow users to view example file formats for JSON and CSV before upload.
- **FR-014**: System MUST treat each import as a distinct batch with a timestamp and the initiating admin user recorded.
- **FR-015**: System MUST ensure imports are idempotent within a single batch (re-uploading the same file does not create duplicate sales).
- **FR-016**: System MUST fail preflight if any row references a ticket type not found for the selected event.
- **FR-017**: System MUST ignore `event_id` values in the uploaded file and import all rows into the currently selected event.
- **FR-018**: System MUST skip importing rows whose `external_sale_id` already exists in the system and surface a warning in preflight results.
- **FR-019**: System MUST enforce a maximum of 5,000 rows per import file.

#### Example File Formats

**JSON example (array of ticket sale objects)**

Each object represents one ticket sale record:

- event_id: EVT-2026-001
- ticket_type: VIP Table
- purchaser_name: Jordan Lee
- purchaser_email: jordan.lee@example.org
- quantity: 2
- total_amount: 500.00
- purchase_date: 2026-02-01
- external_sale_id: EXT-100045
- fee_amount: 15.00
- payment_status: Paid
- notes: Sponsor package

**CSV example (header and one row)**

Header:
event_id,ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id,fee_amount,payment_status,notes

Row:
EVT-2026-001,VIP Table,Jordan Lee,jordan.lee@example.org,2,500.00,2026-02-01,EXT-100045,15.00,Paid,Sponsor package

### Key Entities *(include if feature involves data)*

- **Ticket Sale Record**: Represents a single ticket sale with purchaser details, ticket type, quantity, amounts, purchase date, and external sale identifier.
- **External Sale Identifier**: Unique identifier for a sale within the selected event.
- **Import Batch**: Represents one upload attempt with its preflight results, status, and initiating admin.
- **Validation Issue**: Represents a preflight error or warning tied to a specific row and field.

### Assumptions

- The import uses a fixed, documented header schema; admins are not asked to map custom columns in this release.
- Excel workbooks provide data in the first worksheet with a single header row.
- The selected event in the admin interface determines the target event for imported sales.
- Any `event_id` provided in the file is informational only and does not affect import routing.
- Amounts use a single currency per import file.
- The maximum import size is 5,000 rows.

### Dependencies

- Ticket packages/types must already exist for the selected event.
- Admin users must have access to the tickets page and ticket management permissions.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 90% of admins can complete a successful ticket sales import on the first attempt using a valid file.
- **SC-002**: Preflight completes within 60 seconds for files up to 5,000 rows.
- **SC-003**: At least 95% of valid rows in a file are imported without manual correction.
- **SC-004**: Time to add 1,000 ticket sales is reduced to under 10 minutes including preflight.
