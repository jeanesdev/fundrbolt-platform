# Implementation Plan: 046 — Production Beta Deployment

**Branch**: `046-beta-deployment` | **Date**: 2026-05-11 | **Spec**: `spec.md`
**Input**: Feature specification from `/specs/046-beta-deployment/spec.md`

## Summary

Deploy all three FundrBolt apps (Admin PWA, Donor PWA, Landing Site) and the Python backend (API + Celery worker + Celery beat) to a single Azure production environment that is publicly accessible, auto-deploys on merge, scales to zero when idle, captures errors via Sentry, and sends email alerts for outages — all within a ~$20–45/month budget for beta scale.

The key architectural shift from the existing Bicep templates is replacing **Azure App Service + App Service Plan** (which does not scale to zero) with **Azure Container Apps** for the backend workloads. The three frontend apps continue to use **Azure Static Web Apps Free tier**.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.x / Node 22 (frontends)
**Primary Dependencies**: FastAPI 0.120, SQLAlchemy 2.0, Celery 5.x, python-socketio (backend); React 19, Vite 7, TanStack Router (frontends)
**Storage**: Azure Database for PostgreSQL Flexible Server (primary), Azure Cache for Redis (sessions/broker), Azure Blob Storage (media)
**Testing**: pytest (backend), Vitest (frontends)
**Target Platform**: Azure Container Apps (backend), Azure Static Web Apps Free (frontends)
**Performance Goals**: <5s warm page load (SC-001); <60s cold-start accepted; <15min deployment pipeline (SC-002)
**Constraints**: Scale to zero required (FR-015); total cost ≤$45/month at beta scale (SC-005)
**Scale/Scope**: <100 concurrent users, <1,000 DAU for beta

## Architecture Decision: Container Apps vs App Service

The existing Bicep uses App Service (Basic B1/Standard S1). These tiers cost $13–75/month when idle and do not scale to zero. FR-015 requires scale-to-zero. Azure Container Apps is the correct replacement:

| Concern | App Service | Container Apps |
|---------|------------|---------------|
| Scale to zero | ❌ | ✅ |
| Cost at zero traffic | $13–75/month | ~$0/month |
| Cold start | N/A | 10–60s accepted |
| Celery worker | Manual slots workaround | Native second container app |
| Celery beat singleton | Not supported natively | `maxReplicas: 1` |
| Socket.IO sticky sessions | `clientAffinityEnabled` | Sticky session policy |

**Decision**: Replace `app-service.bicep` + `app-service-plan.bicep` with two new modules: `container-apps-env.bicep` and `container-app.bicep`.

## Architecture: Service Topology

```
Internet
  │
  ├─► fundrbolt.com  ──────────────────────────► Static Web App (landing-site)
  ├─► app.fundrbolt.com ──────────────────────► Static Web App (Admin PWA)
  ├─► give.fundrbolt.com ─────────────────────► Static Web App (Donor PWA)
  └─► api.fundrbolt.com ──────────────────────► Container Apps Environment
                                                    ├── api (min 0, max 3)
                                                    │     CMD: uvicorn app.main:app
                                                    ├── worker (min 0, max 2)
                                                    │     CMD: celery -A app.celery_app worker
                                                    └── beat (min 1, max 1)
                                                          CMD: celery -A app.celery_app beat

Container Apps Environment ←→ Log Analytics Workspace (Azure Monitor)
API container app ←→ Application Insights (via APPLICATIONINSIGHTS_CONNECTION_STRING env var)
```

## Docker Strategy

Single Docker image for all three backend services. Runtime role (api / worker / beat) is determined by the `command` override on each Container App — no separate Dockerfiles needed.

**Key build requirements:**
- Multi-stage: `builder` stage (Poetry install) → `runtime` stage (copy virtualenv only)
- System packages: `weasyprint` requires `libpango-1.0-0`, `libpangocairo-1.0-0`, `libgdk-pixbuf2.0-0`, `libcairo2`, `libffi-dev`
- `python-magic` requires `libmagic1`
- Non-root user (`appuser`) for security
- Image published to GitHub Container Registry (`ghcr.io/[owner]/fundrbolt-backend`)

## Error Tracking: Sentry

Sentry free tier (5,000 errors/month) is sufficient for beta. Integration points:
- **Backend**: `sentry-sdk[fastapi]` — init in `app/main.py` before app creation
- **Admin PWA** + **Donor PWA** + **Landing Site**: `@sentry/react` with Vite plugin for source map upload; init in `main.tsx`
- DSN stored as secret in Azure Key Vault (backend) / GitHub Secrets (frontend build time `VITE_SENTRY_DSN`)

## Uptime Monitoring

UptimeRobot free tier monitors all four public URLs at 5-minute intervals and sends email alerts. This is a manual one-time setup (no IaC).

