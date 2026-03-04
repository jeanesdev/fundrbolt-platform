# Research: Admin PWA Mobile & Tablet UI

**Feature**: 032-admin-pwa-mobile
**Date**: 2026-03-04

## Decision 1: Multi-Breakpoint Strategy

**Decision**: Introduce a `useBreakpoint()` hook returning the current device tier: `phone | tablet-portrait | tablet-landscape | desktop`. Supplement (not replace) the existing `useIsMobile()` hook to avoid breaking existing consumers.

**Rationale**: The current codebase has a single binary breakpoint at 768px (`useIsMobile`). This feature requires four distinct layout behaviors:
- **Phone** (< 768px): Sheet sidebar, card view default, single-column forms
- **Tablet portrait** (768–1023px): Sheet sidebar, card view default, single-column forms
- **Tablet landscape** (1024–1366px): Icon-rail sidebar (collapsed by default), card view default, two-column forms
- **Desktop** (≥ 1367px): Full sidebar (expanded by default), table view default, multi-column forms

**Alternatives considered**:
- Raise `MOBILE_BREAKPOINT` to 1024px: Would change existing mobile behavior across the app (sidebar, popovers). Too risky with side effects.
- Use CSS-only container queries: Not sufficient for JS conditional rendering (sidebar Sheet vs inline) and localStorage preference defaults.
- Use Tailwind `lg:` breakpoints only: Covers CSS but doesn't provide the JS hook needed for sidebar mode switching and view preference defaults.

## Decision 2: Sidebar Tablet Adaptation Approach

**Decision**: Modify the `Sidebar` component to use a three-way branch: phone/tablet-portrait → Sheet overlay; tablet-landscape → inline with auto-collapsed default; desktop → inline expanded as-is. The CSS class `hidden md:block` on the inline sidebar changes to `hidden lg:block` (1024px) so that tablet portrait also gets the Sheet.

**Rationale**: The existing sidebar already supports both Sheet (mobile) and inline (desktop) modes. The change is minimal:
1. The `useIsMobile()` check in SidebarProvider's `toggleSidebar` and the render branch in `Sidebar` need to also treat tablet-portrait as "mobile-like."
2. On tablet landscape, the sidebar renders inline but defaults `open` to `false` (icon-rail) via an effect that checks the breakpoint on mount.
3. When the user taps a sidebar nav item on tablet landscape, the sidebar expands as an overlay (leveraging the existing `offcanvas` or adding z-index overlay behavior to the `icon` collapsible).

**Alternatives considered**:
- Always use Sheet for all screens < 1367px: Loses the useful icon-rail on tablet landscape, which provides persistent navigation context.
- Keep current 768px split and only add auto-collapse: Tablet portrait (768–1023px) would still get the inline sidebar, which is too large for portrait use.

## Decision 3: Card View Component Architecture

**Decision**: Create a generic `DataTableCardView` component that accepts a TanStack Table instance and renders cards by iterating visible columns. For manual tables (AttendeeListTable, quick-entry tables), create a `DataTableWrapper` pattern with a `renderCard` prop that accepts per-row card JSX.

**Rationale**: Two distinct table patterns exist in the codebase:
1. **TanStack Table** (users-table): Can programmatically iterate `table.getRowModel().rows` and `row.getVisibleCells()`, using `flexRender` to render each cell's JSX. Card labels come from column `meta.title` or the `DataTableColumnHeader`'s `title` prop.
2. **Manual tables** (AttendeeListTable, EventCheckInSection, etc.): No column definitions to iterate. These need a custom `renderCard` function per table that maps row data to card JSX.

The `DataTableWrapper` unifies both patterns:
```
<DataTableWrapper
  viewPreferenceKey="users"
  renderTable={() => <ExistingTable />}
  renderCards={(data) => data.map(item => <Card key={item.id} ... />)}
/>
```

**Alternatives considered**:
- Force all tables to migrate to TanStack Table first: Too large a refactor scope; there are 8 manual tables. Would bloat this feature beyond its spec.
- Build card view only for TanStack Table pages: Leaves 8 out of 12 table views without card support, failing SC-001.
- Generate card templates via code generation: Over-engineering; the card layout per table is simple enough to hand-write as a render function.

## Decision 4: Card Layout — Primary vs. Secondary Fields

**Decision**: Each card shows 3–5 primary fields prominently, with all remaining fields in a collapsible "More" section. Primary fields are chosen per table based on the columns most critical for identification and status (typically: name, key identifier, status badge, date). Actions render as a dropdown menu in the card header/footer.

