# Data Model: Admin User Import

## Entities

### UserImportBatch

Represents one import attempt (preflight or commit) for a specific NPO.

- **id**: UUID
- **npo_id**: UUID (target NPO)
- **initiated_by_user_id**: UUID
- **file_name**: string
- **file_checksum**: string
- **file_type**: string (json, csv)
- **status**: string (preflight, committed, failed)
- **total_rows**: integer
- **valid_rows**: integer
- **error_rows**: integer
- **warning_rows**: integer
- **created_count**: integer
- **skipped_count**: integer
- **membership_added_count**: integer
- **failed_count**: integer
- **created_at**: timestamp

### UserImportIssue

Row-level validation issues discovered during preflight or commit.

- **id**: UUID
- **batch_id**: UUID (UserImportBatch)
- **row_number**: integer (1-based)
- **severity**: string (error, warning)
- **field_name**: string | null
- **message**: string

### UserImportRowResult

Row-level outcomes for reporting and error report generation.

- **row_number**: integer
- **email**: string | null
- **full_name**: string | null
- **status**: string (created, skipped, membership_added, error)
- **message**: string
- **issues**: list of UserImportIssue references

### UserAccount (existing)

- **id**: UUID
- **email**: string (unique)
- **first_name**: string
- **last_name**: string
- **phone**: string | null
- **title**: string | null
- **password_hash**: string
- **is_active**: boolean
- **created_at**: timestamp

### NpoMembership (existing)

Represents a user’s role assignment within an NPO.

- **user_id**: UUID
- **npo_id**: UUID
- **role_id**: UUID
- **status**: string (active/inactive)
- **created_at**: timestamp

## Relationships

- UserImportBatch **belongs to** NPO (npo_id) and initiating admin (initiated_by_user_id).
- UserImportBatch **has many** UserImportIssue entries.
- UserImportRowResult **references** issues for reporting but may be stored only for reporting.
- UserAccount **has many** NpoMembership records.
- Import commit creates **UserAccount** records or **NpoMembership** records depending on row state.

## Validation Rules (from requirements)

- Required fields: full_name, email, role, NPO context.
- Optional fields: phone, title, password.
- Row limit: maximum 5,000 rows per file.
- Role scope: NPO-scoped roles only; reject Super Admin.
- Duplicate emails within file: error.
- Existing email in selected NPO: warning and skip.
- Existing email in other NPO: add membership with imported role.
- Missing password: generate temporary password and force reset via email.
- NPO identifier in file is informational; warn on mismatch.
