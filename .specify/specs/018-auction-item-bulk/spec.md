# Feature Specification: Bulk Import Auction Items via Workbook + Images

**Feature Branch**: `018-auction-item-bulk`
**Created**: January 26, 2026
**Status**: Draft
**Input**: User description: "auction-item-bulk-import — Bulk Import Auction Items via Workbook + Images. Admins upload a single package containing a workbook manifest and images to preflight-validate and then create or update auction items for an event, supporting both customer use and internal demo-data generation."

## Clarifications

### Session 2026-01-26

- Q: Should the import accept only a ZIP package or also allow separate uploads for workbook and images? → A: ZIP only (must include `auction_items.xlsx` and an `images/` folder).
- Q: Should categories be freeform or from a controlled list? → A: Controlled list with an "Other" category allowed.
- Q: What is the maximum number of rows allowed per import? → A: 500 rows per import.
- Q: Which roles can use bulk import? → A: Admins with event access only.
- Q: Should the workbook include event identifiers, or should the event be selected in the UI? → A: Event is selected in the UI; workbook omits event identifiers.

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

### User Story 1 - Preflight an auction item import (Priority: P1)

Event administrators with event access can upload a single ZIP package that contains a workbook manifest and item images for a selected event, and immediately see validation results without changing any data.

**Why this priority**: Preflight validation builds trust and prevents broken or incomplete imports, which is the highest-risk step for bulk changes.

**Independent Test**: Can be fully tested by uploading a sample package and confirming that only validation results are returned with zero data changes.

**Acceptance Scenarios**:

1. **Given** an admin with access to an event and a valid import package, **When** they run preflight validation, **Then** they see a summary (new vs update counts) and row-level messages without any items being created or updated.
2. **Given** a package with missing images or invalid rows, **When** preflight runs, **Then** each problem is reported with a specific, actionable error message and the summary reflects the failures.

---

### User Story 2 - Commit a validated import (Priority: P2)

Event administrators can commit a previously validated import to create or update auction items and see a complete import report.

**Why this priority**: This is the business outcome that turns validated data into usable auction items for the event.

**Independent Test**: Can be fully tested by committing a validated package and confirming item creation or updates with a complete report.

**Acceptance Scenarios**:

1. **Given** a package that passes validation, **When** an admin commits the import, **Then** the system creates or updates the items and returns a report with per-row statuses and identifiers.
2. **Given** a package with a mix of valid and invalid rows, **When** the admin commits, **Then** valid rows are processed and invalid rows are reported without blocking the entire import.

---

### User Story 3 - Re-import to update items safely (Priority: P3)

Event administrators can re-import the same workbook to update existing items without creating duplicates.

**Why this priority**: Safe re-imports reduce manual cleanup and make iterative updates practical.

**Independent Test**: Can be fully tested by importing a package twice and confirming the item count remains stable while data changes apply.

**Acceptance Scenarios**:

1. **Given** an event with items previously imported, **When** the same package is re-imported with updated details, **Then** the items are updated in place and no duplicates are created.
2. **Given** a package with duplicate identifiers inside the same file, **When** validation runs, **Then** the duplicates are flagged and require correction before commit.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Workbook is missing required columns or includes unknown columns.
- Import package contains images with unsupported file types or oversized files.
- The same identifier appears multiple times in the same workbook.
- Items reference images that are missing or mismatched in casing.
- Workbook mixes items intended for different events.
- Prices are negative or starting bids exceed fair market value.
- Preflight or commit is attempted with an empty workbook.
- The import package exceeds the maximum number of rows allowed (over 500 rows).

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: The system MUST allow event administrators with access to the event to initiate a bulk import from the auction items management area.
- **FR-002**: The system MUST accept a single ZIP package containing a workbook manifest and referenced images for the selected event.
- **FR-003**: The system MUST provide a preflight validation step that checks required columns, data types, pricing rules, category validity, and image references without persisting changes.
- **FR-004**: The system MUST allow administrators to commit a validated import to create or update auction items.
- **FR-005**: The system MUST treat the selected event and external identifier as the unique key for idempotent updates.
- **FR-006**: The system MUST validate pricing realism by enforcing non-negative values and requiring starting bids to be less than or equal to fair market value.
- **FR-007**: The system MUST validate text length limits for titles and descriptions and return actionable errors when limits are exceeded.
- **FR-008**: The system MUST validate category values against a documented list that includes an "Other" option and reject unknown categories during preflight.
- **FR-009**: The system MUST associate each item with its referenced image and ensure the image is available for user viewing after import.
- **FR-010**: The system MUST return a structured import report with summary counts and per-row statuses (created, updated, skipped, error) and messages.
- **FR-011**: The system MUST provide a downloadable error report in a common format for fixing and re-uploading invalid rows.
- **FR-012**: The system MUST enforce safety limits on file size, row count, and allowed image types, and reject unsafe content.
- **FR-012a**: The system MUST reject workbook manifests with more than 500 rows.
- **FR-013**: The system MUST record each import attempt with the initiating user and outcome for auditability.
- **FR-014**: The system SHOULD allow import availability to be restricted by environment policy, with a default allowance for non-production environments.
- **FR-015**: The system SHOULD provide an internal-only utility to generate sample import packages for demo and testing purposes.

### Key Entities *(include if feature involves data)*

- **Import Package**: A single upload containing the workbook manifest and image files.
- **Import Row**: One auction item record parsed from the workbook, including its external identifier and image reference.
- **Import Report**: A summary of results and row-level statuses from preflight or commit.
- **Auction Item**: An item linked to an event with title, description, pricing, category, and media.
- **Image Asset**: A referenced media file associated with an auction item.

## Assumptions & Dependencies

- Administrators with event access already have access to an auction items management area for each event.
- The import workflow requires the administrator to select the target event before uploading a package.
- A documented list of acceptable categories, including an "Other" option, exists or will be provided for the import template.
- The import feature will rely on an existing media hosting capability to store item images.
- The maximum allowed rows per import is 500.

## Scope & Out of Scope

**In Scope**

- Bulk import of auction items for a single event using a workbook manifest and referenced images.
- Preflight validation with row-level feedback and a downloadable error report.
- Commit step that creates or updates items and returns a detailed import report.
- Support for internal demo-data generation using the same import workflow.

**Out of Scope**

- Real-time AI content generation during the import flow.
- Two-way synchronization or round-trip editing with spreadsheet tools beyond import.
- Bulk editing of existing items outside the import process.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Administrators can complete preflight validation for a 50-item package in under 1 minute.
- **SC-002**: Administrators can complete a full import of 50 items (upload to final report) in under 5 minutes.
- **SC-003**: At least 95% of valid rows are imported or updated successfully on the first commit attempt.
- **SC-004**: Re-importing a previously imported package does not increase the total item count for the event.
- **SC-005**: At least 90% of test users can complete the import workflow without support on their first attempt.
