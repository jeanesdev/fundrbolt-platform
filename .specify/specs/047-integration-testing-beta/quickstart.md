# Quickstart: Beta-Readiness Integration Test Suite

**Feature**: `047-integration-testing-beta`

This guide covers how to bring up the test environment, seed data, and run each test subset locally. A new engineer should be able to complete setup in under 30 minutes (SC-006).

---

## Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin) running
- `make` available
- Python 3.11+, Poetry installed (for backend/seed work)
- Node.js 22+, pnpm 10+ installed (for Playwright E2E)
- `gh` CLI authenticated (for nightly issue automation, optional locally)

---

## 1. Start the Development Stack

```bash
# Start all services including Mailpit (new)
docker compose up -d

# Verify Mailpit is running
open http://localhost:8025   # Mailpit web UI
curl http://localhost:8025/api/v2/messages   # Should return {"total":0,"messages":[]}
```

Mailpit SMTP listens on port **1025** (backend uses this when `EMAIL_BACKEND=mailpit`).
Mailpit API listens on port **8025** (tests use this to read captured emails).

---

## 2. Apply Seed Data

```bash
# Seed all fixtures (idempotent — safe to run multiple times)
make seed

# Or run directly:
cd tests/seed && poetry run python seed.py

# Staging automation tenant only (used by nightly CI):
cd tests/seed && poetry run python seed.py --tenant-slug automation-tenant
```

**Expected output**: Seed reports which entities were created vs already existed. Second run should report `0 created, N unchanged` for all entity types.

**What the seed creates**:
- Users: `super_admin`, `npo_admin`, `npo_staff`, `checkin_staff`, `donor` (emails: `automation+{role}@fundrbolt.com`, password: `TestPassword123!`)
- Organization: `seed-nonprofit` (approved)
- Events: `seed-future-event` (scheduled), `seed-live-event` (active), `seed-past-event` (complete)
- Each event: 3 ticket packages (incl. promo `SEED10`), 10 auction items, 5 tables, 5 sponsors, food options
- Registrations: Pre-checked-in and pending registrations on the live event
- Legal documents: Current published ToS + Privacy Policy

---

## 3. Run Tests

### Critical-Path PR Gate (7 flows, target ≤ 8 min)

```bash
# Run the PR gate suite locally
make test-critical-path

# Or directly:
cd e2e && pnpm playwright test critical-path/ --project=chromium

# With UI mode (useful for debugging):
cd e2e && pnpm playwright test critical-path/ --ui
```

### Full E2E Suite (Chromium)

```bash
make test-e2e

# Or:
cd e2e && pnpm playwright test full-suite/ --project=chromium
```

### WebKit Mobile Subset

```bash
cd e2e && pnpm playwright test --config playwright.mobile.config.ts
```

### Backend API Integration Tests (includes new FR coverage)

```bash
# All backend tests (existing + new):
make test-backend

# Or specific new integration tests:
cd backend && poetry run pytest app/tests/integration/test_ticket_checkout_flow.py -v
cd backend && poetry run pytest app/tests/integration/test_auction_bidding_flow.py -v
cd backend && poetry run pytest app/tests/integration/test_rbac_matrix.py -v
```

### All tests (E2E + API):

```bash
make test-all
```

---

## 4. View Test Results

- **Playwright HTML report**: `e2e/playwright-report/index.html` — open automatically after a run with `make test-e2e-report`
- **Playwright traces**: `e2e/test-results/*/trace.zip` — open with `cd e2e && pnpm playwright show-trace <path>`
- **Backend coverage**: `backend/htmlcov/index.html`
- **Mailpit web UI**: `http://localhost:8025` — view captured emails during test runs

---

## 5. Environment Variables for Tests

The following are set automatically by the test commands. Only needed if running tests manually without `make`:

```bash
# Backend (set in test process)
EMAIL_BACKEND=mailpit
MAILPIT_SMTP_HOST=localhost
MAILPIT_SMTP_PORT=1025

# E2E (set via playwright.config.ts or .env.test)
ADMIN_APP_URL=http://localhost:5173
DONOR_APP_URL=http://localhost:5174
API_URL=http://localhost:8000/api/v1
MAILPIT_API_URL=http://localhost:8025
SEED_TEST_PASSWORD=TestPassword123!
```

Create `e2e/.env.test` from `e2e/.env.test.example` for local overrides.

---

## 6. Reproduce a CI Failure Locally

When the PR gate or nightly run fails, the artifact includes a Playwright trace file. To reproduce:

```bash
# 1. Download the artifact from the GitHub Actions run
# 2. Extract and open the trace:
cd e2e && pnpm playwright show-trace path/to/trace.zip

# Or run the specific spec file with --debug:
cd e2e && pnpm playwright test critical-path/04-ticket-purchase.spec.ts --debug

# For backend failures, the pytest output is in the artifact as pytest-output.txt
cd backend && poetry run pytest app/tests/integration/test_ticket_checkout_flow.py -v --tb=long
```

SC-004 target: < 15 minutes to reproduce from artifact on 9 of 10 failures.

---

## 7. Nightly Run (Manual Trigger)

```bash
# Trigger nightly workflow manually against staging:
gh workflow run nightly-regression.yml \
  --field environment=staging \
  --field tenant_slug=automation-tenant
```

Check run status: `gh run list --workflow=nightly-regression.yml`

---

## 8. Automation Tenant Setup (Staging — One-Time)

The staging automation tenant must be seeded before the first nightly run:

```bash
# Set staging environment variables first (from GitHub secrets locally):
export DATABASE_URL="postgresql://..."  # staging DB
export SEED_TEST_PASSWORD="..."         # staging automation password

cd tests/seed && poetry run python seed.py \
  --tenant-slug automation-tenant \
  --environment staging
```

This is done automatically on the first nightly run via the `reseed-automation-tenant` step.

---

## 9. Verifying Seed Idempotency (SC-005)

```bash
make seed
make seed  # Run again — should report 0 new entities, no errors
```

---

## 10. Running a Single Covered Flow End-to-End

```bash
# Example: run only the ticket-purchase critical path flow
cd e2e && pnpm playwright test critical-path/04-ticket-purchase.spec.ts \
  --project=chromium \
  --reporter=html

open playwright-report/index.html
```
