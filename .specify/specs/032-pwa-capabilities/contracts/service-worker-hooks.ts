/**
 * Contract: Service Worker & Online Status Hooks
 *
 * Defines the interfaces for React hooks that manage PWA service worker
 * lifecycle and network connectivity status.
 *
 * Reference: FR-001, FR-011, FR-016, FR-017
 */

// ─── useServiceWorker ────────────────────────────────────────────────────────

/**
 * Return type for the useServiceWorker hook.
 *
 * Wraps `useRegisterSW` from `virtual:pwa-register/react` with additional
 * logic for the 24-hour auto-update timer (FR-011).
 */
export interface UseServiceWorkerReturn {
  /**
   * Whether the app shell has been fully cached and is ready for offline use.
   */
  offlineReady: boolean

  /**
   * Whether a new version of the app is available and waiting to be activated.
   */
  needRefresh: boolean

  /**
   * Activate the waiting service worker and optionally reload the page.
   * Called when the user taps "Refresh" on the update notification.
   *
   * @param reloadPage - Whether to reload after activation (default: true)
   */
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>

  /**
   * Dismiss the "offline ready" notification without taking action.
   */
  dismissOfflineReady: () => void

  /**
   * Dismiss the "update available" notification.
   * The 24-hour auto-update timer continues running.
   */
  dismissUpdate: () => void
}

/**
 * Hook contract: useServiceWorker
 *
 * Registers the service worker, tracks update availability, and implements
 * the 24-hour auto-update timeout per FR-011.
 *
 * Behavior:
 * 1. Registers SW on mount via `useRegisterSW`
 * 2. Sets up periodic update checks (every 1 hour)
 * 3. When `needRefresh` becomes true, stores detection timestamp in localStorage
 * 4. On each render while `needRefresh` is true, checks if 24h has elapsed
 * 5. If 24h elapsed, calls `updateServiceWorker(true)` automatically
 */
export type UseServiceWorker = () => UseServiceWorkerReturn

// ─── useOnlineStatus ─────────────────────────────────────────────────────────

/**
 * Hook contract: useOnlineStatus
 *
 * Tracks the browser's online/offline status using `navigator.onLine`
 * and the `online`/`offline` window events.
 *
 * @returns `true` if the browser reports being online, `false` otherwise
 *
 * Usage:
 * ```tsx
 * const isOnline = useOnlineStatus()
 * if (!isOnline) {
 *   // Show offline indicator, disable write operations
 * }
 * ```
 *
 * Note: `navigator.onLine` can be unreliable (e.g., captive portals).
 * The NetworkFirst caching strategy handles actual connectivity failures
 * regardless of this value.
 *
 * Reference: FR-016, FR-017
 */
export type UseOnlineStatus = () => boolean
