# Data Model: Beta-Readiness Integration Test Suite

**Feature**: `047-integration-testing-beta`
**Note**: This feature introduces NO new production database tables. All entities below describe the *seed fixture schema* — the known-state baseline established by `tests/seed/seed.py` — and the *test infrastructure concepts* used by the test suite.

---

## Seed Fixture Entities

These are the entities produced by the seed script. Each seed entity maps to an existing production model in `backend/app/models/`.

### SeedUser

Represents a user account created by the seed for each role.

| Field | Value | Purpose |
|-------|-------|---------|
| `email` | `automation+{role}@fundrbolt.com` | Deterministic, role-tagged email |
| `password` | `TestPassword123!` | Shared test credential (stored in `SEED_TEST_PASSWORD` env var) |
| `role` | One of: `super_admin`, `npo_admin`, `npo_staff`, `checkin_staff`, `donor` | Covers every role in RBAC matrix (FR-037) |
| `is_verified` | `true` | Pre-verified so tests don't need to go through email verification |
| `has_accepted_tos` | `true` | Pre-accepted so tests don't need to handle consent banner unless testing consent |

Seed creates **one user per role** as shared read-only baseline, plus any per-NPO role users.

### SeedOrganization (NPO)

| Field | Value |
|-------|-------|
| `slug` | `seed-nonprofit` |
| `name` | `Seed Nonprofit Organization` |
| `status` | `approved` |
| `automation_tenant_slug` | `automation-tenant` (staging only, for nightly wipe/reseed scope) |

### SeedEvent

Three event instances covering distinct status states required by tests:

| Name | Slug | Status | Purpose |
|------|------|--------|---------|
| Seed Future Event | `seed-future-event` | `draft` / `scheduled` | Admin setup tests, ticket browsing |
| Seed Live Event | `seed-live-event` | `active` | Bidding, check-in, live dashboard, donor table view |
| Seed Past Event | `seed-past-event` | `complete` | Analytics, historical data tests |

Each event includes:
- Branding (logo, primary color)
- 3× SeedTicketPackage (standard, VIP, custom-options)
- 1× promo code (`SEED10` — 10% off)
- 10× SeedAuctionItem (5 silent, 5 live)
- 5× SeedSponsor (2 gold, 2 silver, 1 bronze tier)
- 3× SeedFoodOption (chicken, vegetarian, vegan)
- 5× SeedSeatingTable (50-guest capacity each)
- 1× SeedChecklistTemplate (applied to future event)
- 3× SeedRunOfShowItem

### SeedTicketPackage

| Name | Type | Price | Max Quantity |
|------|------|-------|-------------|
| General Admission | standard | $100 | 100 |
| VIP Table | standard | $500 | 20 |
| Custom Option Package | custom | varies | 50 |

Custom option package includes: `meal_choice` (required), `plus_one` (optional, +$50).

### SeedAuctionItem

| Item # | Type | Min Bid | Retail Value |
|--------|------|---------|-------------|
| Items 1–5 | `silent` | $50–$200 | $100–$500 |
| Items 6–10 | `live` | $100–$500 | $500–$2000 |

Each item has at least one media image (using test-fixture blob from Azurite).

### SeedSeatingTable

5 tables, capacity 50 each, numbered 1–5. One table has a custom name (`VIP Table`) and custom capacity (10). Table 1 has a designated table captain.

### SeedRegistration

Pre-created registrations for the live event only:
- 1× checked-in registration with bidder number and table assignment (for live-event tests)
- 1× unchecked-in registration (for check-in test)
- 1× multi-guest registration with meal selections

### SeedLegalDocument

Current published version of Terms of Service and Privacy Policy (required for consent tests FR-005, FR-039).

---

## Test Infrastructure Concepts

These are not database entities — they are concepts used within the test framework.

### CoveredFlow

A named user journey with a priority tier. Enumerated as TypeScript constants in `e2e/helpers/flows.ts`:

```typescript
export const CRITICAL_PATH_FLOWS = [
  'donor-signup',
  'donor-signin',
  'event-registration',
  'ticket-purchase',
  'bid-placement',
  'guest-checkin',
  'admin-event-creation',
] as const;
```

### MailpitMessage

Schema returned by Mailpit REST API (`GET /api/v2/messages`):

```typescript
interface MailpitMessage {
  ID: string;
  Subject: string;
  To: Array<{ Address: string; Name: string }>;
  Tags: string[];            // Used for per-test correlation (scenario ID tag)
  Snippet: string;
  Date: string;
}
```

Test helper `email.waitForMessage({ to, subjectContains, tag, timeout })` polls Mailpit until message arrives, satisfying FR-049a parallel isolation.

### ScopedEntity

An entity provisioned by a test scenario for its exclusive use. Created via the admin API using super-admin credentials. Example:

```typescript
// provision.ts
export async function provisionEvent(apiClient: ApiClient): Promise<{ eventId: string; slug: string }> {
  const res = await apiClient.post('/admin/events', { name: `Test Event ${randomUUID()}`, ... });
  return res.json();
}
```

Scoped entities are deleted after each test file (via `afterAll` hooks) to keep staging clean.

### RunResult (CI Artifact)

Playwright HTML report + trace files published as GitHub Actions artifact on every run. Schema of the JSON summary pushed to Teams and used for GitHub Issue creation:

```json
{
  "runId": "string",
  "triggeredBy": "nightly | pull_request",
  "completedAt": "ISO8601",
  "overallStatus": "pass | fail",
  "flows": [
    {
      "flowName": "string",
      "status": "pass | fail | skip",
      "specFile": "string",
      "durationMs": 0,
      "artifactUrl": "string | null"
    }
  ]
}
```

### ManualChecklistItem

Structure of each item in `tests/manual/pre-beta-checklist.md`:

```markdown
### [ITEM-NNN] Item title

**Preconditions**: What must be true before starting
**Steps**: Numbered, unambiguous action list
**Expected outcome**: Precisely observable result
**Evidence format**: Screenshot / transaction ID / confirmation text
**Pass / Fail**: [ ] Pass  [ ] Fail
**Notes**: ___________________
**Reviewed by**: ___________________ **Date**: ___________
```

---

## State Transitions Relevant to Tests

### Event Status

```
draft → scheduled → active → complete
         ↓ (invalid: active → scheduled) MUST reject
         ↓ (invalid: complete → active) MUST reject
```

Tested in: `e2e/full-suite/admin-event-setup/event-status.spec.ts`, `backend/app/tests/integration/test_event_lifecycle.py` (existing)

### Registration Status

```
pending → confirmed (after payment)
confirmed → checked_in (after staff check-in)
checked_in → (terminal)
```

Tested in: `e2e/critical-path/06-guest-checkin.spec.ts`, `e2e/full-suite/checkin-live/checkin.spec.ts`

### Ticket Status

```
available → reserved (cart) → sold (checkout)
sold → transferred (ticket transfer)
sold → revoked (revocation)
```

Tested in: `e2e/full-suite/donor-registration/ticket-management.spec.ts`
