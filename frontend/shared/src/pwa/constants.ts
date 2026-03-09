/**
 * Shared PWA constants used across both Donor PWA and Admin PWA.
 *
 * These values configure caching strategies, cooldowns, and localStorage keys
 * for all PWA features.
 */

// ─── Cache Names ─────────────────────────────────────────────────────────────

export const CACHE_NAMES = {
  IMAGES: 'images-cache',
  API: 'api-cache',
  GOOGLE_FONTS: 'google-fonts-cache',
} as const

// ─── Cache Size Limits ───────────────────────────────────────────────────────

/** Maximum number of entries in the image cache (~50 MB target) */
export const IMAGE_CACHE_MAX_ENTRIES = 200

/** Maximum age for cached images in seconds (30 days) */
export const IMAGE_CACHE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/** Maximum number of entries in the API cache (~10 MB target) */
export const API_CACHE_MAX_ENTRIES = 100

/** Network timeout before falling back to cache, in seconds */
export const API_NETWORK_TIMEOUT_SECONDS = 5

/** Maximum age for cached API responses in seconds (24 hours) */
export const API_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60

/** Maximum number of font entries to cache */
export const FONT_CACHE_MAX_ENTRIES = 30

// ─── Cooldowns & Timers ──────────────────────────────────────────────────────

/** Install prompt dismissal cooldown in milliseconds (7 days) */
export const INSTALL_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

/** Auto-update timeout in milliseconds (24 hours) */
export const AUTO_UPDATE_TIMEOUT_MS = 24 * 60 * 60 * 1000

/** Periodic SW update check interval in milliseconds (1 hour) */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

// ─── localStorage Keys ──────────────────────────────────────────────────────

/**
 * Returns the localStorage key for install prompt dismissal tracking.
 * Scoped by appId to allow independent cooldowns per app.
 */
export const getInstallDismissedKey = (appId: string): string =>
  `pwa-install-dismissed-${appId}`

/** localStorage key for tracking when a SW update was first detected */
export const SW_UPDATE_DETECTED_KEY = 'sw-update-detected'
