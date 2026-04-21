# Research: Donate Now Page (041)

**Date**: 2026-04-20
**Branch**: `041-donate-now-page`

---

## Decision 1: NPO Public URL Structure

**Decision**: `/npo/$npoSlug/donate-now` — the NPO model needs a `slug` field (unique, URL-safe) added via migration.

**Rationale**: The spec describes a per-NPO page. The existing event public URL uses a slug (`/events/$slug`), so slug-based NPO URLs are consistent. The NPO model currently has `name` (unique, String 255) but no dedicated slug field; adding one follows established platform conventions and avoids encoding issues with arbitrary names.

**Alternatives considered**:
- `/npo/$npoId/donate-now` (UUID) — rejected: UUIDs are ugly, not shareable/memorable.
- `/donate/$npoSlug` — rejected: inconsistent with existing `/npo/` prefix already used internally.
- Derive slug dynamically from `name` — rejected: mutable names could break existing links.

---

## Decision 2: Recurring Donation Mechanism

**Decision**: The Deluxe HPF payment integration does not natively expose subscription/recurring billing via its current session + vault token flow. For v1, recurring donations are **implemented as a preference record only** — the platform captures `recurrence_start`, `recurrence_end`, and `amount` alongside a stored vault profile, and a **Celery periodic task** charges the stored profile on the monthly anniversary date.

**Rationale**: Clarification Q1 specified "payment processor manages recurrence" but the existing Deluxe integration uses a Hosted Payment Form / vault token model (not a Stripe Subscriptions-style recurring API). Stripe-style subscription management is not available. The simplest conforming implementation is: use the existing vault profile (`PaymentProfile.gateway_profile_id`) to charge on schedule via Celery (already in the stack with Redis broker). This keeps recurrence logic inside the platform's existing payment abstractions.

**Alternatives considered**:
- Full Stripe integration — rejected: platform uses Deluxe HPF per-NPO merchant accounts, not Stripe.
- Ask payment processor for native subscription endpoint — deferred: unknown if Deluxe gateway supports it; use vault re-charge for now.
- Collect preference only, charge manually — rejected: not a real recurring donation product.

**Implication**: The `Donation` entity needs `recurrence_status` (active/cancelled/completed), and a Celery beat schedule task `process_monthly_donations` must be wired up. This is within feature scope.

---

## Decision 3: Processing Fee Calculation

**Decision**: Processing fee is calculated as `donation_amount × (npo_configured_pct / 100)`, rounded up to the nearest cent. The platform config already has `payment_processing_fee_pct = 0.029` as a default, but the NPO-level configurable rate (spec FR-030) is stored on `DonateNowPageConfig`. Both flat-fee and percentage components exist in the platform config but for simplicity the donate-now page exposes a single percentage-only configurable rate to admins (the flat $0.30 component is not exposed).

**Rationale**: The spec says "configurable processing fee percentage." Complex per-transaction cost math (percentage + flat fee) is implementation detail better left opaque. A single admin-facing percentage is sufficient for the use case described.

---

## Decision 4: Hero Component Reuse

**Decision**: Reuse `EventHeroSection` from the donor-pwa with an adapter wrapper `NPODonateHeroSection`. The existing component accepts banner images and a `HeroTransitionStyle` (`documentary_style | fade | swipe | simple`). The donate-now page config will expose these same 4 transition options.

**Rationale**: `EventHeroSection` is the canonical hero implementation. Duplicating it would diverge from established UX patterns. Since NPO branding (via `NPOBranding`) already stores media, the hero configuration only needs a pointer to selected media + transition style.

---

## Decision 5: Slide-to-Donate Component Reuse

**Decision**: Reuse `BidConfirmSlide` (the swipe-to-confirm component) and build a new `DonationAmountSelector` based on `BidSliderModal` adapted for donation amounts (arbitrary dollar amounts rather than auction bid increments). The existing `BidSliderModal` is auction-specific (min bid, increments, tick marks per step); the donation version needs free-form dollar entry + preset buttons, so it is a new component sharing the same UI/slider primitives.

**Rationale**: `BidConfirmSlide` is a generic slide-to-confirm; it can accept any label. The amount selection flow is different (preset + custom, not bid-increment steps), warranting a dedicated component to avoid polluting the auction component with donations logic.

---

## Decision 6: Auth Gate Pattern

**Decision**: The donate-now page is a **new public route** `frontend/donor-pwa/src/routes/npo.$slug.donate-now.tsx`. It follows the same pattern as `events.$slug.index.tsx`: publicly accessible, checks `useAuthStore` + `hasValidRefreshToken()` silently on load, conditionally shows the auth prompt only when the donor attempts to confirm a donation and is not authenticated. Already-authenticated donors skip the prompt (Clarification Q3).

**Rationale**: Matches established platform patterns exactly. No new auth mechanism needed.

---

## Decision 7: Support Wall Entry Visibility

**Decision**: All entries are visible by default (`hidden = false`). Admin hide action sets `hidden = true`; restore sets it back. The donor-facing page filters to `hidden = false AND donation.status = 'captured'`. Auto-cycling uses a 5-second interval per page via `setInterval` capped at page 3, then stops (user must paginate manually to go further).

---

## Decision 8: Migration Numbering

**Decision**: Use `043_` prefix (next in the sequential integer sequence after `042_add_auctioneer_role_and_tables.py`). Two migrations:
- `043a_add_npo_slug.py` — adds `slug` column to `npos` table, backfills from `name`, adds UNIQUE constraint.
- `043b_add_donate_now_tables.py` — adds `donate_now_page_configs`, `donation_tiers`, `donations`, `support_wall_entries` tables.

---

## Key File Locations (discovered)

| Concern | Location |
|---|---|
| Payment HPF session | `backend/app/api/v1/payments.py` |
| Payment gateway abstraction | `backend/app/core/payment_deps.py` |
| Deluxe gateway service | `backend/app/services/payment_gateway/deluxe_gateway.py` |
| NPO model | `backend/app/models/npo.py` |
| PaymentProfile model | `backend/app/models/payment_profile.py` |
| PaymentTransaction model | `backend/app/models/payment_transaction.py` |
| Hero component | `frontend/donor-pwa/src/components/event-home/EventHeroSection.tsx` |
| Bid amount selector | `frontend/donor-pwa/src/components/auction/BidSliderModal.tsx` |
| Slide-to-confirm | `frontend/donor-pwa/src/components/auction/BidConfirmSlide.tsx` |
| Event public route | `frontend/donor-pwa/src/routes/events.$slug.index.tsx` |
| Donor event home | `frontend/donor-pwa/src/features/events/EventHomePage.tsx` |
| Auth store | `frontend/donor-pwa/src/stores/auth` (via `useAuthStore`) |
