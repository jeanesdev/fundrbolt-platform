/// <reference lib="webworker" />
// NOTE: Workbox modules are loaded via dynamic import() below so that when iOS
// cold-starts this service worker to handle a push event, the push listener is
// available immediately — no static imports need to resolve first.  Static ES
// imports would block ALL code execution until every module (fetched through
// ngrok in dev) is loaded, causing iOS to time-out and silently drop the push.

declare const self: ServiceWorkerGlobalScope

// ──────────────────────────────────────────────────────────────
// Push / notification handlers — MUST be registered synchronously
// before any async work so iOS can dispatch events immediately.
// ──────────────────────────────────────────────────────────────

// Claim clients immediately on activation so push subscriptions
// are associated with the active SW that will receive push events.
// Also reload all open clients so they get the new HTML/assets instead
// of being left with stale references from the previous SW's cached shell.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()

      // Get all open windows before we wipe old cache entries.
      const openClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Clean up stale precache entries from previous builds now that
      // we have a reference to every open client.  We do this BEFORE
      // reloading so the next load always comes from the fresh cache.
      const { cleanupOutdatedCaches } = await import('workbox-precaching')
      cleanupOutdatedCaches()

      // Reload every open tab so it picks up the new HTML shell (and
      // therefore the new content-hashed CSS/JS filenames).
      //
      // Prefer client.navigate() because it works even when the page's
      // JS has not yet set up a message listener — which is the race
      // condition that causes the "no CSS on homescreen PWA" bug on iOS:
      // the SW activates before the page bundle finishes loading, the
      // postMessage is never heard, and the page keeps serving stale
      // asset hashes that cleanupOutdatedCaches() already removed.
      for (const client of openClients) {
        const windowClient = client as WindowClient
        try {
          await windowClient.navigate(windowClient.url)
        } catch {
          // navigate() can fail if the client is not focused (e.g. a
          // background tab on some browsers).  Fall back to postMessage
          // so the page can reload itself via the SW_UPDATED handler.
          client.postMessage({ type: 'SW_UPDATED' })
        }
      }
    })()
  )
})

// Handle SKIP_WAITING from the main thread (VitePWA update prompt).
// Required for injectManifest strategy with registerType: 'prompt'.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Push notification handler
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) {
    return
  }

  let payload: {
    title?: string
    body?: string
    icon?: string
    badge?: string
    data?: Record<string, unknown>
  }

  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Fundrbolt', body: event.data.text() }
  }

  const title = payload.title ?? 'Fundrbolt'
  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/images/pwa-192x192.png',
    badge: payload.badge ?? '/images/pwa-192x192.png',
    data: payload.data ?? {},
    tag: `fundrbolt-${Date.now()}`,
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // If the app is open and visible in the foreground, skip the native
        // notification — the in-app Socket.IO toast handles it instead.
        const isAppVisible = clients.some(
          (client) => (client as WindowClient).visibilityState === 'visible',
        )
        if (isAppVisible) {
          return
        }

        return self.registration
          .showNotification(title, options)
          // eslint-disable-next-line no-console
          .then(() => console.log('[SW] showNotification resolved'))
          .catch((err: unknown) =>
            // eslint-disable-next-line no-console
            console.error('[SW] showNotification failed:', err),
          )
      }),
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const deepLink = (event.notification.data?.deep_link as string) ?? '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window if available
        for (const client of clients) {
          if ('focus' in client) {
            client.focus()
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              deep_link: deepLink,
            })
            return
          }
        }
        // Open new window if no existing client
        return self.clients.openWindow(deepLink)
      })
  )
})

// ──────────────────────────────────────────────────────────────
// Workbox caching — loaded asynchronously via dynamic import so
// it never blocks push event handling.
// ──────────────────────────────────────────────────────────────

async function setupWorkboxCaching() {
  const { precacheAndRoute } = await import('workbox-precaching')
  const { registerRoute } = await import('workbox-routing')
  const { CacheFirst, NetworkFirst, StaleWhileRevalidate } =
    await import('workbox-strategies')
  const { ExpirationPlugin } = await import('workbox-expiration')

  // Precache static assets injected by vite-plugin-pwa.
  // Note: cleanupOutdatedCaches() is called in the activate event handler
  // (after clients.claim()) so that stale entries are only removed once
  // every open tab has already been told to reload with the new shell.
  precacheAndRoute(self.__WB_MANIFEST)

  // Images: CacheFirst (30 days)
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'images-cache',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          purgeOnQuotaError: true,
        }),
      ],
    })
  )

  // API: NetworkFirst (5s timeout, 24h cache)
  registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new NetworkFirst({
      cacheName: 'api-cache',
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60,
          purgeOnQuotaError: true,
        }),
      ],
    })
  )

  // Google Fonts: StaleWhileRevalidate
  registerRoute(
    ({ url }) =>
      url.origin === 'https://fonts.googleapis.com' ||
      url.origin === 'https://fonts.gstatic.com',
    new StaleWhileRevalidate({
      cacheName: 'google-fonts-cache',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 30,
        }),
      ],
    })
  )
}

// Fire-and-forget — caching is non-critical
setupWorkboxCaching().catch((err) => {
  // eslint-disable-next-line no-console
  console.warn('[SW] Workbox caching setup failed (non-fatal):', err)
})
