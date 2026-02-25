# Data Model: Donation Tracking and Attribution

## Entity: Donation
- **Purpose**: Represents a single monetary contribution made by a donor within an event.
- **Key fields**:
  - `id` (UUID, primary identifier)
  - `event_id` (UUID, required, FK to Event)
  - `donor_user_id` (UUID, required, FK to User)
  - `amount` (decimal currency, required, > 0)
  - `is_paddle_raise` (boolean, required, default `false`)
  - `status` (enum: `active`, `voided`; required)
  - `voided_at` (datetime, nullable)
  - `created_at` (datetime, required)
  - `updated_at` (datetime, required)
- **Validation rules**:
  - `amount` must be numeric and strictly positive.
  - `event_id` and `donor_user_id` must reference existing records.
  - Donations are immutable for identity fields (`event_id`, `donor_user_id`) after creation unless explicitly approved by domain policy.
- **Relationships**:
  - Many donations belong to one event.
  - Many donations belong to one donor/user.
  - Many-to-many with DonationLabel via DonationLabelAssignment.

## Entity: DonationLabel
- **Purpose**: Reusable attribution tag scoped to one event (e.g., Last Hero, Coin Toss).
- **Key fields**:
  - `id` (UUID, primary identifier)
  - `event_id` (UUID, required, FK to Event)
  - `name` (string, required)
  - `is_active` (boolean, required, default `true`)
  - `retired_at` (datetime, nullable)
  - `created_at` (datetime, required)
  - `updated_at` (datetime, required)
- **Validation rules**:
  - `name` required, normalized, unique per event (case-insensitive).
  - Retired/inactive labels cannot be newly assigned but remain valid for history.
- **Relationships**:
  - One event has many labels.
  - Many-to-many with Donation via DonationLabelAssignment.

## Entity: DonationLabelAssignment
- **Purpose**: Join entity linking donations to labels, with assignment audit timestamps.
- **Key fields**:
  - `id` (UUID, primary identifier)
  - `donation_id` (UUID, required, FK to Donation)
  - `label_id` (UUID, required, FK to DonationLabel)
  - `created_at` (datetime, required)
  - `updated_at` (datetime, required)
- **Validation rules**:
  - Unique pair constraint on (`donation_id`, `label_id`).
  - `label.event_id` must equal `donation.event_id`.
- **Relationships**:
  - Many assignments belong to one donation.
  - Many assignments belong to one label.

## Referenced Existing Entities
- **Event**: Parent scope for donations and labels.
- **User (Donor)**: Donation owner/contributor record.

## State Transitions

### Donation
- `active` → `voided` (on delete/void operation by authorized role)
- `voided` is terminal for standard operational workflows (read-only in default flows)

### DonationLabel
- `active` → `inactive/retired` (label no longer assignable)
- Existing historical assignments remain intact after retirement

## Query Semantics
- Default list query excludes `voided` donations unless explicitly requested.
- Multi-label filter defaults to `ALL` match mode and supports optional `ANY` mode.
- Filters may combine: `event_id` (required context), `is_paddle_raise`, label set, status visibility.
