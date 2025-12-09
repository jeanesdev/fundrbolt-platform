/**
 * Hook for applying event-specific branding to the page
 *
 * This hook injects CSS custom properties based on event branding colors.
 * Components can then use these variables for dynamic styling.
 *
 * Available CSS Variables:
 * - --event-primary: Primary brand color (RGB tuple)
 * - --event-secondary: Secondary brand color (RGB tuple)
 * - --event-background: Page background color (RGB tuple)
 * - --event-accent: Accent/highlight color (RGB tuple)
 *
 * Usage:
 * ```tsx
 * const { applyBranding, clearBranding } = useEventBranding()
 *
 * // Apply event branding
 * applyBranding({
 *   primary_color: '#FF5733',
 *   secondary_color: '#33C3FF',
 *   background_color: '#FFFFFF',
 *   accent_color: '#FF5733'
 * })
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
 * .page {
 *   background-color: rgb(var(--event-background));
 * }
 * .highlight {
 *   color: rgb(var(--event-accent));
 * }
 * ```
 */

import { useEffect } from 'react'

export interface EventBranding {
  primary_color?: string | null
  secondary_color?: string | null
  background_color?: string | null
  accent_color?: string | null
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
  background: '255, 255, 255', // white: #FFFFFF
  accent: '59, 130, 246', // blue-500: #3B82F6
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
      root.style.setProperty('--event-background', DEFAULT_BRANDING.background)
      root.style.setProperty('--event-accent', DEFAULT_BRANDING.accent)
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

    // Apply background color if provided
    if (branding.background_color) {
      const backgroundRgb = hexToRgb(branding.background_color)
      root.style.setProperty('--event-background', backgroundRgb)
    } else {
      root.style.setProperty('--event-background', DEFAULT_BRANDING.background)
    }

    // Apply accent color if provided
    if (branding.accent_color) {
      const accentRgb = hexToRgb(branding.accent_color)
      root.style.setProperty('--event-accent', accentRgb)
    } else {
      root.style.setProperty('--event-accent', DEFAULT_BRANDING.accent)
    }
  }

  /**
   * Clear event branding and reset to Augeo defaults
   */
  const clearBranding = () => {
    const root = document.documentElement
    root.style.setProperty('--event-primary', DEFAULT_BRANDING.primary)
    root.style.setProperty('--event-secondary', DEFAULT_BRANDING.secondary)
    root.style.setProperty('--event-background', DEFAULT_BRANDING.background)
    root.style.setProperty('--event-accent', DEFAULT_BRANDING.accent)
  }

  // Cleanup: Reset branding when component unmounts
  useEffect(() => {
    return () => {
      clearBranding()
    }
  }, [])

  return { applyBranding, clearBranding }
}
