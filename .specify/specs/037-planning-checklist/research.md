# Research: Event Planning Checklist

**Feature**: 037-planning-checklist
**Date**: 2026-04-03

## Research Summary

No critical unknowns were identified in the Technical Context — all technologies and patterns are already established in the codebase. Research focused on validating best practices for the specific design decisions.

## Decisions

### 1. Checklist Item Model Design

**Decision**: Single `checklist_items` table with `event_id` FK, `due_date_is_template_derived` boolean flag, and `display_order` integer for custom ordering.

**Rationale**: Follows the existing `Sponsor` model pattern (event-scoped, display_order for ordering, cascade delete). The template-derived flag enables FR-012 (recalculate template-derived dates when event date changes) without needing a separate join table.

**Alternatives considered**:
- Separate `template_derived_due_dates` join table — rejected for unnecessary complexity for a boolean flag.
- Storing the original offset in each item — initially rejected but later added back as `offset_days` (nullable) on `checklist_items` to support FR-012 recalculation when event date changes. Only populated for template-derived items.

### 2. Template Storage at NPO Level

**Decision**: `checklist_templates` table with `npo_id` FK (nullable — null means system default); `checklist_template_items` table with `template_id` FK and `offset_days` integer.

**Rationale**: The system default template has `npo_id = NULL` and `is_system_default = TRUE`, making it immutable and shared. NPO templates have `npo_id` set and can be marked `is_default`. This avoids seeding per-NPO copies of the default template.

**Alternatives considered**:
- Copying system default into each NPO on creation — rejected because it creates data drift and requires migration when default template is updated.
- JSON blob for template items — rejected because it prevents querying and complicates template editing.

### 3. Relative Due Date Storage

**Decision**: `offset_days` integer column on template items. Negative = before event, positive = after event, zero = day of event. Example: -84 = 12 weeks before event, +14 = 2 weeks after event.

**Rationale**: Integer arithmetic is simple and unambiguous. Conversion is: `local_event_date + timedelta(days=offset_days)` where `local_event_date` is derived from `event_datetime` converted to the event's IANA timezone (see data-model.md Implementation Caveats). The offset arithmetic itself is timezone-safe but the base date extraction requires timezone-aware conversion.

**Alternatives considered**:
- ISO 8601 duration string (e.g., "P-12W") — rejected for unnecessary parsing complexity.
- Separate weeks/days fields — rejected for unnecessary normalization.

### 4. Auto-Population Hook Point

**Decision**: Hook into `EventService.create_event()` after the event is committed. Call `ChecklistService.populate_from_template()` which resolves the correct template (NPO default → system default) and inserts items.

**Rationale**: Matches the existing pattern where event creation is a single service call. The checklist population is a straightforward follow-up insert that doesn't affect the event object itself.

**Alternatives considered**:
- Database trigger — rejected because it bypasses application logic and is hard to test.
- Celery background task — rejected because the user expects to see the checklist immediately.

### 5. Frontend Persistent Panel Approach

**Decision**: Add a `<ChecklistPanel>` component rendered in `EventEditPage.tsx` above the `<Outlet />` (tab content area). The panel fetches checklist data independently via the checklist store.

**Rationale**: The EventEditPage is the layout wrapper for all event sections. Adding the panel here ensures it persists across tab changes without re-mounting. This follows the existing pattern where EventEditPage provides shared context via `EventWorkspaceContext`.

**Alternatives considered**:
- Sidebar right panel — rejected because the existing layout doesn't use sidebars within event context and mobile would be awkward.
- Sticky header overlay — rejected because it would conflict with the existing page header.

### 6. Drag-and-Drop Library

**Decision**: Use `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop reordering.

**Rationale**: `@dnd-kit` is the modern React DnD solution with excellent accessibility, touch support, and sortable list primitives. It's lightweight and actively maintained. The existing codebase doesn't have a DnD library, so this is a new dependency.

**Alternatives considered**:
- `react-beautiful-dnd` — deprecated/unmaintained.
- Native HTML drag events — rejected for poor accessibility and mobile support.
- No DnD (P3 deprioritized) — acceptable as a scope cut but included in plan since specified.

### 7. Status Transition UI Pattern

**Decision**: Cycle-click on a status badge. Click advances: Not Complete → In Progress → Complete. Right-click or secondary action regresses: Complete → In Progress → Not Complete. Alternatively, a dropdown with all three options.

**Rationale**: Single-click advancement (the most common action) is fast and matches SC-001. Regression is less common and can be slightly less discoverable. The dropdown fallback ensures discoverability.

**Alternatives considered**:
- Three-state checkbox — rejected because checkboxes imply binary states.
- Separate buttons per status — rejected for taking too much horizontal space per item.
