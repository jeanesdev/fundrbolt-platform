# Research: PWA Capabilities

**Feature**: 032-pwa-capabilities | **Date**: 2026-03-05 | **Phase**: 0

## 1. vite-plugin-pwa — Configuration & Integration

### What It Is
`vite-plugin-pwa` is the standard Vite plugin for adding PWA capabilities to Vite-based applications. It wraps Google's Workbox under the hood and handles:
- Service worker generation (via `workbox-build` or custom SW)
- Web app manifest generation from config (replaces static `manifest.json`)
- Precache manifest injection (app shell assets)
- Dev-mode service worker support for testing

### Key Configuration Options

```ts
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'prompt',          // 'prompt' = user-controlled updates (FR-011)
  includeAssets: ['favicon.ico', 'images/*.png', 'offline.html'],
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    navigateFallback: '/offline.html',      // FR-005: offline fallback
    navigateFallbackDenylist: [/^\/api/],    // Don't fallback API routes
    runtimeCaching: [/* see Section 2 */],
  },
  manifest: {
    name: 'FundrBolt Donor Portal',
    short_name: 'FundrBolt',
    // ... full manifest config replaces manifest.json
  },
})
```

### registerType Options
- `'autoUpdate'` — New SW activates immediately, might cause mid-session UI breaks. **Not suitable** — spec requires user prompt (FR-011).
- `'prompt'` — New SW waits; app decides when to activate via `updateSW()`. **Best fit** — matches "new version available" notification flow.

### React Integration
The plugin provides a virtual module `virtual:pwa-register/react`:

```ts
import { useRegisterSW } from 'virtual:pwa-register/react'

const { needRefresh, updateServiceWorker, offlineReady } = useRegisterSW({
  onRegisteredSW(swUrl, registration) {
    // Periodic update checks
  },
  onRegisterError(error) {
    console.error('SW registration failed:', error)
  },
})
```

- `needRefresh` — reactive boolean, true when new SW is waiting
- `offlineReady` — reactive boolean, true when precache is complete
- `updateServiceWorker(reloadPage?: boolean)` — activates waiting SW

### Manifest Generation
When `manifest` is provided in config, the plugin:
1. Generates `manifest.webmanifest` during build
2. Injects `<link rel="manifest">` into HTML automatically
3. The static `public/manifest.json` should be **removed** to avoid conflicts

### Dev Mode
- By default, service worker is **not active in dev mode** (only in `vite build` + `vite preview`)
- Can enable with `devOptions: { enabled: true }` for testing, but this uses a simplified SW
- **Recommendation**: Test PWA behavior via `pnpm build && pnpm preview`

## 2. Workbox Runtime Caching Strategies

### Strategy: CacheFirst (for images — FR-007)
- Checks cache first; only goes to network on cache miss
- Perfect for immutable or slow-changing content like auction item photos
- Config:

```ts
{
  urlPattern: /\.(?:png|jpg|jpeg|gif|svg|webp)$/i,
  handler: 'CacheFirst',
  options: {
    cacheName: 'images-cache',
    expiration: {
      maxEntries: 200,
      maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
    },
    cacheableResponse: { statuses: [0, 200] },
  },
}
```

### Strategy: NetworkFirst (for API data — FR-008)
- Tries network; falls back to cache on failure
- Ensures data freshness while providing offline resilience
- Config:

```ts
{
  urlPattern: /^https?:\/\/.*\/api\/v1\/.*/i,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    expiration: {
      maxEntries: 100,
      maxAgeSeconds: 24 * 60 * 60, // 24 hours
    },
    cacheableResponse: { statuses: [0, 200] },
  },
}
```

### Strategy: StaleWhileRevalidate (for Google Fonts — FR-015)
- Serves cached version immediately, fetches update in background
- Ideal for fonts: eliminates FOUT on repeat visits, still picks up font updates
- Config:

```ts
{
  urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
  handler: 'StaleWhileRevalidate',
  options: {
    cacheName: 'google-fonts-cache',
    expiration: {
      maxEntries: 30,
      maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
    },
    cacheableResponse: { statuses: [0, 200] },
  },
}
```

