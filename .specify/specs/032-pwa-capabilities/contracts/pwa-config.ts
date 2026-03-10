/**
 * Contract: VitePWA Plugin Configuration
 *
 * Defines the shape of the VitePWA configuration object used in both
 * donor-pwa and fundrbolt-admin vite.config.ts files.
 *
 * Reference: FR-001, FR-005, FR-007, FR-008, FR-011, FR-012, FR-014, FR-015, FR-018
 */

// Stub for the VitePWA plugin options type (vite-plugin-pwa is not installed at the spec level)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VitePWAOptions = Record<string, any>

/**
 * App-specific manifest values that differ between Donor PWA and Admin PWA.
 */
export interface AppManifestConfig {
  name: string // e.g., "Fundrbolt Donor Portal"
  short_name: string // e.g., "Fundrbolt"
  description: string
  theme_color: string // "#0f172a"
  background_color: string // "#ffffff"
}

/**
 * Shared PWA constants used across both apps.
 */
export interface PWACacheConfig {
  /** Maximum number of entries in the image cache (~50 MB target) */
  IMAGE_CACHE_MAX_ENTRIES: number // 200
  /** Maximum age for cached images in seconds */
  IMAGE_CACHE_MAX_AGE_SECONDS: number // 30 * 24 * 60 * 60

  /** Maximum number of entries in the API cache (~10 MB target) */
  API_CACHE_MAX_ENTRIES: number // 100
  /** Network timeout before falling back to cache, in seconds */
  API_NETWORK_TIMEOUT_SECONDS: number // 5
  /** Maximum age for cached API responses in seconds */
  API_CACHE_MAX_AGE_SECONDS: number // 24 * 60 * 60

  /** Maximum number of font entries to cache */
  FONT_CACHE_MAX_ENTRIES: number // 30

  /** Install prompt dismissal cooldown in milliseconds */
  INSTALL_PROMPT_COOLDOWN_MS: number // 7 * 24 * 60 * 60 * 1000

  /** Auto-update timeout in milliseconds */
  AUTO_UPDATE_TIMEOUT_MS: number // 24 * 60 * 60 * 1000

  /** Periodic SW update check interval in milliseconds */
  UPDATE_CHECK_INTERVAL_MS: number // 60 * 60 * 1000 (1 hour)
}

/**
 * Factory function contract: creates the VitePWA options for a given app.
 *
 * @param appManifest - App-specific manifest values
 * @returns VitePWAOptions suitable for passing to VitePWA() in vite.config.ts
 */
export type CreatePWAConfig = (appManifest: AppManifestConfig) => Partial<VitePWAOptions>

/**
 * Expected VitePWA config structure (for reference — actual config is inlined in vite.config.ts):
 *
 * {
 *   registerType: 'prompt',
 *   includeAssets: ['favicon.ico', 'images/*.png', 'offline.html'],
 *   workbox: {
 *     globPatterns: ['** /*.{js,css,html,ico,png,svg,woff2}'],
 *     navigateFallback: '/offline.html',
 *     navigateFallbackDenylist: [/^\/api/],
 *     runtimeCaching: [
 *       { urlPattern: /images/, handler: 'CacheFirst', ... },
 *       { urlPattern: /api/, handler: 'NetworkFirst', ... },
 *       { urlPattern: /fonts/, handler: 'StaleWhileRevalidate', ... },
 *     ],
 *   },
 *   manifest: { ...appManifest, icons: [...], start_url: '/', scope: '/', display: 'standalone' },
 * }
 */