## Project Structure: Files to Create / Modify

### New Files
```
backend/
└── Dockerfile                                    # Multi-stage production image

infrastructure/bicep/modules/
├── container-apps-env.bicep                      # Container Apps Environment + Log Analytics link
└── container-app.bicep                           # Reusable Container App module (api/worker/beat)

infrastructure/bicep/
└── main-beta.bicep                               # Production-only orchestration (Container Apps)

infrastructure/bicep/parameters/
└── production-beta.bicepparam                    # Production parameters for beta

.github/workflows/
└── landing-site-deploy.yml                       # New workflow for landing site

infrastructure/scripts/
└── deploy-container-apps.sh                      # Helper: update container app image tag
```

### Modified Files
```
.github/workflows/backend-deploy.yml              # Add deploy-production job (Container Apps)
.github/workflows/frontend-deploy.yml             # Add deploy-production job
.github/workflows/donor-pwa-deploy.yml            # Add deploy-production job

backend/pyproject.toml                            # Add sentry-sdk[fastapi]
backend/app/main.py                               # Initialize Sentry

frontend/fundrbolt-admin/package.json             # Add @sentry/react, @sentry/vite-plugin
frontend/fundrbolt-admin/src/main.tsx             # Initialize Sentry
frontend/fundrbolt-admin/vite.config.ts           # Add Sentry Vite plugin

frontend/donor-pwa/package.json                   # Add @sentry/react, @sentry/vite-plugin
frontend/donor-pwa/src/main.tsx                   # Initialize Sentry
frontend/donor-pwa/vite.config.ts                 # Add Sentry Vite plugin

frontend/landing-site/package.json                # Add @sentry/react, @sentry/vite-plugin
frontend/landing-site/src/main.tsx                # Initialize Sentry
frontend/landing-site/vite.config.ts              # Add Sentry Vite plugin
```

## Cost Estimate (Production Only)

| Service | SKU | Est. Monthly |
|---------|-----|-------------|
| Azure Container Apps (API + worker + beat) | Consumption, scale-to-zero | $0–8 |
| Azure PostgreSQL Flexible Server | Burstable B1ms | $12–15 |
| Azure Cache for Redis | Basic C0 | $16–18 |
| Azure Static Web Apps × 3 | Free | $0 |
| Azure Blob Storage | LRS, <10 GB | $1–2 |
| Azure Monitor / Log Analytics | 5 GB/month free | $0 |
| Application Insights | 5 GB/month free | $0 |
| Sentry | Free (5k errors/month) | $0 |
| UptimeRobot | Free (50 monitors) | $0 |
| **Total** | | **~$29–43/month** |

Within SC-005 ($45/month) budget. ✅

## Deployment Pipeline (per component)

### Backend (path: `backend/**`)
1. Build multi-stage Docker image, push to GHCR with `sha`-prefixed tag
2. Run Alembic migrations via Container Apps Job
3. Update `api`, `worker`, `beat` container apps to new image tag

### Admin PWA (path: `frontend/fundrbolt-admin/**`)
1. `pnpm build` with `VITE_API_URL=https://api.fundrbolt.com`
2. Deploy to Azure Static Web Apps production slot

### Donor PWA (path: `frontend/donor-pwa/**`)
1. `pnpm build`
2. Deploy to Azure Static Web Apps production slot

### Landing Site (path: `frontend/landing-site/**`)
1. `pnpm build`
2. Deploy to Azure Static Web Apps production slot

## Secrets Strategy

All production secrets stored in Azure Key Vault, injected into Container Apps as environment variables via Key Vault references. Container App managed identity has `Key Vault Secrets User` role.

| Secret Name | Used By | How Injected |
|-------------|---------|--------------|
| `DATABASE-URL` | api, worker, beat | Key Vault reference |
| `REDIS-URL` | api, worker, beat | Key Vault reference |
| `SECRET-KEY` | api | Key Vault reference |
| `AZURE-STORAGE-ACCOUNT-KEY` | api | Key Vault reference |
| `AZURE-COMMUNICATION-CONNECTION-STRING` | api | Key Vault reference |
| `SENTRY-DSN` | api, worker, beat | Key Vault reference |
| `VITE_SENTRY_DSN` | frontends (build time) | GitHub Secret |

## Migration Execution Strategy

Alembic migrations run as a one-shot Container Apps Job before the API container is updated, satisfying FR-006.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New `main-beta.bicep` alongside existing `main.bicep` | FR-018 (production only); existing main.bicep targets dev/staging/prod App Service | Modifying existing main.bicep risks breaking current dev tooling; separate file is safer |
| Three separate Container Apps for api/worker/beat | FR-008 (version sync) + FR-009 (beat singleton) | Single container app cannot run multiple processes reliably with proper lifecycle management |
