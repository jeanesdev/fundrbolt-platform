# Implementation Plan: PWA Capabilities

**Branch**: `032-pwa-capabilities` | **Date**: 2026-03-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/032-pwa-capabilities/spec.md`

## Summary

Transform both the Admin PWA and Donor PWA from basic single-page applications into true Progressive Web Apps. This adds `vite-plugin-pwa` (powered by Workbox) to both Vite configurations, enabling service worker registration, app shell precaching, runtime caching (cache-first for images, network-first for API data), a branded offline fallback page, an install-to-home-screen prompt banner, an app update notification, and proper PWA manifest/icon assets. No backend changes are required — this is a frontend-only feature.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18+
**Primary Dependencies**: `vite-plugin-pwa` (Workbox-based SW generation), `virtual:pwa-register/react` (React hooks for SW lifecycle)
**Storage**: N/A (client-side CacheStorage managed by Workbox; `localStorage` for install prompt dismissal tracking)
**Testing**: Vitest (unit tests for hooks/components), Playwright (E2E PWA verification)
**Target Platform**: Web (PWA) — Chrome 80+, Safari 14+, Firefox 80+, Edge 80+, iOS 14+, Android Chrome
**Project Type**: Web — two frontend apps (donor-pwa, fundrbolt-admin), no backend changes
**Performance Goals**: App shell renders in <1 second on repeat load over Slow 3G; cached images load in <200 ms
**Constraints**: Image cache ≤ 50 MB, API cache ≤ 10 MB (LRU eviction); 24-hour auto-update timeout; offline = read-only
**Scale/Scope**: 2 apps, ~100 auction items per event, ~6 new components (shared where possible), ~4 modified config files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| YAGNI — only specified requirements | ✅ Pass | Feature is explicitly requested in spec; matches DEMO_READINESS_ANALYSIS item #7 |
| Type safety — TypeScript strict | ✅ Pass | All new code will be TypeScript with strict mode; `vite-plugin-pwa` has full TS types |
| Testing — 80%+ coverage | ✅ Pass | Unit tests for hooks (useInstallPrompt, useServiceWorker, useOnlineStatus), component tests for UI elements |
| Security — no PII in caches | ✅ Pass | Clarification confirmed: caches persist across logout; network-first for API data ensures freshness; no PII stored |
| Offline support — PWA caching | ✅ Pass | Constitution explicitly lists service workers for PWA caching in tech stack |
| Permissive licenses | ✅ Pass | `vite-plugin-pwa` is MIT; Workbox is MIT |
| Mobile-first responsive | ✅ Pass | Install prompt and offline UI designed mobile-first per spec |
| No backend changes | ✅ Pass | Purely frontend; no new API endpoints, models, or migrations |
| Conventional commits | ✅ Pass | Will follow existing commit conventions |

No violations — Complexity Tracking section not needed.

## Project Structure

### Documentation (this feature)

```
specs/032-pwa-capabilities/
├── plan.md              # This file
├── research.md          # Phase 0 — vite-plugin-pwa patterns, Workbox strategies, iOS quirks
├── data-model.md        # Phase 1 — key entities and cache structure
├── quickstart.md        # Phase 1 — step-by-step setup guide
├── contracts/           # Phase 1 — component and hook interfaces
│   ├── pwa-config.ts            # VitePWA plugin configuration type
│   ├── service-worker-hooks.ts  # useRegisterSW / useOnlineStatus hook contracts
│   └── pwa-components.ts        # InstallPrompt, UpdateNotification, OfflineFallback contracts
└── tasks.md             # Phase 2 output (created by /speckit.tasks — NOT this command)
```

### Source Code (repository root)

```
frontend/
├── donor-pwa/
│   ├── vite.config.ts                          # Modified — add VitePWA plugin
│   ├── index.html                              # Modified — apple-touch meta tags, icon links
│   ├── public/
│   │   ├── manifest.json                       # REMOVED — managed by vite-plugin-pwa
│   │   ├── offline.html                        # New — branded offline fallback page
│   │   └── images/
│   │       ├── pwa-192x192.png                 # New — PWA icon
│   │       ├── pwa-512x512.png                 # New — PWA icon
│   │       └── pwa-maskable-512x512.png        # New — maskable PWA icon
│   └── src/
│       ├── main.tsx                            # Modified — register SW
│       ├── hooks/                              # Imports shared hooks from @fundrbolt/shared/pwa
│       └── components/
│           ├── pwa/
│           │   ├── install-prompt-banner.tsx    # New — re-exports shared with donor config
│           │   ├── update-notification.tsx      # New — re-exports shared with donor config
│           │   ├── offline-status-bar.tsx       # New — persistent offline indicator (donor-only)
│           │   └── stale-data-indicator.tsx     # New — stale cache indicator (donor-only)
│           └── event-home/
│               └── [existing components]       # Modified — disable bid/buy-now when offline (AuctionItemCard.tsx, AuctionItemDetailModal.tsx)
├── fundrbolt-admin/
│   ├── vite.config.ts                          # Modified — add VitePWA plugin
│   ├── index.html                              # Modified — apple-touch meta tags
│   ├── public/
│   │   ├── manifest.json                       # REMOVED — managed by vite-plugin-pwa
│   │   ├── offline.html                        # New — admin-specific offline fallback
│   │   └── images/
│   │       ├── pwa-192x192.png                 # New — PWA icon
│   │       ├── pwa-512x512.png                 # New — PWA icon
│   │       └── pwa-maskable-512x512.png        # New — maskable PWA icon
│   └── src/
│       ├── main.tsx                            # Modified — register SW
│       └── components/
│           └── pwa/
│               ├── install-prompt-banner.tsx    # New — install CTA (re-exports shared)
│               └── update-notification.tsx      # New — update prompt (re-exports shared)
└── shared/
    └── src/
        └── pwa/                                # New — shared PWA utilities
            ├── constants.ts                    # New — cache names, size limits, cooldown durations
            ├── use-install-prompt.ts           # New — beforeinstallprompt hook (parameterized by appId)
            ├── use-service-worker.ts           # New — SW lifecycle hook wrapping useRegisterSW
            ├── use-online-status.ts            # New — navigator.onLine + online/offline events
            ├── install-prompt-banner.tsx        # New — shared install banner component
            └── update-notification.tsx          # New — shared update notification component
```

**Structure Decision**: Uses the existing monorepo web application structure. Shared PWA hooks (`useInstallPrompt`, `useServiceWorker`, `useOnlineStatus`) and shared components (`InstallPromptBanner`, `UpdateNotification`) live in `frontend/shared/src/pwa/` to eliminate duplication between apps. Donor-only components (`OfflineStatusBar`, `StaleDataIndicator`) remain in `frontend/donor-pwa/src/components/pwa/`. Shared constants (cache limits, cooldown durations) go in `frontend/shared/src/pwa/constants.ts`. No backend changes.

## Complexity Tracking

*No constitution violations — this section is intentionally empty.*
