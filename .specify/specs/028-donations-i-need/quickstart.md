# Quickstart: Donation Tracking and Attribution

## 1) Implement database model and migration
1. Add `Donation`, `DonationLabel`, and `DonationLabelAssignment` SQLAlchemy models under backend model layer.
2. Add enum/value support for donation lifecycle (`active`, `voided`).
3. Create Alembic migration for new tables, constraints, indexes, and FK relations.
4. Seed default event labels (`Last Hero`, `Coin Toss`) for event bootstrap flows where appropriate.

## 2) Implement schema layer
1. Add request/response schemas for donation create, update, detail, list filters.
2. Add request/response schemas for donation label create, update, list, retirement.
3. Add explicit validation for amount > 0, label uniqueness per event, and event-scoped assignment checks.

## 3) Implement services
1. Donation service: create, read, list, update, void.
2. Label service: create, read/list, update, retire.
3. Assignment handling in donation service: attach/detach labels with event-scope validation.
4. Enforce role authorization checks at service or endpoint boundary (admin/staff write; reporting read).

## 4) Implement API routes
1. Add event-scoped donation endpoints for CRUD-like lifecycle and filterable listing.
2. Add event-scoped label management endpoints.
3. Ensure DELETE semantics perform void transition, not hard delete.
4. Return clear validation and not-found errors.

## 5) Test and verify
1. Add unit tests for validation and lifecycle behavior.
2. Add integration tests for:
   - Event + donor linkage requirements
   - Multi-label ALL default and ANY toggle behavior
   - Role-based write restrictions
   - Event-label cross-assignment rejection
   - Vood/retention behavior in listing
3. Run backend CI-aligned commands:
   - `cd backend && poetry run ruff check .`
   - `cd backend && poetry run ruff format --check .`
   - `cd backend && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests'`
   - `cd backend && poetry run pytest -v --tb=short`

## 6) Contract verification
1. Ensure implemented routes and payloads match `contracts/donations.openapi.yaml`.
2. Validate default query semantics and error codes against the contract examples.
