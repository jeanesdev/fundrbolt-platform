# Manual Testing Guide — Feature 047: Beta Integration Test Suite

This document describes everything you need to do manually to validate feature 047
before going to beta. The automated test suite covers the happy-path API/browser flows;
this guide covers what cannot be automated.

---

## 1. GitHub Secrets to Configure

These secrets must be set in your GitHub repository settings
(**Settings → Secrets and variables → Actions**) before CI workflows will run correctly.

| Secret name | Required for | How to obtain |
|---|---|---|
| `MSTEAMS_WEBHOOK_URL` | Nightly failure notifications | Create an Incoming Webhook in your Teams channel |
| `STAGING_DATABASE_URL` | Nightly regression (staging seed) | Azure Portal → PostgreSQL → Connection strings |
| `STAGING_REDIS_URL` | Nightly regression | Azure Portal → Redis → Access keys |
| `STAGING_JWT_SECRET_KEY` | Nightly regression | Same value used in staging App Service settings |
| `STAGING_SEED_TEST_PASSWORD` | Nightly regression | Choose a strong password (≥12 chars) |
| `STRIPE_SECRET_KEY` | Payment e2e (staging) | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Payment e2e (staging) | Stripe Dashboard → Webhooks |

> **Note**: `GITHUB_TOKEN` is automatically provided — no action needed.

---

## 2. Running Workflows Manually

### Trigger the nightly regression on demand

```bash
gh workflow run nightly-regression.yml --ref main
```

Watch it:

```bash
gh run watch $(gh run list --workflow=nightly-regression.yml --limit=1 --json databaseId -q '.[0].databaseId')
```

### Trigger the critical-path gate on demand

```bash
gh workflow run critical-path-gate.yml --ref main
```

---

## 3. Running the Seed Locally

```bash
# Start docker services
make docker-up

# Apply migrations
make migrate

# Seed integration test data (idempotent — safe to run multiple times)
make seed
```

Expected output on first run:
```
legal_documents: 2 created, 0 unchanged
users:           5 created, 0 unchanged
organizations:   1 created, 0 unchanged
events:          3 created, 3 unchanged
tickets:         12 created, 0 unchanged
auction_items:   30 created, 0 unchanged
seating:         7 created, 0 unchanged
sponsors:        15 created, 0 unchanged
```

Seed credentials: `automation+{role}@fundrbolt.com` / `TestPassword123!`
(roles: `super_admin`, `npo_admin`, `npo_staff`, `checkin_staff`, `donor`)

---

## 4. Running Critical-Path E2E Tests Locally

```bash
# Install e2e deps (first time)
cd e2e && pnpm install

# Start backend + frontend dev servers in separate terminals
make dev-backend
make dev-frontend

# Seed data
make seed

# Run critical-path suite
make test-critical-path

# Open HTML report
make test-e2e-report
```

See [`e2e/README.md`](../e2e) and
[`.specify/specs/047-integration-testing-beta/quickstart.md`](../.specify/specs/047-integration-testing-beta/quickstart.md)
for full setup.

---

## 5. Manual Pre-Beta Checklist

See [`tests/manual/pre-beta-checklist.md`](../tests/manual/pre-beta-checklist.md) for the
15-item staging checklist covering:

- Real payment sandbox (charge + refund)
- Email deliverability (Gmail, Outlook, Yahoo)
- Apple Pay button (Safari macOS + iOS)
- Google Pay button (Chrome)
- Push notifications (iOS Safari + Android Chrome)
- Social login (Google + Apple)
- PWA install (iOS Add to Home Screen + Android Chrome prompt)

Each item has acceptance criteria and a sign-off table. Print or share it with your QA
reviewer before beta launch.

---

## 6. How the Automated Suite Works

| Layer | When it runs | What it covers |
|---|---|---|
| `critical-path-gate.yml` | Every PR to `main` | 4 backend integration tests — auth, RBAC, checkin, ticket checkout |
| `nightly-regression.yml` | 3 AM UTC nightly (staging) | Full backend test suite + 40 Playwright full-suite specs + mobile Safari |
| `make test-critical-path` | Local / PR gate | 7 Playwright critical-path specs on Chromium |

---

## 7. Known Limitations

- The Playwright E2E suite requires live backend + frontend servers. CI runs them against
  staging; local runs require `make dev-backend` + `make dev-frontend`.
- Social login (Google/Apple) and Apple/Google Pay specs are tagged `@manual` — they
  cannot be automated in CI because they require real OAuth/payment sandbox credentials
  and device interaction.
- Push notification specs require a device with a real browser (no headless support).
- The `MSTEAMS_WEBHOOK_URL` secret is optional — if absent, the Teams notification step
  is skipped silently.
