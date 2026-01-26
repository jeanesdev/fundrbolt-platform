/**
 * Color Utilities Unit Tests
 *
 * Tests for WCAG AA compliant contrast calculation.
 * Validates luminance calculation, contrast ratios, and text color selection.
 */

import { colors as brandColors } from '@fundrbolt/shared/assets'
import { describe, expect, it } from 'vitest'
import {
  calculateLuminance,
  getContrastRatio,
  hexToRgb,
  getContrastingTextColor,
  meetsWCAGAA,
} from '../colors'

const WHITE = brandColors.secondary.white
const BLACK = brandColors.background.dark
const NAVY = brandColors.palette.ink
const PRIMARY_NAVY = brandColors.primary.navy
const MAGENTA = brandColors.accent.magenta
const AQUA = brandColors.accent.aqua
const SUNSET = brandColors.palette.sunset
const COBALT = brandColors.palette.cobalt
const SILVER = brandColors.palette.silver
const CLOUD = brandColors.palette.cloud
const FOG = brandColors.palette.fog
const GOLD = brandColors.primary.gold
const MIDNIGHT = brandColors.palette.midnightSlate
const OBSIDIAN = brandColors.palette.obsidian

const WHITE_RGB = { r: 255, g: 255, b: 255 } as const
const BLACK_RGB = { r: 0, g: 0, b: 0 } as const
const MAGENTA_RGB = { r: 243, g: 90, b: 255 } as const
const AQUA_RGB = { r: 23, g: 204, b: 252 } as const
const SUNSET_RGB = { r: 255, g: 85, b: 51 } as const
const PRIMARY_NAVY_RGB = { r: 17, g: 41, b: 76 } as const

const stripHash = (hex: string) => hex.replace('#', '').toUpperCase()
const ensureShortHex = (hex: string) => {
  if (hex.length !== 6 || hex[0] !== hex[1] || hex[2] !== hex[3] || hex[4] !== hex[5]) {
    throw new Error('Color cannot be represented as 3-digit hex')
  }
  return `${hex[0]}${hex[2]}${hex[4]}`
}

const WHITE_SHORT = ensureShortHex(stripHash(WHITE))
const BLACK_SHORT = ensureShortHex(stripHash(BLACK))
const SUNSET_SHORT = ensureShortHex(stripHash(SUNSET))

const WHITE_NO_PREFIX = stripHash(WHITE)
const NAVY_NO_PREFIX = stripHash(PRIMARY_NAVY)
const MAGENTA_NO_PREFIX = stripHash(MAGENTA)

