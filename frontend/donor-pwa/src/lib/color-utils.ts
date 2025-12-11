/**
 * Color Utility Functions
 *
 * Helpers for calculating contrast colors, luminance, and accessibility.
 */

/**
 * Parse a hex color string to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '')

  // Handle 3-digit hex
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16)
    const g = parseInt(cleanHex[1] + cleanHex[1], 16)
    const b = parseInt(cleanHex[2] + cleanHex[2], 16)
    return { r, g, b }
  }

  // Handle 6-digit hex
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.slice(0, 2), 16)
    const g = parseInt(cleanHex.slice(2, 4), 16)
    const b = parseInt(cleanHex.slice(4, 6), 16)
    return { r, g, b }
  }

  return null
}

/**
 * Calculate relative luminance of a color (WCAG 2.1 formula)
 * Returns a value between 0 (darkest) and 1 (lightest)
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5 // Default to mid-gray if invalid

  // Convert to sRGB
  const { r, g, b } = rgb
  const sR = r / 255
  const sG = g / 255
  const sB = b / 255

  // Apply gamma correction
  const R = sR <= 0.03928 ? sR / 12.92 : Math.pow((sR + 0.055) / 1.055, 2.4)
  const G = sG <= 0.03928 ? sG / 12.92 : Math.pow((sG + 0.055) / 1.055, 2.4)
  const B = sB <= 0.03928 ? sB / 12.92 : Math.pow((sB + 0.055) / 1.055, 2.4)

  // Calculate luminance
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/**
 * Check if a color is "light" (should use dark text)
 * Uses a threshold of 0.5 for luminance
 */
export function isLightColor(hex: string): boolean {
  return getLuminance(hex) > 0.5
}

/**
 * Get a contrasting text color (black or white) for a given background
 * Returns hex color string
 */
export function getContrastingTextColor(backgroundHex: string): string {
  return isLightColor(backgroundHex) ? '#000000' : '#FFFFFF'
}

/**
 * Get a contrasting text color with opacity options
 * Returns an object with primary and muted text colors
 */
export function getContrastingTextColors(backgroundHex: string): {
  primary: string
  muted: string
  mutedOpacity: string
} {
  const isLight = isLightColor(backgroundHex)
  return {
    primary: isLight ? '#000000' : '#FFFFFF',
    muted: isLight ? '#374151' : '#D1D5DB', // gray-700 : gray-300
    mutedOpacity: isLight ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.7)',
  }
}

/**
 * Convert hex to RGB tuple string for CSS variables
 * Example: "#3B82F6" -> "59, 130, 246"
 */
export function hexToRgbTuple(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '128, 128, 128' // Default gray
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`
}

/**
 * Calculate contrast ratio between two colors (WCAG 2.1)
 * Returns a ratio between 1:1 and 21:1
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminance(color1)
  const l2 = getLuminance(color2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if text color meets WCAG AA requirements against background
 * AA requires 4.5:1 for normal text, 3:1 for large text
 */
export function meetsContrastRequirements(
  textColor: string,
  backgroundColor: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(textColor, backgroundColor)
  return isLargeText ? ratio >= 3 : ratio >= 4.5
}
