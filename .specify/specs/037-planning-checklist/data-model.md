# Data Model: Event Planning Checklist

**Feature**: 037-planning-checklist
**Date**: 2026-04-03

## Entity Relationship Diagram

```
NPO (existing)
 ├── 1:N → ChecklistTemplate (npo_id FK, nullable for system default)
 │          └── 1:N → ChecklistTemplateItem (template_id FK, CASCADE)
 └── 1:N → Event (existing)
            └── 1:N → ChecklistItem (event_id FK, CASCADE)
```

## Tables

### checklist_templates

Reusable checklist templates stored at the NPO level. One system default (npo_id = NULL) is seeded.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default uuid4 | Template identifier |
| npo_id | UUID | FK → npos.id (RESTRICT), nullable, indexed | Owning organization. NULL = system default |
| name | VARCHAR(200) | NOT NULL | Template display name |
| is_default | BOOLEAN | NOT NULL, default FALSE | Whether this is the NPO's default template |
| is_system_default | BOOLEAN | NOT NULL, default FALSE | Whether this is the immutable system template |
| created_by | UUID | FK → users.id, nullable | User who created the template. NULL for system-seeded templates |
| created_at | TIMESTAMPTZ | NOT NULL, server_default now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, server_default now(), onupdate now() | Last update timestamp |

**Constraints**:
- UNIQUE(npo_id, name) — no duplicate template names per organization
- CHECK: is_system_default = TRUE implies npo_id IS NULL
- Partial unique index: only one `is_default = TRUE` per npo_id (enforced via unique index on npo_id WHERE is_default = TRUE)

### checklist_template_items

Individual task definitions within a template.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default uuid4 | Template item identifier |
| template_id | UUID | FK → checklist_templates.id (CASCADE), NOT NULL, indexed | Parent template |
| title | VARCHAR(200) | NOT NULL | Task title |
| offset_days | INTEGER | nullable | Days relative to event date. Negative = before event, positive = after, 0 = day of. NULL = no due date when applied |
| display_order | INTEGER | NOT NULL, default 0 | Sort position within template |

**Constraints**:
- CHECK: length(title) >= 1

### checklist_items

Concrete checklist items attached to a specific event.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default uuid4 | Item identifier |
| event_id | UUID | FK → events.id (CASCADE), NOT NULL, indexed | Parent event |
| title | VARCHAR(200) | NOT NULL | Task title |
| due_date | DATE | nullable | When the task is due |
| status | ENUM('not_complete', 'in_progress', 'complete') | NOT NULL, default 'not_complete' | Current task status |
| display_order | INTEGER | NOT NULL, default 0 | Sort position (0 = natural order, custom values from drag-and-drop) |
| due_date_is_template_derived | BOOLEAN | NOT NULL, default FALSE | TRUE if due_date was calculated from a template offset (recalculated on event date change) |
| offset_days | INTEGER | nullable | Original template offset (stored for recalculation). NULL if manually set |
| completed_at | TIMESTAMPTZ | nullable | Timestamp when status changed to 'complete' |
| created_by | UUID | FK → users.id, NOT NULL | User who created the item |
| created_at | TIMESTAMPTZ | NOT NULL, server_default now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, server_default now(), onupdate now() | Last update timestamp |

**Constraints**:
- CHECK: length(title) >= 1
- Enum type: `checklist_item_status_enum` with values ('not_complete', 'in_progress', 'complete')

## State Transitions

### ChecklistItem.status

```
not_complete ←→ in_progress ←→ complete
```

- Forward: not_complete → in_progress → complete
- Backward: complete → in_progress → not_complete
- On transition to 'complete': set completed_at = now()
- On transition away from 'complete': set completed_at = NULL

### Due Date Recalculation (on event date change)

For all checklist_items WHERE event_id = changed_event AND due_date_is_template_derived = TRUE:
```
local_date = event.event_datetime.astimezone(ZoneInfo(event.timezone)).date()
new_due_date = local_date + timedelta(days=offset_days)
```

> **Note**: The Event model has both `event_datetime: DateTime(timezone=True)` and `timezone: str` (IANA name). Always convert to the event's local timezone before extracting the date — naive `.date()` on UTC-stored datetime may yield the wrong calendar day for non-UTC events.

Items WHERE due_date_is_template_derived = FALSE are not modified.

## Seed Data

### System Default Template

One row in `checklist_templates` with:
- npo_id = NULL
- name = "Fundraising Gala Default"
- is_default = FALSE (NPO-level concept)
- is_system_default = TRUE

26 rows in `checklist_template_items` mapping to the default template table in the spec (offset_days values: -84, -84, -70, -70, -63, -63, -56, -56, -49, -42, -42, -35, -28, -28, -28, -21, -14, -7, -3, -3, -1, 0, 0, +3, +7, +14).

## Implementation Caveats

1. **Event date field**: The Event model uses `event_datetime: DateTime(timezone=True)` and `timezone: str` (IANA name). Convert to local date before offset calculation: `event.event_datetime.astimezone(ZoneInfo(event.timezone)).date()`. Naive `.date()` on UTC-stored datetime may yield the wrong calendar day for events in non-UTC timezones.
2. **System template created_by**: The `created_by` column on `checklist_templates` is nullable to accommodate the seeded system default template which has no user creator.
3. **Router registration**: Admin checklist routes are registered in `backend/app/api/v1/__init__.py` (not `main.py`), following the existing `api_router.include_router()` pattern.
4. **Enum naming**: Use `checklist_item_status_enum` suffix per existing convention (e.g., `discount_type_enum`).
