# Data Model: Admin PWA Mobile & Tablet UI

**Feature**: 032-admin-pwa-mobile
**Date**: 2026-03-04

## Overview

This feature is frontend-only — no database tables, migrations, or backend API changes. The only persistent data is the user's view preference stored in browser localStorage.

## Client-Side Data Model

### View Preference (localStorage)

**Storage key**: `fundrbolt_view_prefs`
**Storage medium**: Browser localStorage
**Scope**: Per-browser, per-origin

**Schema** (JSON object):

| Field | Type | Description |
|-------|------|-------------|
| `[pagePath]` | `"table" \| "card"` | View mode preference for a specific page. Key is the page's route path (e.g., `"/users"`, `"/events/abc123/check-in"`). |

**Example stored value**:
```json
{
  "/users": "card",
  "/events/abc123/check-in": "table",
  "/events/abc123/auction-bids": "card"
}
```

**Behavior rules**:
- If no entry exists for the current page, the default is determined by viewport width: `"card"` when < 1024px, `"table"` when ≥ 1024px.
- When a user explicitly toggles the view, their choice is stored and takes precedence over the viewport-based default on subsequent visits.
- The preference persists across browser sessions (localStorage survives tab/browser close).
- No expiration or TTL — preferences remain until the user clears browser data.

### Sidebar State (existing cookie)

**Storage key**: `sidebar_state` (already exists)
**Storage medium**: Browser cookie (7-day max-age, already implemented)

No changes to the existing sidebar state cookie schema. The sidebar state already persists `true`/`false` for expanded/collapsed. The change is behavioral: the default value on first load depends on the detected breakpoint tier.

**Default behavior by breakpoint**:
| Breakpoint Tier | Default `sidebar_state` | Sidebar Render Mode |
|----------------|------------------------|-------------------|
| Phone (< 768px) | N/A (uses Sheet) | Overlay Sheet |
| Tablet portrait (768–1023px) | N/A (uses Sheet) | Overlay Sheet |
| Tablet landscape (1024–1366px) | `false` (collapsed) | Inline icon-rail |
| Desktop (≥ 1367px) | `true` (expanded) | Inline full-width |

## Breakpoint Tiers

A new hook `useBreakpoint()` provides the current tier. These are the canonical breakpoint values:

| Tier | Min Width | Max Width | Tailwind Class Prefix |
|------|-----------|-----------|----------------------|
| phone | 0 | 767px | (default / `max-sm:`) |
| tablet-portrait | 768px | 1023px | `md:` |
| tablet-landscape | 1024px | 1366px | `lg:` |
| desktop | 1367px | ∞ | `xl:` / `2xl:` |

## Entities Not Affected

The following existing database entities require **no changes**:
- Users, Events, NPOs, Auction Items, Bids, Registrations, Sponsors, Tickets — all unchanged
- No new API endpoints, no backend models, no migrations
