# Feature Specification: Event Registration Import

**Feature Branch**: `022-import-registration-add`
**Created**: 2026-02-07
**Status**: Draft
**Input**: User description: "import-registration: Add the ability to import event registration details from jaon, excel workvook, or CSV. Include examples of the JSON and csv format. follow similar design as laid out in the Import-ricket-sales speckit documentation. Add a button to import on the admin PWA registrations page. it should first donanoreflight toncheck that wverything is good, then allow the confirm which acrually creates the records. inwant it to work similarly to the import Auction Items feature on the Auction Items tab."

## Clarifications

### Session 2026-02-07

- Q: How should duplicates against existing registrations be handled? → A: Preflight passes with warnings; duplicates are skipped during import.
- Q: How should `event_id` in the file be handled? → A: Preflight ignores `event_id` and imports into the selected event, with a warning on mismatch.
- Q: What is the uniqueness scope for `external_registration_id`? → A: Unique within the selected event.
- Q: What is the maximum number of rows allowed per import? → A: 5,000 rows.
- Q: Should preflight fail on any missing/invalid required fields? → A: Yes, any required-field errors cause preflight to fail.
- Q: Should guest registrations be included in the same file? → A: Yes; rows with `guest_of_email` are treated as guests linked to the parent registrant.
- Q: Should food options be importable? → A: Yes; `food_option` maps to an event food option and creates a meal selection.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preflight and confirm registration import (Priority: P1)

As an admin, I want to upload a registrations file, run a preflight check, and then confirm the import so I can add registration records quickly and accurately.

**Why this priority**: This is the core value of the feature and prevents bad data from being created.

**Independent Test**: Can be fully tested by uploading a valid file, passing preflight, confirming import, and verifying the resulting registration summary.

**Acceptance Scenarios**:

1. **Given** a valid registrations file, **When** I run preflight, **Then** I see a successful validation summary with no blocking issues.
2. **Given** a successful preflight, **When** I confirm import, **Then** the registrations are created and I see counts of created and skipped records.
3. **Given** a file with validation errors, **When** I run preflight, **Then** no data is imported and I see a list of issues to fix.

---

### User Story 2 - Use supported file formats (Priority: P2)

As an admin, I want to import registrations from JSON, CSV, or Excel so I can use the file type my source system provides.

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

### Edge Cases

- File is empty or only has headers.
- File includes rows for a different event than the one currently selected.
- File references a ticket purchase that does not exist for the selected event.
- Duplicate external registration identifiers appear in the same file.
- External registration identifiers already exist in the system.
- Required numeric fields contain text or negative values.
- File uses an unsupported encoding or corrupted Excel workbook.
- Row count exceeds the maximum allowed for a single import.
- Preflight passes but the user cancels the import.
- Guest rows reference missing parents or exceed guest_count.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an import action on the admin registrations page that matches the existing bulk import flow used for auction items.
- **FR-002**: System MUST support importing registrations from JSON, CSV, and Excel workbook files.
- **FR-003**: System MUST require a preflight validation step before any import is executed.
- **FR-004**: System MUST block import when preflight detects errors and must not create any registrations in that case.
- **FR-005**: System MUST allow import only after a successful preflight for the same uploaded file.
- **FR-006**: System MUST validate required fields: event identifier, registrant full name, registrant email, registration date, quantity, and external registration identifier; any missing or invalid required fields MUST cause preflight to fail.
- **FR-007**: System MUST allow optional fields: registrant phone, notes, bidder number, table number, guest count, guest_of_email, food_option, ticket_purchase_id, ticket_purchaser_email, and ticket_purchase_date.
- **FR-008**: System MUST detect duplicate external registration identifiers within the uploaded file and flag them as errors during preflight.
- **FR-009**: System MUST report validation results with counts of total rows, valid rows, error rows, and warning rows.
- **FR-010**: System MUST provide a downloadable error report when preflight finds errors.
- **FR-011**: System MUST show a post-import summary including created, skipped, and failed records.
- **FR-012**: System MUST restrict import access to admins with registration management permissions.
- **FR-013**: System MUST allow users to view example file formats for JSON and CSV before upload.
- **FR-014**: System MUST treat each import as a distinct batch with a timestamp and the initiating admin user recorded.
- **FR-015**: System MUST ensure imports are idempotent within a single batch (re-uploading the same file does not create duplicate registrations).
- **FR-016**: System MUST ignore `event_id` values in the uploaded file and import all rows into the currently selected event, while warning when a row’s `event_id` differs from the selected event.
- **FR-017**: System MUST skip importing rows whose `external_registration_id` already exists in the system and surface a warning in preflight results.
- **FR-018**: System MUST enforce a maximum of 5,000 rows per import file.
- **FR-019**: System MUST allow preflight to succeed when existing `external_registration_id` duplicates are found, while warning that those rows will be skipped during import.
- **FR-020**: System MUST enforce `external_registration_id` uniqueness within the selected event.
- **FR-021**: System MUST accept `ticket_purchase_id` to link a registration to a ticket sale when provided.
- **FR-022**: System MUST allow `ticket_purchaser_email` + `ticket_purchase_date` as an alternative lookup for the ticket purchase; missing or ambiguous matches MUST fail preflight.
- **FR-023**: System MUST treat rows with `guest_of_email` as guest registrations linked to the parent registrant email.
- **FR-024**: System MUST fail preflight if a guest row references a parent registrant that is not present in the file and does not exist in the system for the selected event.
- **FR-025**: System MUST fail preflight if the number of guest rows exceeds the parent’s `guest_count` capacity.
- **FR-026**: System MUST require unique guest email addresses per parent registration and fail preflight on duplicates.
- **FR-027**: System MUST ignore ticket purchase fields on guest rows.
- **FR-028**: System MUST accept `food_option` (name or ID) and create a meal selection for the registrant or guest row when provided.