describe('Color Utilities', () => {
  describe('hexToRgb', () => {
    it('should parse 6-digit hex with # prefix', () => {
      expect(hexToRgb(WHITE)).toEqual(WHITE_RGB)
      expect(hexToRgb(BLACK)).toEqual(BLACK_RGB)
      expect(hexToRgb(MAGENTA)).toEqual(MAGENTA_RGB)
      expect(hexToRgb(AQUA)).toEqual(AQUA_RGB)
    })

    it('should parse 6-digit hex without # prefix', () => {
      expect(hexToRgb(WHITE_NO_PREFIX)).toEqual(WHITE_RGB)
      expect(hexToRgb(NAVY_NO_PREFIX)).toEqual(PRIMARY_NAVY_RGB)
      expect(hexToRgb(MAGENTA_NO_PREFIX)).toEqual(MAGENTA_RGB)
    })

    it('should parse 3-digit hex with # prefix', () => {
      expect(hexToRgb(`#${WHITE_SHORT}`)).toEqual(WHITE_RGB)
      expect(hexToRgb(`#${BLACK_SHORT}`)).toEqual(BLACK_RGB)
      expect(hexToRgb(`#${SUNSET_SHORT}`)).toEqual(SUNSET_RGB)
    })

    it('should parse 3-digit hex without # prefix', () => {
      expect(hexToRgb(WHITE_SHORT)).toEqual(WHITE_RGB)
      expect(hexToRgb(BLACK_SHORT)).toEqual(BLACK_RGB)
      expect(hexToRgb(SUNSET_SHORT)).toEqual(SUNSET_RGB)
    })

    it('should return null for invalid hex', () => {
      expect(hexToRgb('GGGGGG')).toBeNull()
      expect(hexToRgb('#12')).toBeNull()
      expect(hexToRgb('not-hex')).toBeNull()
    })
  })

  describe('calculateLuminance', () => {
    it('should calculate luminance for white (maximum)', () => {
      const luminance = calculateLuminance(255, 255, 255)
      expect(luminance).toBeCloseTo(1.0, 2)
    })

    it('should calculate luminance for black (minimum)', () => {
      const luminance = calculateLuminance(0, 0, 0)
      expect(luminance).toBe(0)
    })

    it('should calculate luminance for gray', () => {
      const luminance = calculateLuminance(128, 128, 128)
      expect(luminance).toBeGreaterThan(0)
      expect(luminance).toBeLessThan(1)
    })

    it('should calculate luminance for red', () => {
      const luminance = calculateLuminance(255, 0, 0)
      expect(luminance).toBeGreaterThan(0)
      expect(luminance).toBeLessThan(1)
    })
  })

  describe('getContrastRatio', () => {
    it('should calculate contrast between white and black (maximum)', () => {
      const whiteLuminance = calculateLuminance(255, 255, 255)
      const blackLuminance = calculateLuminance(0, 0, 0)
      const ratio = getContrastRatio(whiteLuminance, blackLuminance)
      
      expect(ratio).toBeCloseTo(21, 0) // Maximum contrast ratio is 21:1
    })

    it('should calculate contrast between same colors (minimum)', () => {
      const luminance = calculateLuminance(128, 128, 128)
      const ratio = getContrastRatio(luminance, luminance)
      
      expect(ratio).toBe(1) // Same color has 1:1 ratio
    })

    it('should handle luminance values in any order', () => {
      const whiteLuminance = calculateLuminance(255, 255, 255)
      const blackLuminance = calculateLuminance(0, 0, 0)
      
      const ratio1 = getContrastRatio(whiteLuminance, blackLuminance)
      const ratio2 = getContrastRatio(blackLuminance, whiteLuminance)
      
      expect(ratio1).toEqual(ratio2)
    })
  })

  describe('getContrastingTextColor', () => {
    it('should return white for dark backgrounds', () => {
      expect(getContrastingTextColor(BLACK)).toBe(WHITE) // Black
      expect(getContrastingTextColor(NAVY)).toBe(WHITE) // Navy
      expect(getContrastingTextColor(OBSIDIAN)).toBe(WHITE) // Dark gray equivalent
      expect(getContrastingTextColor(MIDNIGHT)).toBe(WHITE)
    })

    it('should return navy for light backgrounds', () => {
      expect(getContrastingTextColor(WHITE)).toBe(NAVY) // White
      expect(getContrastingTextColor(CLOUD)).toBe(NAVY) // Light gray
      expect(getContrastingTextColor(GOLD)).toBe(NAVY) // Gold highlight
    })

    it('should return white for mid-tone backgrounds', () => {
      expect(getContrastingTextColor(COBALT)).toBe(WHITE)
    })

    it('should fallback to white for invalid hex', () => {
      expect(getContrastingTextColor('invalid')).toBe(WHITE)
    })
  })

  describe('meetsWCAGAA', () => {
    it('should pass for white text on black background', () => {
      expect(meetsWCAGAA(WHITE, BLACK)).toBe(true)
    })

    it('should pass for black text on white background', () => {
      expect(meetsWCAGAA(BLACK, WHITE)).toBe(true)
    })

    it('should pass for navy text on white background', () => {
      expect(meetsWCAGAA(NAVY, WHITE)).toBe(true)
    })

    it('should pass for white text on navy background', () => {
      expect(meetsWCAGAA(WHITE, NAVY)).toBe(true)
    })

    it('should fail for similar colors', () => {
      expect(meetsWCAGAA(SILVER, CLOUD)).toBe(false)
      expect(meetsWCAGAA(FOG, SILVER)).toBe(false)
    })

    it('should fail for light gray on white', () => {
      expect(meetsWCAGAA(CLOUD, WHITE)).toBe(false)
    })

    it('should return false for invalid hex colors', () => {
      expect(meetsWCAGAA('invalid', WHITE)).toBe(false)
      expect(meetsWCAGAA(WHITE, 'invalid')).toBe(false)
    })
  })

  describe('Brand accent colors', () => {
    it('should provide accessible text color for accent palette', () => {
      const accentSet = [
        brandColors.accent.plum,
        brandColors.accent.aqua,
        brandColors.accent.violet,
        brandColors.accent.magenta,
      ]

      accentSet.forEach(color => {
        const textColor = getContrastingTextColor(color)
        expect(meetsWCAGAA(textColor, color)).toBe(true)
      })
    })
  })
})
