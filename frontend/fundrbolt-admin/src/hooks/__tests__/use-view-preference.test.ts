/**
 * useViewPreference Hook Tests (T047)
 *
 * Tests localStorage read/write, breakpoint-dependent defaults,
 * and explicit preference override.
 */
import { useLocation } from '@tanstack/react-router'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBreakpoint } from '../use-breakpoint'
import { useViewPreference } from '../use-view-preference'

// Track mock pathname so the select-based mock can use it
let mockPathname = '/test-page'

// Mock dependencies — useLocation with TanStack Router's select pattern
vi.mock('@tanstack/react-router', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useLocation: vi.fn((opts?: any) => {
    const loc = { pathname: mockPathname }
    return opts?.select ? opts.select(loc) : loc
  }),
}))

vi.mock('../use-breakpoint', () => ({
  useBreakpoint: vi.fn(() => 'desktop'),
}))

const STORAGE_KEY = 'fundrbolt_view_prefs'

function setMockPathname(p: string) {
  mockPathname = p
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useLocation).mockImplementation((opts?: any) => {
    const loc = { pathname: mockPathname }
    return opts?.select ? opts.select(loc) : loc
  })
}

describe('useViewPreference', () => {
  beforeEach(() => {
    localStorage.clear()
    setMockPathname('/test-page')
    vi.mocked(useBreakpoint).mockReturnValue('desktop')
  })

  describe('default mode by breakpoint', () => {
    it('defaults to "table" on desktop', () => {
      vi.mocked(useBreakpoint).mockReturnValue('desktop')
      const { result } = renderHook(() => useViewPreference())
      expect(result.current[0]).toBe('table')
    })

    it('defaults to "card" on phone', () => {
      vi.mocked(useBreakpoint).mockReturnValue('phone')
      const { result } = renderHook(() => useViewPreference())
      expect(result.current[0]).toBe('card')
    })

    it('defaults to "card" on tablet-portrait', () => {
      vi.mocked(useBreakpoint).mockReturnValue('tablet-portrait')
      const { result } = renderHook(() => useViewPreference())
      expect(result.current[0]).toBe('card')
    })

    it('defaults to "card" on tablet-landscape', () => {
      vi.mocked(useBreakpoint).mockReturnValue('tablet-landscape')
      const { result } = renderHook(() => useViewPreference())
      expect(result.current[0]).toBe('card')
    })
  })

  describe('localStorage persistence', () => {
    it('stores preference when setMode is called', () => {
      const { result } = renderHook(() => useViewPreference())
      act(() => {
        result.current[1]('card')
      })
      expect(result.current[0]).toBe('card')

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored['/test-page']).toBe('card')
    })

    it('reads stored preference on mount', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ '/test-page': 'card' })
      )
      vi.mocked(useBreakpoint).mockReturnValue('desktop')
      const { result } = renderHook(() => useViewPreference())
      // Explicit stored value overrides desktop default of 'table'
      expect(result.current[0]).toBe('card')
    })

    it('uses pageKey override instead of pathname', () => {
      const { result } = renderHook(() => useViewPreference('custom-key'))
      act(() => {
        result.current[1]('card')
      })

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored['custom-key']).toBe('card')
      expect(stored['/test-page']).toBeUndefined()
    })
  })

  describe('breakpoint sync', () => {
    it('syncs to default when breakpoint changes and no stored pref', () => {
      const { result, rerender } = renderHook(() => useViewPreference())
      expect(result.current[0]).toBe('table') // desktop default

      // Simulate breakpoint change to phone
      vi.mocked(useBreakpoint).mockReturnValue('phone')
      rerender()
      expect(result.current[0]).toBe('card')
    })

    it('does NOT sync when explicit preference is stored', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ '/test-page': 'table' })
      )
      vi.mocked(useBreakpoint).mockReturnValue('phone')
      const { result, rerender } = renderHook(() => useViewPreference())

      // Even though phone default is 'card', stored preference is 'table'
      expect(result.current[0]).toBe('table')

      // Change breakpoint — stored pref still wins
      vi.mocked(useBreakpoint).mockReturnValue('tablet-portrait')
      rerender()
      expect(result.current[0]).toBe('table')
    })
  })

  describe('per-page isolation', () => {
    it('stores different preferences per page', () => {
      setMockPathname('/page-a')
      const { result: resultA } = renderHook(() => useViewPreference())
      act(() => {
        resultA.current[1]('card')
      })

      setMockPathname('/page-b')
      const { result: resultB } = renderHook(() => useViewPreference())
      act(() => {
        resultB.current[1]('table')
      })

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored['/page-a']).toBe('card')
      expect(stored['/page-b']).toBe('table')
    })
  })

  describe('error handling', () => {
    it('falls back gracefully when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage disabled')
      })
      vi.mocked(useBreakpoint).mockReturnValue('desktop')

      const { result } = renderHook(() => useViewPreference())
      // Should fall back to default without crashing
      expect(result.current[0]).toBe('table')
    })

    it('does not crash when localStorage.setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage full')
      })
      vi.mocked(useBreakpoint).mockReturnValue('desktop')

      const { result } = renderHook(() => useViewPreference())
      // Should not throw
      act(() => {
        result.current[1]('card')
      })
      expect(result.current[0]).toBe('card')
    })
  })
})
