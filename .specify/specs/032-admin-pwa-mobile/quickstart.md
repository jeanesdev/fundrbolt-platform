# Quickstart: Admin PWA Mobile & Tablet UI

**Feature**: 032-admin-pwa-mobile
**Date**: 2026-03-04

## What This Feature Does

Makes the admin PWA usable on tablets (primarily iPads) by:
1. Adding a table/card view toggle to all 12 data table pages
2. Making the sidebar collapse to an icon rail on tablet landscape and use overlay on tablet portrait
3. Increasing touch target sizes to 44×44px on tablet/mobile viewports
4. Ensuring forms, dashboards, and quick-entry interfaces reflow responsively

## Prerequisites

- Node 22 (via nvm)
- pnpm installed
- Frontend dev server: `cd frontend/fundrbolt-admin && pnpm dev`

## Key Files to Understand

| File | Purpose |
|------|---------|
| `src/hooks/use-breakpoint.ts` | **NEW** — Multi-tier breakpoint hook (phone/tablet-portrait/tablet-landscape/desktop) |
| `src/hooks/use-view-preference.ts` | **NEW** — Per-page table/card preference hook (localStorage) |
| `src/components/data-table/card-view.tsx` | **NEW** — Generic card renderer for TanStack Table data |
| `src/components/data-table/view-toggle.tsx` | **NEW** — Table/Card toggle button group |
| `src/components/data-table/data-table-wrapper.tsx` | **NEW** — Wrapper combining table + card view with toggle |
| `src/components/ui/sidebar.tsx` | **MODIFIED** — Tablet breakpoint support for overlay/rail behavior |
| `src/hooks/use-mobile.tsx` | **EXISTING** — 768px hook, unchanged but supplemented by use-breakpoint |

## How to Test

### Card View Toggle
1. Open the app at `http://localhost:5173`
2. Log in with an admin account
3. Navigate to Users (`/users`) or any event's Check-In page
4. Resize browser to < 1024px width (or use Chrome DevTools device toolbar with iPad preset)
5. Verify the view toggle appears and defaults to card view
6. Toggle between table and card view; verify preference persists across navigation

### Sidebar Behavior
1. At desktop width (≥ 1367px): Sidebar is expanded by default (unchanged)
2. At tablet landscape width (1024–1366px): Sidebar should show icon-rail only; clicking expands as overlay
3. At tablet portrait width (768–1023px): Sidebar hidden; hamburger button opens it as a Sheet overlay
4. At phone width (< 768px): Same as tablet portrait (Sheet overlay)

### Touch Targets
1. Use Chrome DevTools → toggle device toolbar → select iPad
2. Navigate through the app tapping buttons, dropdown menus, pagination controls
3. All interactive elements should have minimum 44×44px touch areas

## Breakpoint Reference

| Tier | Width Range | Sidebar | Default View | Form Columns |
|------|-------------|---------|-------------|--------------|
| Phone | < 768px | Sheet overlay | Card | 1 |
| Tablet portrait | 768–1023px | Sheet overlay | Card | 1 |
| Tablet landscape | 1024–1366px | Icon rail (overlay on expand) | Card | 2 |
| Desktop | ≥ 1367px | Full expanded | Table | Multi |

## No Backend Changes

This feature is entirely frontend. No database migrations, no new API endpoints, no backend service changes.