### Cache Size Limits (FR-018)
Workbox `expiration` plugin supports `maxEntries` and `purgeOnQuotaError`:
- **Image cache**: `maxEntries: 200` + custom check against 50 MB. Workbox doesn't natively cap by bytes, but `maxEntries` is the practical lever. 200 entries × ~250 KB avg ≈ 50 MB.
- **API cache**: `maxEntries: 100` keeps API cache small (~10 MB with typical JSON responses).
- `purgeOnQuotaError: true` — if browser quota is exceeded, Workbox automatically clears the cache rather than erroring.
- Eviction order: LRU (least recently used) is the Workbox default when `maxEntries` is set.

## 3. iOS PWA Limitations & Workarounds

### No `beforeinstallprompt` on iOS
- iOS Safari does **not** fire the `beforeinstallprompt` event
- Users must manually use "Add to Home Screen" from the share menu
- **Workaround**: Detect iOS Safari (`navigator.userAgent` check) and show a custom instruction banner: "Tap the share button, then 'Add to Home Screen'"
- Detection: `const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream`
- `const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone`

### Apple-Specific Meta Tags
Required for proper iOS PWA behavior:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="FundrBolt" />
<link rel="apple-touch-icon" href="/images/pwa-192x192.png" />
```

### Apple Splash Screens
- iOS uses `apple-touch-startup-image` link elements
- Requires separate images for each device resolution
- **Pragmatic approach**: Generate splash screens for the most common device sizes (iPhone 12-16 range, iPad) using a build-time tool or skip initially and add if needed. The app shell loads fast enough that splash screens are a polish item.

### Other iOS Limitations
- No background sync in iOS PWAs
- No push notifications in iOS PWAs (added in iOS 16.4+ but requires explicit permission and is unreliable)
- Service worker lifecycle: iOS may evict SW after a few days of inactivity
- No `navigator.storage.persist()` on iOS — caches may be evicted by OS under storage pressure

## 4. Install Prompt UX Patterns

### The `beforeinstallprompt` Flow (Android/Desktop Chrome)

```ts
// 1. Capture the event before it fires the native prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()           // Prevent native mini-infobar
  deferredPrompt = e           // Store for later use
  showInstallBanner()          // Show custom UI
})

// 2. When user clicks custom "Install" button
async function handleInstall() {
  deferredPrompt.prompt()      // Show native dialog
  const { outcome } = await deferredPrompt.userChoice
  if (outcome === 'accepted') { /* track install */ }
  deferredPrompt = null
}

// 3. Detect if already installed
window.addEventListener('appinstalled', () => {
  hideInstallBanner()
})

// 4. Check if already in standalone mode
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
```

### 7-Day Dismissal Cooldown (FR-003)
- Store `{ dismissedAt: timestamp }` in `localStorage` under key `pwa-install-dismissed-{app}`
- On load, check if `Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000`
- If within cooldown, don't show banner

### Banner UX
- Position: Bottom of viewport, above any existing bottom nav
- Non-intrusive: Small, dismissable, doesn't block content
- Appears after a short delay (e.g., 3 seconds after first load) to let user orient
- Shows app icon + "Add FundrBolt to your home screen" + Install button + dismiss X

## 5. Service Worker Update Strategy

### Prompt-Then-Auto-Update (FR-011, Clarification Q2)

```
[Deploy new code] → [User opens app]
  ↓
[SW detects new assets in background]
  ↓
[Show "New version available — tap to refresh" banner]
  ↓
[If user taps]: updateSW(true) → page reloads with new version
[If user ignores]:
  ↓
[24-hour timer starts]
  ↓
[After 24h on next navigation]: updateSW(true) → auto-refresh
```

### Implementation with `useRegisterSW`

```ts
const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(swUrl, registration) {
    // Check for updates every hour
    setInterval(() => {
      registration?.update()
    }, 60 * 60 * 1000)
  },
})

