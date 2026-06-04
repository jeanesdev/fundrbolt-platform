# Data Model — 048 Attendee Profile Survey

## New Tables

### `event_survey_configs`
Per-event survey configuration. One-to-one with `events`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `event_id` | UUID | FK→events.id CASCADE, UNIQUE, NOT NULL | one-per-event |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT false | NPO enables survey for this event |
| `modal_prompt_title` | VARCHAR(200) | NOT NULL, DEFAULT "Tell us about yourself" | Configurable modal heading |
| `modal_prompt_body` | VARCHAR(500) | NOT NULL | Configurable incentive text |
| `discount_cents` | INTEGER | NOT NULL, DEFAULT 0, CHECK ≥ 0 | Survey completion discount (0 = no discount) |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

### `survey_questions`
Questions belonging to an event survey config.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `survey_config_id` | UUID | FK→event_survey_configs.id CASCADE, NOT NULL | |
| `text` | VARCHAR(500) | NOT NULL | Question display text |
| `display_order` | INTEGER | NOT NULL, DEFAULT 0 | Sort order in modal |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Soft-hide without deleting |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

Index: `(survey_config_id, display_order)`

### `survey_question_options`
Selectable options for each question.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `question_id` | UUID | FK→survey_questions.id CASCADE, NOT NULL | |
| `text` | VARCHAR(300) | NOT NULL | Option display text |
| `display_order` | INTEGER | NOT NULL, DEFAULT 0 | Sort order |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

Index: `(question_id, display_order)`

### `survey_responses`
One per attendee per event — records whether survey was completed or skipped.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `registration_id` | UUID | FK→event_registrations.id CASCADE, UNIQUE, NOT NULL | one-per-registration |
| `survey_config_id` | UUID | FK→event_survey_configs.id SET NULL, nullable | snapshot of which config was answered |
| `status` | VARCHAR(20) | NOT NULL CHECK IN ('completed','skipped') | |
| `discount_cents_applied` | INTEGER | NOT NULL, DEFAULT 0 | snapshot of discount at time of completion |
| `completed_at` | TIMESTAMPTZ | nullable | NULL if skipped |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

Index: `(registration_id)` — unique enforced above

### `survey_answers`
One row per question answered within a response.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `response_id` | UUID | FK→survey_responses.id CASCADE, NOT NULL | |
| `question_id` | UUID | FK→survey_questions.id SET NULL, nullable | allow question deletion; NULL after question deleted |
| `selected_option_id` | UUID | FK→survey_question_options.id SET NULL, nullable | allow option deletion; NULL after option deleted |
| `question_text_snapshot` | VARCHAR(500) | NOT NULL | verbatim question text at submission time |
| `option_text_snapshot` | VARCHAR(300) | NOT NULL | verbatim option text at submission time |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

Index: `(response_id)`

> **Note**: Both `question_id`/`selected_option_id` (FK references) AND snapshot text columns are stored. The FK columns enable structured querying (sort, filter by answer) while FKs are SET NULL on deletion — the snapshots always preserve historical display.

---

## Modified Tables

### `donor_label_assignments` (existing)
Add two columns:

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `is_suggested` | BOOLEAN | NOT NULL, DEFAULT false | True = auto-suggested from survey; awaiting admin confirmation |
| `source` | VARCHAR(20) | NOT NULL, DEFAULT 'manual' CHECK IN ('manual','survey_auto') | How this assignment was created |

### `donor_labels` (existing)
Add one column:

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `is_system_default` | BOOLEAN | NOT NULL, DEFAULT false | True = one of the 4 built-in category labels |

### `checkout_session` models (enum extension, Alembic type change)
- Add `SURVEY_DISCOUNT = "survey_discount"` to `CheckoutItemSourceTypeEnum`
- PostgreSQL: `ALTER TYPE checkoutitemsourcetype ADD VALUE 'survey_discount'`

---

## Entity Relationships

```
events (1) ─────────────────── (0..1) event_survey_configs
                                           │
                                           │ (1..*)
                                      survey_questions
                                           │
                                           │ (1..*)
                                    survey_question_options

event_registrations (1) ─────── (0..1) survey_responses
                                           │
                                           │ (0..*)
                                      survey_answers ──── (0..1) survey_questions

npos (1) ──── (*) donor_labels (existing, add is_system_default)
                       │
                    (*) donor_label_assignments (existing, add is_suggested, source)
                       │
                    (*) users (existing)
```

---

## 4 Default Donor Category Labels
Seeded per NPO (existing NPOs via migration, new NPOs via NPO creation hook):

| Name | Color | is_system_default |
|---|---|---|
| Impact Driven | `#2563EB` (blue) | true |
| Heart Driven | `#DC2626` (red) | true |
| Community Driven | `#16A34A` (green) | true |
| Participation Driven | `#D97706` (amber) | true |

---

## Label Auto-Suggestion Logic
Computed synchronously on `POST /donor/events/{event_id}/survey/response` from `option_text_snapshot` values:

| Category | Trigger keywords in answers |
|---|---|
| Impact Driven | "measurable impact", "fund a proven program", "program" |
| Heart Driven | "personal connection", "faith", "values", "family", "compassion" |
| Community Driven | "community leadership", "joining others", "community", "leadership" |
| Participation Driven | "fun event experience", "bidding", "games", "raffle", "bid" |

Multiple labels can be suggested if multiple categories match (per clarification B).
All suggestions stored as `is_suggested=true, source='survey_auto'` on `donor_label_assignments`.
