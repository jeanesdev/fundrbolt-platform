# Data Model: Configurable Our Cause Card Sections

**Branch**: `050-custom-sections` | **Date**: 2026-06-15

## New Tables

### `event_cause_page_config`

Stores the draft/publish versioning metadata for an event's cause page card layout. One row per event.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| event_id | UUID | FK events.id, UNIQUE, NOT NULL | One config per event |
| draft_version | INTEGER | NOT NULL, DEFAULT 1 | Incremented on every draft mutation; used for optimistic concurrency |
| published_version | INTEGER | NOT NULL, DEFAULT 0 | 0 = never published |
| last_published_at | TIMESTAMP | NULLABLE | |
| last_published_by_user_id | UUID | FK users.id, NULLABLE | |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

### `cause_section_cards`

One row per card (custom or built-in) per draft version per event.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| event_id | UUID | FK events.id, NOT NULL | |
| draft_version | INTEGER | NOT NULL | Which draft this card belongs to (matches event_cause_page_config.draft_version) |
| card_type | ENUM | NOT NULL | `text` \| `slideshow` \| `video` \| `built_in` |
| built_in_section_key | VARCHAR(64) | NULLABLE | Non-null only when card_type = `built_in`. Values: `about`, `sponsors`, `event_details` |
| display_order | INTEGER | NOT NULL | 0-indexed, unique per (event_id, draft_version) |
| is_enabled | BOOLEAN | NOT NULL, DEFAULT TRUE | |
| title | VARCHAR(200) | NULLABLE | Optional card header |
| show_header | BOOLEAN | NOT NULL, DEFAULT FALSE | |
| is_collapsible | BOOLEAN | NOT NULL, DEFAULT FALSE | |
| background_color_token | VARCHAR(64) | NULLABLE | Tailwind semantic token (e.g., `slate-50`), NULL = no background |
| border_color_token | VARCHAR(64) | NULLABLE | Tailwind semantic token, NULL = no border |
| content_html | TEXT | NULLABLE | Sanitised HTML, only for `text` card type |
| video_url | VARCHAR(2048) | NULLABLE | Only for `video` card type |
| video_media_source | ENUM | NULLABLE | `upload` \| `external`; only for `video` |
| video_autoplay | BOOLEAN | NULLABLE | Only for `video` |
| video_muted_by_default | BOOLEAN | NULLABLE | Only for `video` |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

**Constraints**:
- `CHECK (card_type != 'built_in' OR built_in_section_key IS NOT NULL)` — built_in cards must have a key
- `CHECK (card_type = 'built_in' OR built_in_section_key IS NULL)` — non-built_in cards must not have a key
- `UNIQUE (event_id, draft_version, display_order)` — no duplicate positions within a draft
- `UNIQUE (event_id, draft_version, built_in_section_key)` — no duplicate built-in sections per draft

### `cause_section_slide_items`

Slides belonging to a slideshow card.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| card_id | UUID | FK cause_section_cards.id ON DELETE CASCADE, NOT NULL | |
| display_order | INTEGER | NOT NULL | Within the card; unique per card_id |
| slide_variant | ENUM | NOT NULL | `image_only` \| `text_over_image` \| `text_only` |
| media_url | VARCHAR(2048) | NULLABLE | Null for `text_only` variant |
| media_source | ENUM | NULLABLE | `upload` \| `external`; null for `text_only` |
| alt_text | VARCHAR(500) | NULLABLE | WCAG required for image variants |
| overlay_html | TEXT | NULLABLE | Sanitised HTML, used for `text_over_image` and `text_only` variants |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

**Constraints**:
- `UNIQUE (card_id, display_order)` — no duplicate positions within a card
- `CHECK (slide_variant = 'text_only' OR media_url IS NOT NULL)` — image variants must have media
- `CHECK (slide_variant = 'text_only' OR (alt_text IS NOT NULL AND alt_text != ''))` — alt text required and non-empty for all image-bearing variants (WCAG 2.1 AA, success criterion 1.1.1); also enforced in the service layer

### `cause_section_card_revisions`

Append-only audit log for card configuration changes.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| event_id | UUID | FK events.id, NOT NULL | |
| changed_by_user_id | UUID | FK users.id, NOT NULL | |
| action | ENUM | NOT NULL | `draft_saved` \| `published` \| `reverted` |
| draft_version | INTEGER | NOT NULL | Version at time of action |
| changed_at | TIMESTAMP | NOT NULL | |
| change_summary | JSONB | NULLABLE | Diff summary (card IDs added/removed/reordered) |

## State Transitions & Snapshot Query Pattern

Cards are NOT stored as separate draft/published copies. A single set of rows exists per `(event_id, draft_version)`. The published snapshot is identified by matching `draft_version` to `event_cause_page_config.published_version`.

```
                  Admin edits
                      │
                      ▼
         cause_section_cards WHERE (event_id=X AND draft_version=N)
                      │
          Admin clicks Publish
                      │
                      ▼
         event_cause_page_config.published_version = N
                      │
          Donor PWA reads:
          cause_section_cards
            WHERE event_id=X
            AND draft_version = (SELECT published_version
                                   FROM event_cause_page_config
                                  WHERE event_id=X)
            AND is_enabled = TRUE
            ORDER BY display_order
```

When the admin saves a draft change, a new `draft_version = N+1` set of card rows is written (copy-on-write: copy existing rows to N+1, then apply the mutation to N+1). The `published_version` stays at N until Publish is clicked, at which point `published_version = N+1`. Old draft versions (N-1, N-2, ...) may be pruned after a configurable retention window (default: keep last 5 draft versions for undo support).

## Indexes

- `(event_id, draft_version)` on `cause_section_cards` — primary query path for admin and publish
- `(event_id)` on `event_cause_page_config` — lookup by event
- `(card_id, display_order)` on `cause_section_slide_items` — ordered slide retrieval