// Track when update was first detected
useEffect(() => {
  if (needRefresh[0]) {
    const detectedAt = localStorage.getItem('sw-update-detected')
    if (!detectedAt) {
      localStorage.setItem('sw-update-detected', Date.now().toString())
    } else {
      const elapsed = Date.now() - parseInt(detectedAt)
      if (elapsed > 24 * 60 * 60 * 1000) {
        updateServiceWorker(true) // Auto-update after 24h
      }
    }
  }
}, [needRefresh])
```

## 6. Offline Detection & UI Patterns

### `navigator.onLine` + Events

```ts
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
```

### Caveat
`navigator.onLine` can return `true` when behind a captive portal or on a network with no actual internet. The network-first caching strategy handles this gracefully — if the fetch fails, cached data is used regardless of what `navigator.onLine` reports.

### Offline UI Pattern (FR-016)
- Persistent bar at top of viewport: "You're offline — some features may be unavailable"
- Subtle styling: warning yellow background, small text
- Auto-dismisses when connectivity restores (FR-017)
- In auction gallery: disable bid/buy-now buttons, show tooltip "Reconnect to place bids"

## 7. PWA Icon Requirements

### Minimum Required Icons (FR-012)
| Size | Purpose | Format |
|------|---------|--------|
| 192×192 | Android install, manifest requirement | PNG |
| 512×512 | Android splash screen, manifest requirement | PNG |
| 512×512 maskable | Android adaptive icon (safe zone 80%) | PNG |
| 180×180 | iOS apple-touch-icon | PNG |

### Generation Approach
- Source: Existing SVG favicons at `public/images/favicon.svg`
- Tool: Use a CLI tool like `pwa-asset-generator` or manually export from SVG at required sizes
- Maskable variant: Ensure logo has sufficient padding (20% on each side) for the maskable safe zone
- Both apps can share the same icon assets (same brand identity)

## 8. Offline Fallback Page Design

### Implementation (FR-005, FR-006)
- A self-contained HTML file at `public/offline.html`
- **Must be self-contained**: inline CSS, inline SVG logo, no external dependencies
- Precached by the service worker during installation
- Served via Workbox `navigateFallback` when a navigation request fails

### Content per App
**Donor PWA** (`offline.html`):
- FundrBolt logo (inline SVG)
- Heading: "You're Currently Offline"
- Message: "Please reconnect to continue browsing and bidding."
- Visual: Wi-Fi off icon
- "Try Again" button that calls `window.location.reload()`

**Admin PWA** (`offline.html`):
- Same structure
- Message: "Please reconnect to continue managing your event."

## 9. Decisions & Trade-offs

| Decision | Choice | Alternative Considered | Rationale |
|----------|--------|----------------------|-----------|
| SW generation | `vite-plugin-pwa` with `generateSW` | Custom service worker (`injectManifest`) | `generateSW` covers all spec requirements with zero custom SW code; simpler to maintain |
| Register type | `prompt` | `autoUpdate` | Spec requires user notification before update (FR-011); `prompt` gives control |
| Image caching | CacheFirst | NetworkFirst | Images are immutable at a given URL; cache-first is faster and correct |
| API caching | NetworkFirst | StaleWhileRevalidate | Bid amounts, registrations must be fresh; network-first ensures data accuracy |
| Font caching | StaleWhileRevalidate | CacheFirst | Fast cached response + background refresh is ideal for fonts |
| Cache eviction | Workbox `maxEntries` | Custom byte-counting | `maxEntries` is simpler and Workbox-native; byte-counting adds complexity for marginal benefit |
| iOS install prompt | Custom instruction banner | Skip iOS | iPads are commonly used at events (check-in); must support iOS |
| Manifest source | Plugin-generated | Keep static `manifest.json` | Plugin-generated ensures consistency with config and auto-injects link tag |
| Offline fallback | Single static HTML file | Render React offline page | Static HTML requires zero JS/framework — most reliable when app shell isn't cached |
| Shared code | Shared constants only | Full shared PWA package | YAGNI — hooks/components are small and may diverge between apps; share only constants |

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| iOS Safari evicts SW after days of inactivity | Donor loses offline capability between event sessions | App shell loads fast even without SW; offline gallery is a P3 nice-to-have |
| `vite-plugin-pwa` conflicts with TanStack Router code splitting | Build failure or missing precache entries | Test with `autoCodeSplitting: true` (donor-pwa) and `false` (admin); adjust `globPatterns` |
| Install prompt UX confuses users unfamiliar with PWAs | Low install rate | Use clear, simple language; delay prompt 3s after load; respect 7-day cooldown |
| Service worker caches stale API data during long events | Donors see outdated bid amounts | Network-first strategy with 5-second timeout; stale indicator shows last-fetched time |
| Cache fills device storage on low-end phones | App errors or OS evicts data | `maxEntries` limits + `purgeOnQuotaError: true`; 50 MB image cap is well within typical quotas |