**Rationale**: The spec clarification (Q2) chose this approach. Per the research:
- AttendeeListTable has 10 columns — showing all vertically would make each card 200px+ tall
- Users table has 6 columns (manageable) but the pattern should be consistent
- Primary fields: the first 3–5 visible columns (excluding select/actions)
- "More" section: remaining columns, rendered in a compact key-value list, toggle via a "Show more" button

**Alternatives considered**: N/A — this was a spec clarification decision (Option B selected).

## Decision 5: View Preference Storage Schema

**Decision**: Store per-page view preferences in localStorage under a single JSON key `fundrbolt_view_prefs`, with page path as sub-key. Example: `{ "/users": "card", "/events/abc/check-in": "table" }`. Default is determined by current breakpoint (card < 1024px, table ≥ 1024px) when no stored preference exists.

**Rationale**: Per the spec clarification (Q1), preferences are per-page. Using a single localStorage key with a JSON object avoids key proliferation and makes it easy to clear all preferences or debug. The page path from TanStack Router is stable and unique.

**Alternatives considered**:
- Separate localStorage keys per page (`view_pref_users`, `view_pref_checkin`): More keys to manage, harder to enumerate.
- Session storage instead of localStorage: Would lose preference on tab close; localStorage survives but is still scoped to the browser.
- Server-side user preference: Spec explicitly says "browser session using local storage" — no backend needed.

## Decision 6: Touch Target Size Implementation

**Decision**: Apply a global CSS utility class via Tailwind that increases minimum touch target sizes on screens < 1366px. Target elements: buttons, links, dropdown menu items, pagination controls, table action buttons. Use `min-h-11 min-w-11` (44px) and add padding where needed.

**Rationale**: FR-009 requires 44×44px minimum targets on screens < 1366px. Rather than modifying every component individually, a combination approach works:
1. Base component overrides in `index.css` using `@media (max-width: 1365px)` to set minimum sizes on `button`, `a[role="button"]`, `[role="menuitem"]` etc.
2. Specific component adjustments where the base override isn't sufficient (e.g., pagination page numbers that are currently 32×32px).

**Alternatives considered**:
- Only fix specific components: Would miss edge cases and require auditing every interactive element.
- Use `@container` queries instead of `@media`: Container queries don't have access to viewport width and would require wrapping every component.

## Decision 7: Quick-Entry Table → Card View

**Decision**: The quick-entry tables (PaddleRaiseEntryForm, BuyNowEntryForm, LiveBidLogAndMetrics) use raw `<table>` HTML with hardcoded `min-w-[640px]`. Replace the table section with a conditional render: on `< 1024px`, render entries as compact horizontal cards (amount prominent, bidder/donor secondary, time/labels as badges). Reuse the same data array and filter/sort state.

**Rationale**: These tables have 5–6 columns and `min-w-[640px]` forces horizontal scroll on tablets. The data is simple enough that a card is a single horizontal bar:
```
┌─────────────────────────────────┐
│ $500  •  Bidder #42  •  2:15 PM │
│ John Smith  [VIP] [Matching]    │
└─────────────────────────────────┘
```

**Alternatives considered**:
- Remove `min-w-[640px]` and let columns compress: Columns become too narrow to read (amount, names get truncated).
- Make columns responsive with `hidden sm:table-cell`: Would hide data that's important for quick-entry workflows.

## Decision 8: Sidebar Overlay Behavior on Tablet Landscape

**Decision**: On tablet landscape (1024–1366px), when the user expands the sidebar from the icon-rail, the sidebar opens as a floating overlay (high z-index, with backdrop) rather than pushing the main content. Clicking outside or navigating dismisses it.

**Rationale**: Per the spec clarification (Q3), overlay was explicitly chosen. At 1024–1366px, pushing content would compress the main area to ~700–1100px minus 256px sidebar = 444–844px, which is too narrow for tables, forms, and dashboards. An overlay preserves the full content width while providing navigation access.

**Implementation approach**: On tablet landscape, when `open` becomes `true`, render the sidebar with `position: fixed` or `position: absolute` plus a semi-transparent backdrop div. The existing `offcanvas` collapsible mode already does something similar (slides sidebar on/off screen), but uses negative `start` positioning. The simpler approach: keep `collapsible='icon'` but add an overlay-mode class when in the tablet-landscape range, which sets `position: fixed` + `z-50` + backdrop.

**Alternatives considered**: Using Sheet component for tablet landscape too — but Sheet replaces the sidebar completely (no icon-rail visible), whereas the goal is to expand from the icon-rail as an overlay.
