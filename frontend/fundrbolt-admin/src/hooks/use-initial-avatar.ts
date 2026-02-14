/**
 * useInitialAvatar Hook
 * Generates initial-based avatar configuration with WCAG AA compliant colors
 *
 * Used for NPOs and Events without uploaded logos/images.
 * Auto-calculates contrasting text color and applies border when needed.
 *
 * Business Rules:
 * - Extracts first letter of first two words (max 2 characters)
 * - Uses branding primary color as background if available
 * - Falls back to navy (#1E293B) on white if no branding
 * - Auto-adjusts text color (white/navy) for WCAG AA compliance (4.5:1 ratio)
 * - Adds border for navy-on-white theme when contrast insufficient
 */

import { getContrastingTextColor, meetsWCAGAA } from '@/lib/colors'
import { colors as brandColors } from '@fundrbolt/shared/assets'
import { useMemo } from 'react'

export interface InitialAvatarConfig {
  initials: string
  bgColor: string
  textColor: string
  hasBorder: boolean
}

export interface UseInitialAvatarProps {
  name: string
  brandingPrimaryColor?: string | null
}

/**
 * Extract initials from a name
 * Takes first letter of first two words
 *
 * Examples:
 * - "Fundrbolt Platform" -> "FP"
 * - "St. Mary's Church" -> "SM"
 * - "NPO" -> "NP" (single word, uses first two letters)
 * - "The Community Foundation" -> "TC"
 */
function extractInitials(name: string): string {
  if (!name) return '??'

  // Split by spaces and filter empty strings
  const words = name.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) return '??'

  if (words.length === 1) {
    // Single word: take first two characters
    const word = words[0]
    return word.length >= 2
      ? word.substring(0, 2).toUpperCase()
      : word.charAt(0).toUpperCase()
  }

  // Multiple words: take first letter of first two words
  const firstLetter = words[0].charAt(0).toUpperCase()
  const secondLetter = words[1].charAt(0).toUpperCase()
  return firstLetter + secondLetter
}

/**
 * Hook to generate initial avatar configuration
 */
export function useInitialAvatar({
  name,
  brandingPrimaryColor,
}: UseInitialAvatarProps): InitialAvatarConfig {
  const config = useMemo(() => {
    const initials = extractInitials(name)

    // Determine background color
    let bgColor: string
    if (brandingPrimaryColor && /^#[A-Fa-f0-9]{3,6}$/.test(brandingPrimaryColor)) {
      // Use branding color if valid hex
      bgColor = brandingPrimaryColor
    } else {
      // Fallback to navy
      bgColor = brandColors.palette.ink
    }

    // Auto-calculate contrasting text color
    const textColor = getContrastingTextColor(bgColor)

    // Check if we need a border (navy background on white text needs border)
    const needsBorder = bgColor === brandColors.palette.ink && textColor === brandColors.secondary.white
    // Alternative: Check WCAG compliance and add border if barely passing
    const wcagCompliant = meetsWCAGAA(textColor, bgColor)
    const hasBorder = needsBorder || !wcagCompliant

    return {
      initials,
      bgColor,
      textColor,
      hasBorder,
    }
  }, [name, brandingPrimaryColor])

  return config
}
