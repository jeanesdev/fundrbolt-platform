/**
 * Color Utilities Unit Tests
 *
 * Tests for WCAG AA compliant contrast calculation.
 * Validates luminance calculation, contrast ratios, and text color selection.
 */

import { describe, expect, it } from 'vitest'
import {
  calculateLuminance,
  getContrastRatio,
  hexToRgb,
  getContrastingTextColor,
  meetsWCAGAA,
} from '../colors'

describe('Color Utilities', () => {
  describe('hexToRgb', () => {
    it('should parse 6-digit hex with # prefix', () => {
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
      expect(hexToRgb('#FF5733')).toEqual({ r: 255, g: 87, b: 51 })
    })

    it('should parse 6-digit hex without # prefix', () => {
      expect(hexToRgb('FFFFFF')).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb('000000')).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('should parse 3-digit hex with # prefix', () => {
      expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 })
      expect(hexToRgb('#F53')).toEqual({ r: 255, g: 85, b: 51 })
    })

    it('should parse 3-digit hex without # prefix', () => {
      expect(hexToRgb('FFF')).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb('000')).toEqual({ r: 0, g: 0, b: 0 })
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
      expect(getContrastingTextColor('#000000')).toBe('#FFFFFF') // Black
      expect(getContrastingTextColor('#1E293B')).toBe('#FFFFFF') // Navy
      expect(getContrastingTextColor('#333333')).toBe('#FFFFFF') // Dark gray
    })

    it('should return navy for light backgrounds', () => {
      expect(getContrastingTextColor('#FFFFFF')).toBe('#1E293B') // White
      expect(getContrastingTextColor('#F0F0F0')).toBe('#1E293B') // Light gray
      expect(getContrastingTextColor('#FFFF00')).toBe('#1E293B') // Yellow
    })

    it('should return white for mid-tone backgrounds', () => {
      // Most mid-tone colors work better with white text
      expect(getContrastingTextColor('#808080')).toBe('#FFFFFF') // Gray
    })

    it('should fallback to white for invalid hex', () => {
      expect(getContrastingTextColor('invalid')).toBe('#FFFFFF')
    })
  })

  describe('meetsWCAGAA', () => {
    it('should pass for white text on black background', () => {
      expect(meetsWCAGAA('#FFFFFF', '#000000')).toBe(true)
    })

    it('should pass for black text on white background', () => {
      expect(meetsWCAGAA('#000000', '#FFFFFF')).toBe(true)
    })

    it('should pass for navy text on white background', () => {
      expect(meetsWCAGAA('#1E293B', '#FFFFFF')).toBe(true)
    })

    it('should pass for white text on navy background', () => {
      expect(meetsWCAGAA('#FFFFFF', '#1E293B')).toBe(true)
    })

    it('should fail for similar colors', () => {
      expect(meetsWCAGAA('#CCCCCC', '#DDDDDD')).toBe(false)
      expect(meetsWCAGAA('#333333', '#444444')).toBe(false)
    })

    it('should fail for light gray on white', () => {
      expect(meetsWCAGAA('#EEEEEE', '#FFFFFF')).toBe(false)
    })

    it('should return false for invalid hex colors', () => {
      expect(meetsWCAGAA('invalid', '#FFFFFF')).toBe(false)
      expect(meetsWCAGAA('#FFFFFF', 'invalid')).toBe(false)
    })
  })

  describe('Real-world branding colors', () => {
    it('should provide accessible text color for common branding colors', () => {
      // Corporate blue
      const blue = '#0066CC'
      const blueText = getContrastingTextColor(blue)
      expect(meetsWCAGAA(blueText, blue)).toBe(true)

      // Corporate red
      const red = '#CC0000'
      const redText = getContrastingTextColor(red)
      expect(meetsWCAGAA(redText, red)).toBe(true)

      // Corporate green
      const green = '#00AA00'
      const greenText = getContrastingTextColor(green)
      expect(meetsWCAGAA(greenText, green)).toBe(true)

      // Corporate purple
      const purple = '#663399'
      const purpleText = getContrastingTextColor(purple)
      expect(meetsWCAGAA(purpleText, purple)).toBe(true)
    })
  })
})
