# Beta Integration Seed Data

## Usage

```bash
cd backend && poetry run python ../tests/seed/seed.py
cd backend && poetry run python ../tests/seed/seed.py --tenant-slug automation-tenant
```

Or via Makefile from the repo root:

```bash
make seed
```

## Idempotency

The seed is **idempotent** — safe to run any number of times. On first run it creates all
entities and prints `N created, 0 unchanged`. On subsequent runs it prints `0 created, N unchanged`.

Verified output of a second run:

```
legal_documents: 0 created, 2 unchanged
users:           0 created, 5 unchanged
organizations:   0 created, 1 unchanged
events:          0 created, 3 unchanged
tickets:         0 created, 12 unchanged
auction_items:   0 created, 30 unchanged
seating:         0 created, 7 unchanged
sponsors:        0 created, 15 unchanged
```

## What is seeded

| Entity | Count | Details |
|--------|-------|---------|
| Legal documents | 2 | ToS v1.0, Privacy Policy v1.0 |
| Users | 5 | One per role: super_admin, npo_admin, npo_staff, checkin_staff, donor |
| Organizations | 1 | `seed-nonprofit` (approved) |
| Events | 3 | `seed-future-event` (scheduled), `seed-live-event` (active), `seed-past-event` (closed) |
| Ticket packages | 12 | 4 per event: General, VIP, Custom, Promo-eligible |
| Auction items | 30 | 5 silent + 5 live per event |
| Seating / registrations | 7 | Tables + pre-checked-in / unchecked-in registrations |
| Sponsors | 15 | 5 per event (2 gold, 2 silver, 1 bronze) |

## Seed credentials

All automation users have email `automation+{role}@fundrbolt.com` and password from
the `SEED_TEST_PASSWORD` env var (default `TestPassword123!`).

## Required environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL async URL (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis URL |
| `JWT_SECRET_KEY` | ≥32-char JWT secret |
| `EMAIL_BACKEND` | Use `console` or `mailpit` for seed runs |
| `PAYMENT_GATEWAY_BACKEND` | Use `stub` |
