# Quickstart: Auction Bid Backend

**Date**: 2026-02-02

## Goal
Validate the auction bid backend feature locally after implementation.

## Prerequisites
- Backend dependencies installed via Poetry
- Database available and migrations applied

## Steps

1. Install backend dependencies:
   - `make install-backend`

2. Apply migrations:
   - `make migrate`

3. Run backend tests:
   - `make test-backend`

## Expected Results
- All tests pass.
- Bid placement, proxy bidding, and reporting endpoints respond without errors.
