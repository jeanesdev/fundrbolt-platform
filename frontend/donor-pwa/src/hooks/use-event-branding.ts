/**
 * Hook for applying event-specific branding to the page
 *
 * This hook injects CSS custom properties (--event-primary, --event-secondary)
 * based on event branding colors. Components can then use these variables
 * for dynamic styling.
 *
 * Usage:
 * ```tsx
 * const { applyBranding, clearBranding } = useEventBranding()
 *
 * // Apply event branding
 * applyBranding({ primary_color: '#FF5733', secondary_color: '#33C3FF' })
 *
 * // Clear branding (reset to Augeo defaults)
 * clearBranding()
 * ```
 *
 * CSS Usage:
 * ```css
 * .header {
 *   background-color: rgb(var(--event-primary));
 * }
 * .button {
 *   background-color: rgb(var(--event-primary));
 *   border-color: rgb(var(--event-secondary));
 * }
 * ```
 */

import { useEffect } from 'react'

export interface EventBranding {
  primary_color?: string | null
  secondary_color?: string | null
  logo_url?: string | null
  banner_url?: string | null
}

/**
 * Convert hex color (#RRGGBB) to RGB tuple (r, g, b)
 */
function hexToRgb(hex: string): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '')

  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)

  return `${r}, ${g}, ${b}`
}

/**
 * Default Augeo branding colors
 */
const DEFAULT_BRANDING = {
  primary: '59, 130, 246', // blue-500: #3B82F6
  secondary: '147, 51, 234', // purple-600: #9333EA
}

export function useEventBranding() {
  /**
   * Apply event branding to the page
   */
  const applyBranding = (branding: EventBranding | null) => {
    const root = document.documentElement

    if (!branding) {
      // No branding provided, use defaults
      root.style.setProperty('--event-primary', DEFAULT_BRANDING.primary)
      root.style.setProperty('--event-secondary', DEFAULT_BRANDING.secondary)
      return
    }

    // Apply primary color if provided
    if (branding.primary_color) {
      const primaryRgb = hexToRgb(branding.primary_color)
      root.style.setProperty('--event-primary', primaryRgb)
    } else {
      root.style.setProperty('--event-primary', DEFAULT_BRANDING.primary)
    }

    // Apply secondary color if provided
    if (branding.secondary_color) {
      const secondaryRgb = hexToRgb(branding.secondary_color)
      root.style.setProperty('--event-secondary', secondaryRgb)
    } else {
      root.style.setProperty('--event-secondary', DEFAULT_BRANDING.secondary)
    }
  }

  /**
   * Clear event branding and reset to Augeo defaults
   */
  const clearBranding = () => {
    const root = document.documentElement
    root.style.setProperty('--event-primary', DEFAULT_BRANDING.primary)
    root.style.setProperty('--event-secondary', DEFAULT_BRANDING.secondary)
  }

  // Cleanup: Reset branding when component unmounts
  useEffect(() => {
    return () => {
      clearBranding()
    }
  }, [])

  return { applyBranding, clearBranding }
}
