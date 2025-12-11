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
 * - --event-text-on-primary: Contrasting text color for primary bg (hex)
 * - --event-text-on-secondary: Contrasting text color for secondary bg (hex)
 * - --event-text-on-background: Contrasting text color for background (hex)
 * - --event-text-muted-on-background: Muted text color for background (hex)
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
 *   color: var(--event-text-on-primary);
 * }
 * .page {
 *   background-color: rgb(var(--event-background));
 *   color: var(--event-text-on-background);
 * }
 * ```
 */

import {
  getContrastingTextColor,
  getContrastingTextColors,
  hexToRgbTuple,
} from '@/lib/color-utils'
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
 * Default Augeo branding colors (hex and RGB tuples)
 */
const DEFAULT_COLORS = {
  primary: '#3B82F6', // blue-500
  secondary: '#9333EA', // purple-600
  background: '#FFFFFF', // white
  accent: '#3B82F6', // blue-500
}

const DEFAULT_BRANDING = {
  primary: hexToRgbTuple(DEFAULT_COLORS.primary),
  secondary: hexToRgbTuple(DEFAULT_COLORS.secondary),
  background: hexToRgbTuple(DEFAULT_COLORS.background),
  accent: hexToRgbTuple(DEFAULT_COLORS.accent),
  textOnPrimary: getContrastingTextColor(DEFAULT_COLORS.primary),
  textOnSecondary: getContrastingTextColor(DEFAULT_COLORS.secondary),
  textOnBackground: getContrastingTextColor(DEFAULT_COLORS.background),
  textMutedOnBackground: getContrastingTextColors(DEFAULT_COLORS.background).muted,
}

export function useEventBranding() {
  /**
   * Apply event branding to the page
   */
  const applyBranding = (branding: EventBranding | null) => {
    const root = document.documentElement

    if (!branding) {
      // No branding provided, use defaults
      applyDefaultBranding(root)
      return
    }

    // Get actual colors with fallbacks
    const primaryColor = branding.primary_color || DEFAULT_COLORS.primary
    const secondaryColor = branding.secondary_color || DEFAULT_COLORS.secondary
    const backgroundColor = branding.background_color || DEFAULT_COLORS.background
    const accentColor = branding.accent_color || DEFAULT_COLORS.accent

    // Apply color RGB tuples
    root.style.setProperty('--event-primary', hexToRgbTuple(primaryColor))
    root.style.setProperty('--event-secondary', hexToRgbTuple(secondaryColor))
    root.style.setProperty('--event-background', hexToRgbTuple(backgroundColor))
    root.style.setProperty('--event-accent', hexToRgbTuple(accentColor))

    // Apply contrasting text colors
    root.style.setProperty('--event-text-on-primary', getContrastingTextColor(primaryColor))
    root.style.setProperty('--event-text-on-secondary', getContrastingTextColor(secondaryColor))
    root.style.setProperty('--event-text-on-background', getContrastingTextColor(backgroundColor))

    const bgTextColors = getContrastingTextColors(backgroundColor)
    root.style.setProperty('--event-text-muted-on-background', bgTextColors.muted)

    // Card colors - use secondary as card background with proper text contrast
    root.style.setProperty('--event-card-bg', hexToRgbTuple(secondaryColor))
    root.style.setProperty('--event-card-text', getContrastingTextColor(secondaryColor))
    root.style.setProperty('--event-card-text-muted', getContrastingTextColors(secondaryColor).muted)
  }

  /**
   * Apply default branding
   */
  const applyDefaultBranding = (root: HTMLElement) => {
    root.style.setProperty('--event-primary', DEFAULT_BRANDING.primary)
    root.style.setProperty('--event-secondary', DEFAULT_BRANDING.secondary)
    root.style.setProperty('--event-background', DEFAULT_BRANDING.background)
    root.style.setProperty('--event-accent', DEFAULT_BRANDING.accent)
    root.style.setProperty('--event-text-on-primary', DEFAULT_BRANDING.textOnPrimary)
    root.style.setProperty('--event-text-on-secondary', DEFAULT_BRANDING.textOnSecondary)
    root.style.setProperty('--event-text-on-background', DEFAULT_BRANDING.textOnBackground)
    root.style.setProperty('--event-text-muted-on-background', DEFAULT_BRANDING.textMutedOnBackground)
  }

  /**
   * Clear event branding and reset to Augeo defaults
   */
  const clearBranding = () => {
    applyDefaultBranding(document.documentElement)
  }

  // Cleanup: Reset branding when component unmounts
  useEffect(() => {
    return () => {
      clearBranding()
    }
  }, [])

  return { applyBranding, clearBranding }
}
