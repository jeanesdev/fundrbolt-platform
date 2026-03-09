/**
 * Contract: PWA UI Components
 *
 * Defines the prop interfaces for the PWA-specific React components:
 * InstallPromptBanner, UpdateNotification, OfflineStatusBar, and OfflineFallbackPage.
 *
 * Reference: FR-002, FR-003, FR-004, FR-005, FR-006, FR-011, FR-016
 */

// ─── InstallPromptBanner ─────────────────────────────────────────────────────

/**
 * Props for the InstallPromptBanner component.
 *
 * Renders a bottom-anchored banner prompting the user to install the PWA.
 * Captures the `beforeinstallprompt` event on mount.
 * On iOS, shows manual instructions ("Tap share, then Add to Home Screen").
 *
 * Reference: FR-002, FR-003, FR-004
 */
export interface InstallPromptBannerProps {
  /**
   * Unique key for localStorage cooldown tracking.
   * e.g., "donor" or "admin"
   */
  appId: string

  /**
   * Delay in milliseconds before showing the banner after page load.
   * Default: 3000
   */
  showDelay?: number
}

/**
 * Hook contract: useInstallPrompt
 *
 * Manages the lifecycle of the PWA install prompt.
 *
 * Behavior:
 * 1. Listens for `beforeinstallprompt` event and stores the deferred prompt
 * 2. Checks if the app is already installed (standalone mode) → hides if so (FR-004)
 * 3. Checks localStorage for dismissal cooldown → hides if within 7 days (FR-003)
 * 4. Detects iOS Safari and switches to manual instruction mode
 * 5. Provides `promptInstall()` to trigger the native install dialog
 * 6. Provides `dismiss()` to hide the banner and start the 7-day cooldown
 */
export interface UseInstallPromptReturn {
  /** Whether the install banner should be visible */
  canShow: boolean

  /** Whether we're on iOS (show manual instructions instead of native prompt) */
  isIOS: boolean

  /** Whether the app is already installed in standalone mode */
  isInstalled: boolean

  /** Trigger the native install dialog (no-op on iOS) */
  promptInstall: () => Promise<void>

  /** Dismiss the banner and start the 7-day cooldown */
  dismiss: () => void
}

export type UseInstallPrompt = (appId: string) => UseInstallPromptReturn

// ─── UpdateNotification ──────────────────────────────────────────────────────

/**
 * Props for the UpdateNotification component.
 *
 * Renders a non-blocking toast/banner when a new app version is available.
 * Positioned at the top or bottom of the viewport.
 *
 * Reference: FR-011
 */
export interface UpdateNotificationProps {
  /** Whether a new version is waiting to be activated */
  needRefresh: boolean

  /** Called when the user taps "Refresh" to activate the new version */
  onRefresh: () => Promise<void>

  /** Called when the user dismisses the notification */
  onDismiss: () => void
}

// ─── OfflineStatusBar ────────────────────────────────────────────────────────

/**
 * Props for the OfflineStatusBar component.
 *
 * Renders a persistent, slim notification bar when the device is offline.
 * Auto-hides when connectivity is restored.
 *
 * Reference: FR-016, FR-017
 */
export interface OfflineStatusBarProps {
  /** Current online status from useOnlineStatus() */
  isOnline: boolean
}

// ─── OfflineFallbackPage ─────────────────────────────────────────────────────

/**
 * Offline fallback page is a static HTML file, not a React component.
 *
 * Located at: `public/offline.html` in each app
 *
 * Requirements (FR-005, FR-006):
 * - Self-contained: inline CSS, inline SVG logo, no external dependencies
 * - Displays FundrBolt brand identity (logo, theme colors)
 * - App-appropriate messaging:
 *     Donor: "Please reconnect to continue browsing and bidding."
 *     Admin: "Please reconnect to continue managing your event."
 * - "Try Again" button that calls `window.location.reload()`
 * - Listens for `online` event to auto-reload when connectivity returns
 *
 * NOT a React component — served directly by the service worker.
 */

// ─── StaleDataIndicator ──────────────────────────────────────────────────────

/**
 * Props for an inline stale-data indicator shown when cached API data is displayed.
 *
 * Reference: FR-010
 */
export interface StaleDataIndicatorProps {
  /** The timestamp when the data was last successfully fetched from the network */
  lastFetchedAt: Date | null

  /** Whether the current data was served from cache (network request failed) */
  isStale: boolean
}
