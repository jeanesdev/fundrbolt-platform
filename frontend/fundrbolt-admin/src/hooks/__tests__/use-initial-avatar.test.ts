/**
 * useInitialAvatar Hook Unit Tests
 *
 * Tests for initial generation and WCAG compliance.
 */

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useInitialAvatar } from '../use-initial-avatar'

describe('useInitialAvatar', () => {
  describe('Initial Generation', () => {
    it('should generate initials from two-word name', () => {
      const { result } = renderHook(() =>
        useInitialAvatar({ name: 'Fundrbolt Platform' })
      )

      expect(result.current.initials).toBe('FP')
    })

    it('should generate initials from single-word name', () => {
      const { result } = renderHook(() =>
        useInitialAvatar({ name: 'Foundation' })
      )

      expect(result.current.initials).toBe('FO')
    })

    it('should generate initials from multi-word name (first two)', () => {
      const { result } = renderHook(() =>
        useInitialAvatar({ name: 'The Community Foundation Trust' })
      )

      expect(result.current.initials).toBe('TC')
    })

    it('should handle empty name', () => {
      const { result } = renderHook(() =>
        useInitialAvatar({ name: '' })
      )

      expect(result.current.initials).toBe('??')
    })

    it('should uppercase initials', () => {
      const { result } = renderHook(() =>
        useInitialAvatar({ name: 'lowercase name' })
      )

      expect(result.current.initials).toBe('LN')
    })
  })

  describe('Branding Colors', () => {
    it('should use branding primary color as background', () => {
      const { result } = renderHook(() =>
        useInitialAvatar({ name: 'Test', brandingPrimaryColor: '#0066CC' })
      )

      expect(result.current.bgColor).toBe('#0066CC')
    })

    it('should fallback to navy when no branding color', () => {
      const { result } = renderHook(() =>
        useInitialAvatar({ name: 'Test' })
      )

      expect(result.current.bgColor).toBe('#1E293B')
    })

    it('should fallback to navy for invalid branding color', () => {
      const { result } = renderHook(() =>
        useInitialAvatar({ name: 'Test', brandingPrimaryColor: 'invalid' })
      )

      expect(result.current.bgColor).toBe('#1E293B')
    })
  })

  describe('Text Color Contrast', () => {
    it('should use white text for dark backgrounds', () => {
      const { result } = renderHook(() =>
        useInitialAvatar({ name: 'Test', brandingPrimaryColor: '#000000' })
      )

      expect(result.current.textColor).toBe('#FFFFFF')
    })

    it('should use navy text for light backgrounds', () => {
      const { result } = renderHook(() =>
        useInitialAvatar({ name: 'Test', brandingPrimaryColor: '#FFFFFF' })
      )

      expect(result.current.textColor).toBe('#1E293B')
    })
  })

  describe('Border', () => {
    it('should have border for navy background with white text', () => {
      const { result } = renderHook(() =>
        useInitialAvatar({ name: 'Test', brandingPrimaryColor: '#1E293B' })
      )

      expect(result.current.hasBorder).toBe(true)
    })
  })
})
