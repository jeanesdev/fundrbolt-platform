/// <reference lib="webworker" />
import { ExpirationPlugin } from 'workbox-expiration'
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

// Claim clients immediately on activation so push subscriptions
// are associated with the active SW that will receive push events.
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Handle SKIP_WAITING from the main thread (VitePWA update prompt).
// Required for injectManifest strategy with registerType: 'prompt'.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Precache static assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST)

// Runtime caching strategies

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

// Push notification handler
self.addEventListener('push', (event: PushEvent) => {
  // eslint-disable-next-line no-console
  console.log('[SW] Push event received')

  if (!event.data) {
    // eslint-disable-next-line no-console
    console.warn('[SW] Push event has no data, ignoring')
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
    // eslint-disable-next-line no-console
    console.log('[SW] Push payload parsed:', JSON.stringify(payload))
  } catch {
    payload = { title: 'Fundrbolt', body: event.data.text() }
    // eslint-disable-next-line no-console
    console.log('[SW] Push payload fell back to text:', payload.body)
  }

  const title = payload.title ?? 'Fundrbolt'
  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/images/pwa-192x192.png',
    badge: payload.badge ?? '/images/pwa-192x192.png',
    data: payload.data ?? {},
    tag: `fundrbolt-${Date.now()}`,
  }

  // eslint-disable-next-line no-console
  console.log('[SW] Calling showNotification:', title, JSON.stringify(options))

  event.waitUntil(
    self.registration
      .showNotification(title, options)
      // eslint-disable-next-line no-console
      .then(() => console.log('[SW] showNotification resolved'))
      .catch((err: unknown) =>
        // eslint-disable-next-line no-console
        console.error('[SW] showNotification failed:', err)
      )
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
