# Research: Event Dashboard for Admin PWA

## Decision 1: Visualization library
- **Decision**: Use Recharts for all charts and gauges.
- **Rationale**: Recharts is already a dependency in the Admin PWA and used in existing dashboard components, minimizing new libraries and ensuring consistent styling.
- **Alternatives considered**: Chart.js, ECharts, Nivo (rejected to avoid new dependencies and inconsistent charting patterns).

## Decision 2: Data fetching and refresh
- **Decision**: Use React Query for data fetching with a 60-second auto-refresh and manual refresh trigger.
- **Rationale**: React Query is already in use and provides predictable caching and refetch controls aligned with the 60-second refresh requirement.
- **Alternatives considered**: Custom polling with local state (rejected due to duplication and increased maintenance).

## Decision 3: Dashboard API shape
- **Decision**: Provide a primary dashboard aggregation endpoint plus targeted endpoints for projections and segment drilldowns.
- **Rationale**: Aggregated responses reduce frontend coordination while keeping projection updates and segment lists modular for focused updates.
- **Alternatives considered**: Multiple granular endpoints for each widget (rejected due to increased request overhead and UI orchestration complexity).

## Decision 4: Projection sharing model
- **Decision**: Store projection adjustments at the event level, shared across admins.
- **Rationale**: Matches clarified requirement and enables consistent planning across the admin team.
- **Alternatives considered**: Per-user projections (rejected due to misalignment with shared planning workflows).
