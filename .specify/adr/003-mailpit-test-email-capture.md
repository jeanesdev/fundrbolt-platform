# ADR-003: Mailpit as Test Email Capture Mechanism

## Status

**Accepted** — Implemented in Feature 047 (Beta-Readiness Integration Test Suite)

## Date

2026-05-30

## Context

The integration test suite requires automated email assertions: verifying that verification emails, receipts, password reset links, and auction outcome notifications are triggered and contain correct content. This requires a captured-outbox mechanism in local and CI environments that does not invoke the real Azure Communication Services (ACS) email sender.

### Alternatives Considered

**Option A: MailHog** (most commonly referenced alternative)
- Pros: Widely used, Docker image available, REST API for inspection
- Cons: Abandoned — no releases since 2021; open security issues unfixed; maintainer explicitly recommends migration to Mailpit

**Option B: Database-backed outbox**
- Pros: No extra service; emails stored in existing PostgreSQL; no extra port
- Cons: Requires test-only columns or a dedicated `captured_emails` table modifying production schema; adds complexity to `EmailService` for serializing messages; harder to query rich content (attachments, HTML bodies); does not simulate SMTP transport at all

**Option C: Mailpit** ← selected
- Pros: Active maintained replacement for MailHog (same Docker UX); REST API v2 supports message tagging and per-recipient filtering (needed for parallel test isolation per FR-049a); SMTP port 1025 (no credentials needed in dev); HTTP API port 8025; official Docker image `axllent/mailpit`
- Cons: One additional Docker service per environment (mitigated by Docker Compose profiles)

**Option D: Localstack SES**
- Pros: Closer to production ACS behavior
- Cons: Heavy (full AWS-emulation); overkill for email assertion; no benefit over Mailpit for reading captured messages

### Constraints

- FR-049: Suite MUST NOT invoke production ACS sender in any test environment
- FR-049a: Each parallel scenario MUST retrieve its own emails without false matches
- The test suite runs in GitHub Actions where additional Docker services are acceptable

## Decision

Use **Mailpit** (`axllent/mailpit:latest`) as the captured-outbox in local and CI environments.

Add an `EMAIL_BACKEND` configuration field to `backend/app/core/config.py`:

```python
email_backend: str = "azure_acs"  # Options: "azure_acs" | "mailpit" | "console"
```

- Default is `"azure_acs"` (production path unchanged)
- `"mailpit"` routes SMTP to `MAILPIT_SMTP_HOST:MAILPIT_SMTP_PORT` (no auth)
- `"console"` prints to stdout for unit tests that don't need email content assertions

Test environments set `EMAIL_BACKEND=mailpit` via `docker-compose.test.yml` override or CI environment variables.

Parallel test isolation (FR-049a) is achieved by provisioning a unique `test+{scenario_uuid}@fundrbolt.com` recipient address per scenario so Mailpit queries can filter by `to` without cross-scenario matches.

## Consequences

**Positive:**
- No production code paths changed; `email_backend` default keeps ACS as the only sender in staging/production
- Mailpit's REST API enables rich assertions (subject, body, links, attachments)
- Parallel isolation via unique recipient addresses is simple and reliable
- MailHog migration risk eliminated (Mailpit is the community successor)

**Negative:**
- One additional Docker service; engineers must run `docker-compose --profile test up` or the test-specific override
- If Mailpit's API breaks between versions, email helper (`e2e/helpers/email.ts`) may need updating

## Revisit Criteria

- If ACS adds a sandbox/emulation mode that supports the same REST query API, evaluate switching to eliminate the separate service
- If Mailpit becomes unmaintained (monitor GitHub activity annually)
- If email volume in parallel test runs exceeds Mailpit's in-memory capacity (increase Docker container memory limit or use Mailpit's `--max` flag first)
