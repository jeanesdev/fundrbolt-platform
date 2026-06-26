# Quickstart: 052-impact-donations

**Goal**: Verify Impact Donations end-to-end in admin and donor surfaces.

## Prerequisites

- Backend and both frontends are running.
- You can sign in as an admin/NPO user and as a donor in the local or deployed environment.

## Manual Validation Steps

1. Open the Admin PWA and navigate to Auction Items for an event.
2. Create a new item using the Impact Donations tab.
3. Set the item category to Impact.
4. Enter the impact statement in the description field.
5. Set buy-now pricing and enable buy now.
6. Save the item and confirm it appears in the Impact Donations tab.
7. Upload at least one image and one video to the item.
8. Publish the item.
9. Open the donor app Win It page.
10. Confirm the item appears mixed with silent auction items.
11. Use the Impact filter to isolate the item.
12. Open the item and confirm it presents as buy-now-only.
13. Attempt a standard bid and confirm it is rejected.
14. Complete a buy-now purchase and confirm the purchase is recorded in donation totals.
15. Confirm uploaded video media is visible in the item experience.

## Recommended Validation Commands

- Backend checks: `cd backend && poetry run ruff check .`
- Backend formatting: `cd backend && poetry run ruff format --check .`
- Backend typing: `cd backend && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests'`
- Backend tests: `cd backend && poetry run pytest -v --tb=short`
- Frontend lint: `cd frontend/fundrbolt-admin && pnpm lint`
- Frontend format: `cd frontend/fundrbolt-admin && pnpm format:check`
- Frontend build: `cd frontend/fundrbolt-admin && pnpm build`
