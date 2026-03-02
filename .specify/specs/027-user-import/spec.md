# Feature Specification: Admin User Import

**Feature Branch**: `027-user-import`
**Created**: 2026-02-16
**Status**: Draft
**Input**: User description: "short-name: import-users. description: i want to be able to import users via jsonnor csv file via the admin PWA users page. Give me examples ofneach file type. I want a pre-flight step and a confirmation. Follow the examples for importing donor registrations, ticket sales, auction bids, etc. If no password is generated set a random temporary password."

## Clarifications

### Session 2026-02-16

- Q: How should temporary passwords be delivered to new users? → A: Send a welcome/reset email to each new user; do not expose passwords to admins.
- Q: How should existing emails be handled during import? → A: Treat existing emails as warnings and skip those rows on import.
- Q: Which roles are allowed in user imports? → A: Only NPO-scoped roles; no Super Admin via import.
- Q: How should users that already exist in a different NPO be handled? → A: Add the existing user to the selected NPO with the imported role.
- Q: What is the maximum number of rows allowed per import file? → A: 5,000 rows.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preflight and confirm user import (Priority: P1)

As an admin, I want to upload a user file, run a preflight check, and then confirm the import so I can add many users quickly without creating bad data.

**Why this priority**: This is the core workflow and ensures data quality before any accounts are created.

**Independent Test**: Upload a valid file, run preflight, confirm import, and verify created user counts and summaries.

**Acceptance Scenarios**:

1. **Given** a valid user import file, **When** I run preflight, **Then** I see a successful validation summary with no blocking issues.
2. **Given** a successful preflight, **When** I confirm import, **Then** the users are created and I see counts of created and skipped records.
3. **Given** a file with validation errors, **When** I run preflight, **Then** no users are created and I see a list of issues to fix.

---

### User Story 2 - Use supported file formats (Priority: P2)

As an admin, I want to import users from JSON or CSV so I can use the file type my source system provides.

**Why this priority**: Supporting common formats reduces effort and avoids rework.

**Independent Test**: Import one valid JSON file and one valid CSV file and verify both pass preflight.

**Acceptance Scenarios**:

1. **Given** a valid CSV file, **When** I run preflight, **Then** the file is accepted and validated.
2. **Given** a valid JSON file, **When** I run preflight, **Then** the file is accepted and validated.
3. **Given** I have not selected a file yet, **When** I open the import dialog, **Then** I can view example JSON and CSV formats.

---

### User Story 3 - Handle duplicates and temporary passwords (Priority: P3)

As an admin, I want clear feedback about duplicate users and password handling so I can complete imports confidently.

**Why this priority**: Duplicate handling and password behavior are common failure points and need clarity.

**Independent Test**: Run preflight on a file with duplicate emails and missing passwords and verify warnings, skips, and temporary password handling.

**Acceptance Scenarios**:

1. **Given** a file with duplicate emails, **When** I run preflight, **Then** I see row-level errors for duplicates within the file.
2. **Given** a file with emails that already exist, **When** I run preflight, **Then** those rows are flagged as warnings and will be skipped on import.
3. **Given** a row without a password, **When** I confirm import, **Then** the system assigns a temporary password and flags the user to reset it on first login.
4. **Given** a file with an email that exists in another NPO, **When** I confirm import, **Then** the user is added to the selected NPO with the imported role and reported in the summary.

### Edge Cases

