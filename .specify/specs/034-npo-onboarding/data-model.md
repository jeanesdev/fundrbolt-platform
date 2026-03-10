# Data Model: NPO Onboarding Wizard (034)

**Date**: 2026-03-10
**Branch**: `034-npo-onboarding`

---

## New Entities

### `onboarding_sessions` (NEW TABLE)

Tracks server-side wizard state for in-progress onboarding. Identified by an opaque token sent by the browser. Expires after 24 hours.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, default gen_random_uuid() | Internal ID |
| `token` | TEXT | UNIQUE, NOT NULL, indexed | Opaque session identifier (sent to browser) |
| `session_type` | ENUM | NOT NULL | `user_signup` or `npo_onboarding` |
| `current_step` | VARCHAR(50) | NOT NULL, default `'account'` | Name of the active wizard step |
| `completed_steps` | JSONB | NOT NULL, default `'[]'` | Array of completed step name strings |
| `form_data` | JSONB | NOT NULL, default `'{}'` | Accumulated step data (no passwords stored) |
| `user_id` | UUID | FK → `users.id` SET NULL, nullable | Set after account creation step completes |
| `expires_at` | TIMESTAMP | NOT NULL | `created_at + 24 hours` |
| `created_at` | TIMESTAMP | NOT NULL, default now() | |
| `updated_at` | TIMESTAMP | NOT NULL, default now() | Updated on every step save |

**Enum**: `OnboardingSessionType` = `user_signup` | `npo_onboarding`

**`form_data` JSONB shape** (accumulated incrementally; never contains passwords):
```json
{
  "account": {
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@example.org",
    "phone": "+15551234567"
  },
  "npo_profile": {
    "npo_name": "Helping Hands",
    "ein": "12-3456789",
    "website_url": "https://helpinghands.org",
    "phone": "+15559876543",
    "mission_description": "We help local families."
  },
  "first_event": {
    "event_name": "Spring Gala 2026",
    "event_date": "2026-06-15",
    "event_type": "gala"
  }
}
```

**Indexes**: `token` (unique), `user_id`, `expires_at` (for cleanup queries)

**Validation rules**:
- `token` generated server-side (UUID v4); never accepted from client.
- Sessions with `expires_at < now()` are treated as not found (lazy expiry).
- At most one active (non-expired) session per `user_id` for a given `session_type` (enforced in service layer, not DB constraint, to avoid complexity).

**Migration**: `XXXX_add_onboarding_sessions_table.py`

---

## Modified Entities

### `npos` table — NPOStatus enum (MODIFIED)

Add `UNDER_REVISION` to the existing `NPOStatus` enum.

**Before**:
```python
class NPOStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SUSPENDED = "suspended"
    REJECTED = "rejected"
```

**After**:
```python
class NPOStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SUSPENDED = "suspended"
    REJECTED = "rejected"
    UNDER_REVISION = "under_revision"   # ← NEW: NPO is reopened, applicant revising
```

**Updated state transitions**:
```
DRAFT              → PENDING_APPROVAL  (applicant submits)
PENDING_APPROVAL   → APPROVED          (SuperAdmin)
PENDING_APPROVAL   → REJECTED          (SuperAdmin)
REJECTED           → UNDER_REVISION    (SuperAdmin reopens)  ← NEW
UNDER_REVISION     → PENDING_APPROVAL  (applicant resubmits)  ← NEW
APPROVED           → SUSPENDED         (SuperAdmin)
SUSPENDED          → APPROVED          (SuperAdmin)
```

**Migration**: `XXXX_add_npo_application_reopened_status.py` (combined with ApplicationStatus change below)

---

### `npo_applications` table — ApplicationStatus enum (MODIFIED)

Add `REOPENED` to the existing `ApplicationStatus` enum.

**Before**:
```python
class ApplicationStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
```

**After**:
```python
class ApplicationStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    REOPENED = "reopened"   # ← NEW: admin reopened; applicant can revise + resubmit
```

**Revision history via existing `review_notes` JSONB field** (array of objects):
```json
[
  {
    "action": "submitted",
    "actor_user_id": "uuid-applicant",
    "timestamp": "2026-03-10T14:00:00Z",
    "notes": null
  },
  {
    "action": "rejected",
    "actor_user_id": "uuid-admin",
    "timestamp": "2026-03-12T09:30:00Z",
    "notes": "EIN format appears incorrect — please verify and resubmit."
  },
  {
    "action": "reopened",
    "actor_user_id": "uuid-admin",
    "timestamp": "2026-03-13T10:00:00Z",
    "notes": "Reopened for EIN correction."
  },
  {
    "action": "resubmitted",
    "actor_user_id": "uuid-applicant",
    "timestamp": "2026-03-14T11:00:00Z",
    "notes": null
  }
]
```

No new columns added to `npo_applications` — the `review_notes` field absorbs the full revision history.

---

## Unchanged Entities (no schema changes)

| Entity | Table | Why unchanged |
|--------|-------|---------------|
| User Account | `users` | Existing `email_verified`, `is_active` fields are sufficient |
| NPO | `npos` | Only status enum is extended; no new columns |
| NPO Member | `npo_members` | Existing role assignment handles approved-NPO admin elevation |
| Event | `events` | Existing create flow used for optional first event |
| Audit Log | `audit_logs` | Existing table receives new action entries; no schema change |

---

## Migration Plan

### Migration 1: `add_onboarding_sessions_table`

```sql
-- Create enum
CREATE TYPE onboardingsessiontype AS ENUM ('user_signup', 'npo_onboarding');

-- Create table
CREATE TABLE onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    session_type onboardingsessiontype NOT NULL,
    current_step VARCHAR(50) NOT NULL DEFAULT 'account',
    completed_steps JSONB NOT NULL DEFAULT '[]',
    form_data JSONB NOT NULL DEFAULT '{}',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX ix_onboarding_sessions_token ON onboarding_sessions (token);
CREATE INDEX ix_onboarding_sessions_user_id ON onboarding_sessions (user_id);
CREATE INDEX ix_onboarding_sessions_expires_at ON onboarding_sessions (expires_at);
```

**Rollback**: `DROP TABLE onboarding_sessions; DROP TYPE onboardingsessiontype;`

### Migration 2: `add_npo_application_reopened_status`

```sql
-- Extend NPOStatus enum
ALTER TYPE npostatus ADD VALUE IF NOT EXISTS 'under_revision';

-- Extend ApplicationStatus enum
ALTER TYPE applicationstatus ADD VALUE IF NOT EXISTS 'reopened';
```

**Note**: PostgreSQL enum additions are irreversible without recreating the type. Rollback script should be documented in runbook but effectively this is a forward-only migration.
