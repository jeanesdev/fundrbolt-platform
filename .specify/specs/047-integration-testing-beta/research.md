# Research: Beta-Readiness Integration Test Suite

**Feature**: `047-integration-testing-beta`
**Date**: 2026-05-30

## Decision Log

---

### Decision 1: Email Capture — Mailpit over MailHog

- **Decision**: Use [Mailpit](https://mailpit.axllent.org/) as the captured-outbox service for local dev and CI.
- **Rationale**:
  - Mailpit is actively maintained (MailHog has been abandoned since 2022).
  - Mailpit exposes a clean REST API at `/api/v2/messages` with message tagging, filtering by recipient/subject, and per-message retrieval — directly satisfying FR-049a (per-scenario email retrieval without false matches).
  - Docker image `axllent/mailpit` is <20 MB and starts in <1 s.
  - Supports SMTP on port 1025 (compatible with ACS SDK override) and HTTP API on port 8025.
  - Configuration: set `MAILPIT_API_URL=http://localhost:8025` in test env; backend email service uses `smtp://localhost:1025` when `EMAIL_BACKEND=mailpit`.
- **Alternatives considered**:
  - **MailHog**: Unmaintained; API lacks filtering/tagging capability needed for parallel test isolation.
  - **Database outbox**: Requires schema changes and coupling of test infrastructure to production models.
  - **Testcontainers**: Adds significant Java/Go dependency overhead for what is a simple SMTP mock.

---

### Decision 2: E2E Test Location — Top-Level `e2e/` Project

- **Decision**: Create a single top-level `e2e/` Playwright project covering both PWAs and the backend API.
- **Rationale**:
  - The admin PWA and donor PWA already have small Playwright smoke tests embedded in their own `tests/` directories. These are deliberately narrow (smoke-only), not the comprehensive cross-PWA flows required by FR-044–FR-047.
  - Cross-PWA flows (e.g., admin creates event → donor registers → staff checks in) cannot be owned by a single PWA project without coupling.
  - A single `playwright.config.ts` in `e2e/` can declare separate projects for `chromium`, `webkit-mobile-subset`, `admin-pwa`, and `donor-pwa` base URLs, making the matrix explicit and configurable.
  - The existing per-PWA smoke tests remain in place and continue to run independently in each PWA's CI job; they are not replaced.
- **Alternatives considered**:
  - **Tests in `frontend/fundrbolt-admin/tests/` and `frontend/donor-pwa/tests/`**: Cross-PWA flows would require shared fixture code across two projects; no single entry point for the PR gate.
  - **Backend pytest with browser**: pytest-playwright works but TypeScript test files integrate better with Playwright's native tooling, tracing, and HTML reporter.

---

### Decision 3: Time Simulation Strategy

- **Decision**: `pytest-freezegun` for Python/API tests; Playwright `page.clock` API for browser tests.
- **Rationale**:
  - `pytest-freezegun` (wraps `freezegun`) patches `datetime.datetime.now()`, `time.time()`, and `asyncio` event loop time — sufficient for API-layer scenarios involving session expiry (FR-004), rate-limit windows (FR-003), and auction close (FR-026).
  - Playwright 1.45+ ships `page.clock.setFixedTime()` and `page.clock.install({ time })` for deterministic browser-side clock control — covers event status transitions visible in the UI (FR-009, FR-032) without sleeping.
  - Both approaches are zero-config with respect to the application code (no special endpoint needed).
- **Alternatives considered**:
  - **Real-time waiting**: Violates FR-051 and makes the PR gate exceed 8 minutes.
  - **Custom time-warp endpoint**: Adds production code complexity; YAGNI for what freezegun + clock covers.

---

### Decision 4: Seed Architecture — Standalone Python Script with Idempotent Upserts

- **Decision**: Single `tests/seed/seed.py` script using SQLAlchemy with `ON CONFLICT DO NOTHING` / `DO UPDATE` for all entities.
- **Rationale**:
  - A standalone script (not a pytest fixture) can be run independently from any context: `make seed`, CI pipeline, nightly staging reset, and locally by developers.
  - Idempotency (FR-050, SC-005) is achieved at the SQL level — re-running produces identical state, not errors or duplicates.
  - Entity modules under `tests/seed/fixtures/` mirror the backend's model structure for readability and can import SQLAlchemy models directly.
  - Seed script accepts `--tenant-slug automation-tenant` flag for staging automation-tenant-only reseeding (FR-045a).
- **Scoped entity provisioning for mutation scenarios (FR-050a)**: Browser tests and API tests call the existing admin API via a super-admin client to provision scoped entities (create a new event, user, ticket package, etc.) — no test-only API routes added (YAGNI).
- **Alternatives considered**:
  - **Pytest fixtures only**: Not runnable outside of pytest; can't serve staging nightly reseed.
  - **Alembic data migrations**: Couples test data to schema migration history — fragile and inappropriate for volatile fixture data.
  - **Test-only seed API endpoints**: Adds production routes with no production purpose; violates YAGNI.

---

### Decision 5: CI Workflow Structure

- **Decision**: Two GitHub Actions workflows — `critical-path-gate.yml` (PR trigger) and `nightly-regression.yml` (cron trigger).
- **Rationale**:
  - PR gate: 7 critical-path flows in parallel (one Playwright shard per flow) with a shared setup job that seeds the database. Must complete in < 8 minutes (FR-044, SC-001).
  - Nightly: Full suite against staging, matrix over `full-suite/**` spec groups, continue-on-error per shard so partial failures still publish results (FR-045, FR-046).
  - Separation keeps CI failure reasons clear: PR gate failure = regression in critical path; nightly failure = broader integration or environment issue.
- **Parallel execution**: Use Playwright `--shard N/M` for the critical-path job to stay within the 8-minute budget. Each shard spins up its own Playwright worker group.
- **Alternatives considered**:
  - **Single workflow with conditions**: Possible, but harder to read and maintain; shard count logic would be intertwined.
  - **Self-hosted runner for speed**: Out of scope; GitHub-hosted `ubuntu-latest` is sufficient for the target timing with sharding.

---

### Decision 6: Notification Strategy — MS Teams Incoming Webhook + GitHub API

- **Decision**: Teams notifications via Incoming Webhook; GitHub Issues via `gh` CLI in nightly workflow.
- **Rationale**:
  - Teams Incoming Webhook requires only a URL secret (`MSTEAMS_WEBHOOK_URL`) — no bot registration or app manifest needed (FR-045b).
  - GitHub Issues deduplication (FR-045c): query open issues with label `nightly-failure` and title containing the flow name; update if found, create if not. `gh` CLI is already available on GitHub Actions runners.
  - Issue auto-close on recovery: when a flow passes, the workflow closes any open issue with matching title via `gh issue close`.
- **Alternatives considered**:
  - **Slack**: Not in the current tooling stack.
  - **GitHub Checks API**: Suitable for PR gate pass/fail, but cannot create persistent issue threads for nightly failures.
  - **PagerDuty**: Overkill for nightly regression failures; PagerDuty is reserved for production incidents per constitution.

---

### Decision 7: Concurrency Tests at API Level

- **Decision**: FR-024 (concurrent bidding, single correct winner) is verified via Python pytest with concurrent `asyncio` tasks, not via browser.
- **Rationale**:
  - Concurrent HTTP requests are deterministic and fast in pytest; browser tabs are not.
  - The application-layer invariant (single winner, no lost bids, consistent bid history) is a backend concern; the UI will reflect it correctly if the API is correct.
  - Avoids flaky parallel browser coordination that would inflate nightly runtime.
- **Alternatives considered**:
  - **Two Playwright browser contexts**: Technically possible, but slower and introduces race conditions in the test harness itself.

---

### Decision 8: Browser Matrix — Chromium Full Suite + WebKit Mobile Subset

- **Decision**: All E2E browser scenarios run on Chromium. A designated subset also runs on WebKit (mobile Safari emulation at 375 × 812, `isMobile: true`).
- **WebKit subset covers** (per FR-047a):
  - PWA install prompt flow
  - Offline cached event home
  - Service worker update banner
  - Ticket checkout (complete flow)
  - Sign-in
  - 375 px responsive layout spot-checks (key pages)
- **Rationale**: Firefox is explicitly out of scope (spec). WebKit subset is kept small to avoid doubling nightly runtime.

---

### Decision 9: Automation Tenant on Staging

- **Decision**: Reserved NPO with `slug = automation-tenant`, `name = "FundrBolt Automation Tenant"`. All staging nightly test entities live under this org. Nightly workflow deletes and reseeds only rows belonging to this org's `npo_id`.
- **Rationale**: Satisfies FR-045a (dedicated automation tenant, no mutation of human-use tenants). Deletion scope is enforced by a `--tenant-slug` argument to `seed.py`.
- **Automation accounts**: `automation+superadmin@fundrbolt.com`, `automation+donor@fundrbolt.com`, etc. Credentials stored in GitHub Actions secrets `STAGING_AUTOMATION_*`.

---

### Decision 10: Manual Checklist Location

- **Decision**: `docs/manual/pre-beta-checklist.md` — versioned Markdown in the repository.
- **Rationale**: Version-controlled so changes are tracked; Markdown renders on GitHub for easy review; satisfies FR-052 (versioned, unambiguous, reviewer-completable document).

---

## Dependency Version Pins

| Package | Version | Purpose |
|---------|---------|---------|
| `axllent/mailpit` | `latest` (docker) | Email capture |
| `@playwright/test` | `^1.58.2` (already in frontends) | E2E browser automation |
| `freezegun` | `^1.5.0` | Python time simulation |
| `pytest-freezegun` | `^0.4.2` | pytest freezegun plugin |

No new production dependencies are introduced by this feature.
