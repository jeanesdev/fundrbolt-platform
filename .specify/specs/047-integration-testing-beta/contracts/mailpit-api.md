# Mailpit API Contract (Test Infrastructure)

**Base URL**: `http://localhost:8025` (local dev) / `http://mailpit:8025` (Docker network)
**Reference**: https://mailpit.axllent.org/docs/api-v2/

This document describes the subset of the Mailpit REST API used by the test suite's email helper (`e2e/helpers/email.ts` and `tests/seed/helpers.py`).

---

## GET /api/v2/messages

List all captured messages with optional filtering.

**Query parameters** (all optional):

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (1-based, default 1) |
| `limit` | integer | Messages per page (default 50, max 100) |

**Response `200`**:
```json
{
  "total": 3,
  "unread": 1,
  "count": 3,
  "messages": [
    {
      "ID": "abc123def456",
      "Subject": "Verify your FundrBolt email",
      "From": { "Address": "noreply@fundrbolt.com", "Name": "FundrBolt" },
      "To": [{ "Address": "donor@example.com", "Name": "" }],
      "Tags": ["scenario:abc123"],
      "Date": "2026-05-30T11:00:00Z",
      "Snippet": "Click the link below to verify..."
    }
  ]
}
```

---

## GET /api/v2/message/{id}

Retrieve a single message by Mailpit message ID, including full body.

**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Mailpit message ID |

**Response `200`**:
```json
{
  "ID": "abc123def456",
  "Subject": "Verify your FundrBolt email",
  "From": { "Address": "noreply@fundrbolt.com", "Name": "FundrBolt" },
  "To": [{ "Address": "donor@example.com", "Name": "" }],
  "Tags": ["scenario:abc123"],
  "Date": "2026-05-30T11:00:00Z",
  "Text": "Click the link: https://...",
  "HTML": "<html>...</html>"
}
```

---

## DELETE /api/v1/messages

Delete all messages (used in test teardown to keep Mailpit clean).

**Response `200`**: `{}`

---

## Email Tagging Convention (FR-049a Parallel Isolation)

To prevent false matches between parallel test scenarios, each test that asserts on email content MUST:

1. Tag the expected message before triggering the email by injecting a `X-Scenario-ID` header via backend config (or by filtering on recipient address uniqueness).
2. When querying Mailpit, filter by `to` address using a unique per-scenario email (e.g., `test+{uuid}@fundrbolt.com`) rather than a shared address.

**Preferred approach**: Each scenario that sends email provisions a unique recipient address using `provisionScenarioEmail(scenarioId)` from `e2e/helpers/provision.ts`, which generates `test+{scenarioId}@fundrbolt.com`. The test then queries Mailpit filtering on that exact `to` address:

```typescript
// e2e/helpers/email.ts
export async function waitForEmail(opts: {
  to: string;             // unique per-scenario address
  subjectContains: string;
  timeout?: number;       // default 10_000ms
}): Promise<MailpitMessage> { ... }
```

---

## Mailpit SMTP Configuration

Backend email service uses SMTP transport when `EMAIL_BACKEND=mailpit`:

| Setting | Value |
|---------|-------|
| SMTP host | `localhost` (local) / `mailpit` (Docker network) |
| SMTP port | `1025` |
| No authentication | (Mailpit accepts all, no TLS in dev) |

Backend `EmailService` checks `settings.email_backend` and routes accordingly. No SMTP credentials needed for Mailpit.
