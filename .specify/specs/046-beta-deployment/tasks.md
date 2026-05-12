# Tasks: 046 — Production Beta Deployment

**Input**: `plan.md`, `spec.md`
**Prerequisites**: plan.md ✅, spec.md ✅

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel with other [P] tasks in the same phase
- **[Story]**: User story this enables (US1–US5)

---

## Phase 1: Docker Image (Blocks All Backend Work)

**Purpose**: Produce a single publishable container image for the backend.
**Unblocks**: All Container Apps IaC tasks, all CI/CD backend tasks.

- [ ] T001 [US1,US2] Create `backend/Dockerfile` — multi-stage (builder → runtime), Poetry deps, weasyprint/libmagic system libs, non-root user, CMD: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- [ ] T002 [P] [US2] Add `.dockerignore` at `backend/.dockerignore` to exclude tests, __pycache__, .venv, htmlcov
- [ ] T003 [P] [US3] Add `sentry-sdk[fastapi]` to `backend/pyproject.toml` via `poetry add`
- [ ] T004 [US3] Initialize Sentry in `backend/app/main.py` — call `sentry_sdk.init()` with `integrations=[StarletteIntegration(), FastApiIntegration()]`, `traces_sample_rate=0.1`, read DSN from `settings.sentry_dsn`
- [ ] T005 [P] [US3] Add `sentry_dsn: str = ""` field to `backend/app/core/config.py` Settings model

**Checkpoint**: `docker build -t fundrbolt-backend ./backend` succeeds locally.

---

## Phase 2: Container Apps Infrastructure (Bicep)

**Purpose**: Define all Azure resources needed for production.
**Prerequisite**: Phase 1 (image must exist to validate resource definitions are correct).

- [ ] T010 [P] [US1] Create `infrastructure/bicep/modules/container-apps-env.bicep` — Container Apps Environment with Log Analytics workspace integration, zone redundancy disabled, internal-only ingress disabled
- [ ] T011 [P] [US1] Create `infrastructure/bicep/modules/container-app.bicep` — parameterized Container App module accepting: name, image, command, minReplicas, maxReplicas, env vars, Key Vault refs, ingress config (external/internal), sticky sessions flag
- [ ] T012 [US1] Create `infrastructure/bicep/main-beta.bicep` — production orchestration wiring together: resourceGroup, logAnalytics, appInsights, database, redis, storage, keyVault, containerAppsEnv, containerApp×3 (api/worker/beat), staticWebApp×3, dnsZone, communicationServices, budget
- [ ] T013 [P] [US1] Create `infrastructure/bicep/parameters/production-beta.bicepparam` — production parameters: Container Apps image ref, resource sizes, alert emails, custom domain, monthly budget $50

**Checkpoint**: `az bicep build --file infrastructure/bicep/main-beta.bicep` succeeds with no errors.

---

## Phase 3: CI/CD Workflows

**Purpose**: Automate deploy-to-production for each component on merge.
**Prerequisite**: Phase 1 (Dockerfile), Phase 2 (Bicep defines resource names referenced in workflows).

- [ ] T020 [US2] Update `.github/workflows/backend-deploy.yml` — add `deploy-production` job after `build-and-push`: Azure Login → run migrations (Container Apps Job) → `az containerapp update` for api, worker, beat with new image tag. Remove dev/staging deploy jobs (FR-018: production only).
- [ ] T021 [P] [US2] Update `.github/workflows/frontend-deploy.yml` — add `deploy-production` job: build with `VITE_API_URL=https://api.fundrbolt.com` and `VITE_SENTRY_DSN=${{ secrets.VITE_SENTRY_DSN_ADMIN }}`, deploy to production Azure Static Web Apps slot. Remove dev/staging jobs.
- [ ] T022 [P] [US2] Update `.github/workflows/donor-pwa-deploy.yml` — add `deploy-production` job: build with production API URL and Sentry DSN, deploy to production Static Web Apps slot. Remove dev/staging jobs.
- [ ] T023 [P] [US2] Create `.github/workflows/landing-site-deploy.yml` — path trigger `frontend/landing-site/**`, build + deploy to Azure Static Web Apps (landing site resource).
- [ ] T024 [P] [US2] Create `infrastructure/scripts/deploy-container-apps.sh` — helper script: `az containerapp update --name $APP --image $IMAGE` for all three container apps; used by CI/CD and for manual hotfixes.