- File is empty or only has headers.
- File includes invalid email formats or missing required fields.
- File includes a role that is not supported in the admin user management UI.
- File includes users for a different NPO than the selected NPO context.
- Duplicate emails appear within the same file.
- Email already exists in the system.
- Email exists in the system but is not in the selected NPO.
- Provided passwords fail the password policy.
- Row count exceeds the maximum allowed for a single import.
- File uses an unsupported encoding or is corrupted.
- Preflight passes but the user cancels the import.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a user import action on the admin PWA users page that matches the existing bulk import flow used for other admin imports.
- **FR-002**: System MUST support importing users from JSON and CSV files.
- **FR-003**: System MUST require a preflight validation step before any import is executed.
- **FR-004**: System MUST block import when preflight detects errors and must not create any users in that case.
- **FR-005**: System MUST allow import only after a successful preflight for the same uploaded file.
- **FR-006**: System MUST validate required fields: full name, email address, role, and NPO context.
- **FR-007**: System MUST allow optional fields: phone number, title, and password.
- **FR-008**: System MUST detect duplicate emails within the uploaded file and flag them as errors during preflight.
- **FR-009**: System MUST report validation results with counts of total rows, valid rows, error rows, and warning rows.
- **FR-010**: System MUST provide a downloadable error report when preflight finds errors.
- **FR-011**: System MUST show a post-import summary including created, skipped, and failed records.
- **FR-012**: System MUST restrict import access to admins with user management permissions.
- **FR-012a**: System MUST allow only NPO-scoped roles in imports and MUST reject any Super Admin role rows during preflight.
- **FR-013**: System MUST allow users to view example file formats for JSON and CSV before upload.
- **FR-014**: System MUST treat each import as a distinct batch with a timestamp and the initiating admin user recorded.
- **FR-015**: System MUST ensure imports are idempotent within a single batch (re-uploading the same file does not create duplicate users).
- **FR-016**: System MUST ignore any NPO identifier in the file and import all rows into the currently selected NPO context, while warning when a row’s NPO identifier differs from the selected NPO.
- **FR-017**: System MUST skip importing rows whose email already exists in the selected NPO and surface a warning in preflight results.
- **FR-017a**: If the email exists but is not a member of the selected NPO, system MUST add the user to the selected NPO with the imported role and report it as an added membership in the import summary.
- **FR-018**: System MUST enforce a maximum of 5,000 rows per import file.
- **FR-019**: System MUST assign a random temporary password when no password is provided or generated, and must require a password reset on first login.
- **FR-020**: System MUST send a welcome or password reset email to each new user and MUST NOT expose temporary passwords to admins.

#### Example File Formats

**JSON example (array of user objects)**

Each object represents one user record:

- full_name: Jordan Lee
- email: jordan.lee@example.org
- role: NPO Admin
- npo_identifier: Hope Rising Foundation
- phone: 555-123-4567
- title: Development Director
- password: (optional)

**CSV example (header and one row)**

Header:
full_name,email,role,npo_identifier,phone,title,password

Row:
Jordan Lee,jordan.lee@example.org,NPO Admin,Hope Rising Foundation,555-123-4567,Development Director,

### Key Entities *(include if feature involves data)*

- **User Account**: Represents a user with identity details, role, and access rights.
- **NPO Context**: The organization context that determines which users are being created.
- **Import Batch**: Represents one upload attempt with its preflight results, status, and initiating admin.
- **Validation Issue**: Represents a preflight error or warning tied to a specific row and field.
- **Temporary Password**: A one-time password issued when no password is provided, requiring reset on first login.

### Assumptions

- The import uses a fixed, documented header schema; admins are not asked to map custom columns in this release.
- The selected NPO in the admin users page determines the target organization for imported users, and only NPO-scoped roles are eligible for import.
- Any NPO identifier included in the file is informational only and does not affect import routing.
- The maximum import size is 5,000 rows.
- Roles supported for import are the same roles available in the admin user management UI.

### Dependencies

- Admin users must have access to the users page and user management permissions.
- Target NPOs must already exist in the system.
- User onboarding communications are configured to send welcome or password reset emails to new users.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% of admins can complete a successful user import on the first attempt using a valid file.
- **SC-002**: Preflight completes within 60 seconds for files up to 5,000 rows.
- **SC-003**: At least 95% of valid rows in a file are imported without manual correction.
- **SC-004**: Time to add 1,000 users is reduced to under 10 minutes including preflight.
- **SC-005**: 90% of new users receive the welcome or password reset email within 5 minutes of completing an import.
