# Quickstart: PWA Capabilities

**Feature**: 032-pwa-capabilities | **Date**: 2026-03-05

## Prerequisites

- Node.js 22+ (via nvm)
- pnpm (workspace package manager)
- Both frontend apps build successfully (`pnpm build` in each)

## Step 1 — Install `vite-plugin-pwa`

From the workspace root:

```bash
cd frontend/donor-pwa && pnpm add -D vite-plugin-pwa
cd ../fundrbolt-admin && pnpm add -D vite-plugin-pwa
```

## Step 2 — Generate PWA Icons

Create 192×192, 512×512, and 512×512 maskable icons from the existing SVG favicon:

```bash
# Option A: Use a CLI tool
npx pwa-asset-generator frontend/donor-pwa/public/images/favicon.svg \
  frontend/donor-pwa/public/images/ --icon-only --type png

# Option B: Manual export (Figma, Inkscape, etc.)
# Export favicon.svg at 192x192, 512x512, and 512x512-with-padding (maskable)
# Save as pwa-192x192.png, pwa-512x512.png, pwa-maskable-512x512.png
```

Place icons in both `frontend/donor-pwa/public/images/` and `frontend/fundrbolt-admin/public/images/`.

## Step 3 — Create Offline Fallback Pages

Create `frontend/donor-pwa/public/offline.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Offline - Fundrbolt</title>
  <style>
    /* Inline all styles — no external CSS allowed */
    body { font-family: system-ui; text-align: center; padding: 2rem; background: #f8fafc; }
    .container { max-width: 400px; margin: 4rem auto; }
    h1 { color: #0f172a; }
    p { color: #64748b; margin: 1rem 0; }
    button { background: #0f172a; color: white; border: none; padding: 0.75rem 2rem;
             border-radius: 0.5rem; cursor: pointer; font-size: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Inline SVG logo here -->
    <h1>You're Currently Offline</h1>
    <p>Please reconnect to continue browsing and bidding.</p>
    <button onclick="window.location.reload()">Try Again</button>
  </div>
  <script>
    window.addEventListener('online', () => window.location.reload());
  </script>
</body>
</html>
```

Create a similar file for `frontend/fundrbolt-admin/public/offline.html` with admin-appropriate messaging.

## Step 4 — Configure VitePWA in `vite.config.ts`

Add VitePWA to the Vite plugins array in each app. Example for donor-pwa:

```ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    // ... existing plugins ...
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'images/*.png', 'offline.html'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|gif|svg|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/api\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Fundrbolt Donor Portal',
        short_name: 'Fundrbolt',
        description: 'Support nonprofits, attend events, and make a difference.',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/images/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/images/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/images/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
```

## Step 5 — Remove Static `manifest.json`

Delete `public/manifest.json` from both apps (the plugin now generates the manifest):

```bash
rm frontend/donor-pwa/public/manifest.json
rm frontend/fundrbolt-admin/public/manifest.json
```

Also remove the `<link rel="manifest" href="/manifest.json" />` from `index.html` in both apps — the plugin auto-injects it.

## Step 6 — Add Apple Meta Tags to `index.html`

Add these to the `<head>` of both `index.html` files:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Fundrbolt" />
<link rel="apple-touch-icon" href="/images/pwa-192x192.png" />
```

## Step 7 — Create PWA Hooks

Create the three React hooks in each app's `src/hooks/` directory:

1. **`use-online-status.ts`** — Track `navigator.onLine` with `online`/`offline` events
2. **`use-service-worker.ts`** — Wrap `useRegisterSW` from `virtual:pwa-register/react`, add 24h auto-update timer
3. **`use-install-prompt.ts`** — Capture `beforeinstallprompt`, manage 7-day cooldown, detect iOS

See [contracts/service-worker-hooks.ts](contracts/service-worker-hooks.ts) for full interface specs.

## Step 8 — Create PWA Components

Create UI components in each app's `src/components/pwa/` directory:

1. **`install-prompt-banner.tsx`** — Bottom banner with "Install" button
2. **`update-notification.tsx`** — Toast for "New version available"
3. **`offline-status-bar.tsx`** (Donor PWA only) — Persistent offline indicator

See [contracts/pwa-components.ts](contracts/pwa-components.ts) for full prop specs.

## Step 9 — Wire Components into App Layout

Add the PWA components to the root layout of each app:

```tsx
// In the root layout component
import { InstallPromptBanner } from '@/components/pwa/install-prompt-banner'
import { UpdateNotification } from '@/components/pwa/update-notification'
import { OfflineStatusBar } from '@/components/pwa/offline-status-bar'
import { useServiceWorker } from '@/hooks/use-service-worker'
import { useOnlineStatus } from '@/hooks/use-online-status'

function RootLayout() {
  const { needRefresh, updateServiceWorker, dismissUpdate } = useServiceWorker()
  const isOnline = useOnlineStatus()

  return (
    <>
      {/* Existing layout */}
      <InstallPromptBanner appId="donor" />
      <UpdateNotification
        needRefresh={needRefresh}
        onRefresh={() => updateServiceWorker(true)}
        onDismiss={dismissUpdate}
      />
      <OfflineStatusBar isOnline={isOnline} />
    </>
  )
}
```

## Step 10 — Test

### Build and preview:

```bash
cd frontend/donor-pwa
pnpm build
pnpm preview
# Open http://localhost:4173 in Chrome
```

### Verify:

1. **Installable**: Chrome shows install icon in address bar
2. **Lighthouse**: Run PWA audit — should pass all installability checks
3. **Offline**: Open DevTools → Application → Service Workers → check "Offline" → reload → see offline.html
4. **Caching**: Load auction gallery → throttle to Slow 3G → reload → images load instantly
5. **Update**: Rebuild with a change → reload app → see "New version available" banner
6. **Install prompt**: Open in mobile Chrome → see custom install banner after 3s delay

## Verification Checklist

- [ ] `pnpm build` succeeds in both apps without errors
- [ ] Service worker registers on page load (check DevTools → Application → Service Workers)
- [ ] App shell loads from cache on repeat visit (check Network tab: SW responses)
- [ ] Offline fallback page appears when navigating offline
- [ ] Install prompt banner appears on first mobile visit
- [ ] Update notification appears after deploying new code
- [ ] Lighthouse PWA audit passes with no critical failures
- [ ] Apple meta tags render correctly on iOS Safari