#### Example File Formats

**JSON example (array of registration objects)**

Each object represents one registration record (or guest row when `guest_of_email` is set):

- event_id: EVT-2026-001
- registrant_name: Jordan Lee
- registrant_email: jordan.lee@example.org
- registration_date: 2026-02-01
- quantity: 2
- external_registration_id: REG-100045
- registrant_phone: 555-123-4567
- bidder_number: 42
- table_number: 8
- guest_count: 2
- notes: Sponsor package
- ticket_purchase_id: 1b2c3d4e-0000-1111-2222-333344445555
- ticket_purchaser_email: jordan.lee@example.org
- ticket_purchase_date: 2026-01-20
- guest_of_email: jordan.lee@example.org (guest row only)
- food_option: Vegetarian

**CSV example (header and one row)**

Header:
event_id,registrant_name,registrant_email,registration_date,quantity,external_registration_id,registrant_phone,bidder_number,table_number,guest_count,guest_of_email,food_option,notes,ticket_purchase_id,ticket_purchaser_email,ticket_purchase_date

Rows:
EVT-2026-001,Jordan Lee,jordan.lee@example.org,2026-02-01,2,REG-100045,555-123-4567,42,8,2,,Vegetarian,Sponsor package,1b2c3d4e-0000-1111-2222-333344445555,jordan.lee@example.org,2026-01-20
EVT-2026-001,Casey Guest,casey.guest@example.org,2026-02-01,1,,555-222-7890,84,8,1,jordan.lee@example.org,Vegetarian,Dietary: vegetarian,,,

### Key Entities *(include if feature involves data)*

- **Registration Record**: Represents a single event registration with registrant details, quantity, and optional ticket purchase linkage.
- **Guest Registration**: Represents a guest row linked to a parent registrant via `guest_of_email`.
- **External Registration Identifier**: Unique identifier for a registration within the selected event.
- **Import Batch**: Represents one upload attempt with its preflight results, status, and initiating admin.
- **Validation Issue**: Represents a preflight error or warning tied to a specific row and field.

### Assumptions

- The import uses a fixed, documented header schema; admins are not asked to map custom columns in this release.
- Excel workbooks provide data in the first worksheet with a single header row.
- The selected event in the admin interface determines the target event for imported registrations.
- Any `event_id` provided in the file is informational only and does not affect import routing.
- The maximum import size is 5,000 rows.

### Dependencies

- Ticket purchases (optional) must exist to link registrations.
- Admin users must have access to the registrations page and registration management permissions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% of admins can complete a successful registrations import on the first attempt using a valid file.
- **SC-002**: Preflight completes within 60 seconds for files up to 5,000 rows.
- **SC-003**: At least 95% of valid rows in a file are imported without manual correction.
- **SC-004**: Time to add 1,000 registrations is reduced to under 10 minutes including preflight.
