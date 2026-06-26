# Quickstart: Silent Auction Anti-Sniping Auto-Extension

## Prerequisites
- Backend dependencies installed (`cd backend && poetry install`)
- Admin frontend dependencies installed (`cd frontend/fundrbolt-admin && pnpm install`)
- Database migrations up to date

## 1. Apply Migrations

```bash
cd /home/jjeanes/dev/fundrbolt-platform/backend
poetry run alembic upgrade head
```

## 2. Start Services

```bash
cd /home/jjeanes/dev/fundrbolt-platform
make dev-backend
make dev-frontend
```

## 3. Configure Event-Level Policy
1. Sign in to Admin PWA.
2. Open an event and navigate to silent auction items settings.
3. Confirm defaults: enabled ON, trigger window 3, extension duration 3, max total extension 30.
4. Save a custom configuration (example: duration 5, max total 40).

## 4. Validate Bid-Time Extension Behavior
1. Set a silent auction item near close.
2. Place a valid bid outside the trigger window and verify no extension.
3. Place a valid bid at/within trigger window and verify extension by configured duration.
4. Repeat until max total extension is reached and verify no further extension.

## 5. Validate Edge Cases
- Set max total extension to 0 and verify no extension even when enabled.
- Submit invalid values (duration 0 or 11, max total -1 or 61) and verify validation error.
- Change policy during ongoing bidding and verify only subsequent accepted bids use new values.

## 6. Validate Legacy Event Rollout
- Use an existing event without policy row.
- Place a qualifying bid and verify policy is auto-created with system defaults before evaluation.
