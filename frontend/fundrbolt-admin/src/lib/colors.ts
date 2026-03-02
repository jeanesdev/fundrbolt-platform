import { colors as brandColors } from '@fundrbolt/shared/assets'

/**
 * Color Utilities
 * WCAG AA Compliant Contrast Calculation
 *
 * Implements WCAG 2.1 Level AA contrast ratio requirements (4.5:1 for normal text).
 * Used for generating accessible initial avatars with automatic text color adjustment.
 *
 * References:
 * - WCAG 2.1: https://www.w3.org/TR/WCAG21/#contrast-minimum
 * - Relative Luminance: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

/**
 * Calculate relative luminance of an RGB color
 * Formula from WCAG 2.1 spec
 *
 * @param r - Red channel (0-255)
 * @param g - Green channel (0-255)
 * @param b - Blue channel (0-255)
 * @returns Relative luminance (0-1)
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  // Normalize RGB values to 0-1 range
  const rsRGB = r / 255
  const gsRGB = g / 255
  const bsRGB = b / 255

  // Apply gamma correction for each channel
  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4)
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4)
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4)

  // Calculate relative luminance using coefficients from WCAG spec
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear
}

/**
 * Calculate contrast ratio between two colors
 * Formula from WCAG 2.1 spec: (L1 + 0.05) / (L2 + 0.05)
 * where L1 is the lighter color and L2 is the darker color
 *
 * @param luminance1 - Relative luminance of first color (0-1)
 * @param luminance2 - Relative luminance of second color (0-1)
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(luminance1: number, luminance2: number): number {
  const lighter = Math.max(luminance1, luminance2)
  const darker = Math.min(luminance1, luminance2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Parse hex color to RGB components
 * Supports both 3-digit and 6-digit hex formats with optional # prefix
 *
 * @param hex - Hex color string (e.g., "#FFF", "#FFFFFF", "FFF", "FFFFFF")
 * @returns RGB object with r, g, b properties (0-255) or null if invalid
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # prefix if present
  const cleanHex = hex.replace(/^#/, '')

  // Validate hex format
  if (!/^([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(cleanHex)) {
    return null
  }

  // Handle 3-digit hex (e.g., "FFF" -> "FFFFFF")
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(char => char + char).join('')
    : cleanHex

  const r = parseInt(fullHex.substring(0, 2), 16)
  const g = parseInt(fullHex.substring(2, 4), 16)
  const b = parseInt(fullHex.substring(4, 6), 16)

  return { r, g, b }
}

/**
 * Determine best text color (white or navy) for a given background color
 * Ensures WCAG AA compliance (4.5:1 minimum contrast ratio)
 *
 * @param bgHex - Background color in hex format
 * @returns "white" (#FFFFFF) or "navy" (#1E293B) for optimal contrast
 */
export function getContrastingTextColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex)
  if (!rgb) {
    // Fallback to white if hex parsing fails
    return brandColors.secondary.white
  }

  const bgLuminance = calculateLuminance(rgb.r, rgb.g, rgb.b)

  const whiteRgb = hexToRgb(brandColors.secondary.white)!
  const whiteLuminance = calculateLuminance(whiteRgb.r, whiteRgb.g, whiteRgb.b)
  const whiteContrast = getContrastRatio(bgLuminance, whiteLuminance)

  const navyRgb = hexToRgb(brandColors.palette.ink)!
  const navyLuminance = calculateLuminance(navyRgb.r, navyRgb.g, navyRgb.b)
  const navyContrast = getContrastRatio(bgLuminance, navyLuminance)

  // Return color with better contrast (prefer white for better readability)
  return whiteContrast >= navyContrast
    ? brandColors.secondary.white
    : brandColors.palette.ink
}

/**
 * Check if color combination meets WCAG AA standard (4.5:1 for normal text)
 *
 * @param foregroundHex - Foreground/text color in hex format
 * @param backgroundHex - Background color in hex format
 * @returns true if contrast ratio >= 4.5:1
 */
export function meetsWCAGAA(foregroundHex: string, backgroundHex: string): boolean {
  const fgRgb = hexToRgb(foregroundHex)
  const bgRgb = hexToRgb(backgroundHex)

  if (!fgRgb || !bgRgb) {
    return false
  }

  const fgLuminance = calculateLuminance(fgRgb.r, fgRgb.g, fgRgb.b)
  const bgLuminance = calculateLuminance(bgRgb.r, bgRgb.g, bgRgb.b)
  const contrastRatio = getContrastRatio(fgLuminance, bgLuminance)

  return contrastRatio >= 4.5
}