**Checkpoint**: Pushing a commit to main with a backend change triggers the workflow and the `deploy-production` job runs (even if it fails due to missing secrets — that's expected until production infra is provisioned).

---

## Phase 4: Frontend Error Tracking (Sentry)

**Purpose**: Capture unhandled frontend errors per FR-011.
**Prerequisite**: None (independent of backend and infrastructure).

- [ ] T030 [P] [US3] Install `@sentry/react @sentry/vite-plugin` in `frontend/fundrbolt-admin`: `pnpm add @sentry/react @sentry/vite-plugin`
- [ ] T031 [P] [US3] Initialize Sentry in `frontend/fundrbolt-admin/src/main.tsx` — `Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, integrations: [Sentry.browserTracingIntegration()], tracesSampleRate: 0.1, environment: import.meta.env.VITE_ENVIRONMENT })`; only init when DSN is set
- [ ] T032 [P] [US3] Add Sentry Vite plugin to `frontend/fundrbolt-admin/vite.config.ts` — upload source maps on build when `SENTRY_AUTH_TOKEN` is set
- [ ] T033 [P] [US3] Install `@sentry/react @sentry/vite-plugin` in `frontend/donor-pwa`
- [ ] T034 [P] [US3] Initialize Sentry in `frontend/donor-pwa/src/main.tsx`
- [ ] T035 [P] [US3] Add Sentry Vite plugin to `frontend/donor-pwa/vite.config.ts`
- [ ] T036 [P] [US3] Install `@sentry/react @sentry/vite-plugin` in `frontend/landing-site`
- [ ] T037 [P] [US3] Initialize Sentry in `frontend/landing-site/src/main.tsx` (if exists; else index.tsx / App entry)
- [ ] T038 [P] [US3] Add Sentry Vite plugin to `frontend/landing-site/vite.config.ts`

**Checkpoint**: `pnpm build` in each frontend succeeds. When `VITE_SENTRY_DSN` is empty/unset Sentry init is skipped (no build error, no runtime console error).

---

## Phase 5: Donor Static Web App Bicep Module

**Purpose**: The `donor-static-web-app.bicep` module exists but is not wired into `main-beta.bicep`. Ensure all three Static Web App resources are defined.

- [ ] T040 [P] [US1] Verify `infrastructure/bicep/modules/donor-static-web-app.bicep` covers all needed params; add any missing outputs (deployment token output required by CI/CD)
- [ ] T041 [P] [US1] Add `landing-static-web-app.bicep` module (or reuse `static-web-app.bicep` with a `landingWebApp` instance in `main-beta.bicep`) for the landing site Static Web App resource

**Checkpoint**: All three Static Web App Bicep resource definitions validate and output deployment tokens.

---

## Summary: FR Coverage

| FR | Task(s) | Status |
|----|---------|--------|
| FR-001 Public access | T010–T013, T020–T023 | Planned |
| FR-002 HTTPS redirect | T010 (Container Apps ingress defaults HTTPS) | Planned |
| FR-003 Custom subdomains | T012 (DNS zone + CNAME records) | Planned |
| FR-004 Stable API endpoint | T010–T013 | Planned |
| FR-005 Path-filtered auto-deploy | T020–T023 (paths: filters) | Planned |
| FR-006 Migrations before deploy | T020 (migration job step) | Planned |
| FR-007 Rollback on failure | T020 (Container Apps revision rollback) | Planned |
| FR-008 Version sync | T020 (all 3 apps updated same SHA) | Planned |
| FR-009 Beat singleton | T011 (maxReplicas=1 for beat) | Planned |
| FR-010 Backend error tracking | T003–T005 | Planned |
| FR-011 Frontend error tracking | T030–T038 | Planned |
| FR-012 Uptime alert | Manual (UptimeRobot) — documented in checklist | Manual |
| FR-013 Metrics dashboard | Azure Monitor (built-in Container Apps) | Built-in |
| FR-014 Searchable logs | Log Analytics (built-in via T010) | Built-in |
| FR-015 Scale to zero | T010–T011 (minReplicas=0) | Planned |
| FR-016 Secrets in KV | T011–T012 (Key Vault refs) | Planned |
| FR-017 Health check endpoint | Already exists (`/health`) | Done |
| FR-018 Production only | T020–T023 (remove dev/staging jobs) | Planned |
