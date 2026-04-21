# Quickstart: Donate Now Page (041)

**Branch**: `041-donate-now-page`

## Prerequisites

- Docker running (`make docker-up`)
- Backend dependencies installed (`cd backend && poetry install`)
- Frontend deps installed (`cd frontend/donor-pwa && pnpm install` and `cd frontend/fundrbolt-admin && pnpm install`)

## 1. Run Migrations

```bash
# Add NPO slug column
cd backend && poetry run alembic upgrade head
```

Both migrations run in sequence: `043a_add_npo_slug` → `043b_add_donate_now_tables`.

## 2. Seed a Test NPO with Donate Now Configured

```bash
cd backend && poetry run python seed_donate_now_demo.py
# Creates: NPO with slug "demo-npo", 3 donation tiers, donate page enabled
```

## 3. Start Servers

```bash
make dev-fullstack
# Backend: http://localhost:8000
# Admin PWA: http://localhost:5173
# Donor PWA: http://localhost:5174
```

Donor Celery worker (for recurring job testing):
```bash
cd backend && poetry run celery -A app.celery_app worker --beat -l info
```

## 4. View the Donate Now Page

Navigate to: `http://localhost:5174/npo/demo-npo/donate-now`

## 5. Admin Configuration

1. Log in to Admin PWA at `http://localhost:5173`
2. Navigate to **NPOs → [your NPO] → Donate Now**
3. Configure hero, donation tiers, processing fee, and NPO info
4. Toggle **Enable Donate Now Page** and save
5. Refresh the donor page — changes appear immediately

## 6. Test the Donation Flow

1. Open `http://localhost:5174/npo/demo-npo/donate-now` in incognito
2. Tap a donation amount button
3. Optionally check "Make this gift monthly" and set dates
4. Add a support wall message
5. Slide to donate → second confirmation appears
6. Log in or create an account
7. Complete donation → inline success animation shown
8. Scroll to support wall — new entry appears

## 7. Run Tests

```bash
# Backend
cd backend && poetry run pytest app/tests/test_donate_now.py -v

# Frontend (donor PWA)
cd frontend/donor-pwa && pnpm test --run

# Frontend (admin PWA)
cd frontend/fundrbolt-admin && pnpm test --run
```

## API Reference

Full OpenAPI contract: `.specify/specs/041-donate-now-page/contracts/donate-now.yaml`

Interactive docs (backend running): `http://localhost:8000/docs#/Donate Now`

## Key URLs

| URL | Description |
|-----|-------------|
| `GET /api/v1/npos/{slug}/donate-now` | Public page data |
| `POST /api/v1/npos/{slug}/donate-now/donations` | Submit donation |
| `GET /api/v1/npos/{slug}/donate-now/support-wall` | Public wall |
| `PUT /api/v1/admin/npos/{id}/donate-now/config` | Admin config |
| `PUT /api/v1/admin/npos/{id}/donate-now/tiers` | Admin tiers |
| `POST /api/v1/admin/npos/{id}/donate-now/support-wall/{id}/hide` | Admin moderation |
