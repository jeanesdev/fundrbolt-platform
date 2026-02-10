# Quickstart: Donor Bidding UI

## Prerequisites
- Backend dependencies installed via Poetry
- Frontend dependencies installed via pnpm

## Run (Full Stack)
- `make dev-fullstack`

## Run (Backend Only)
- `make dev-backend`

## Run (Donor PWA)
- `cd frontend/donor-pwa && pnpm dev --port 5174`

## Run (Admin PWA)
- `cd frontend/fundrbolt-admin && pnpm dev`

## Tests
- Backend: `make test-backend`
- Frontend (admin): `cd frontend/fundrbolt-admin && pnpm test`
- Frontend (donor): `cd frontend/donor-pwa && pnpm test`
