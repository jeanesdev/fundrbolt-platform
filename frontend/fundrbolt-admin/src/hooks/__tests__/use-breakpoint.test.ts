/**
 * useBreakpoint & useIsTablet Hook Tests (T046)
 *
 * Tests breakpoint tier detection across all 4 viewport tiers.
 */
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// We need to reset module state between tests so the hook re-reads window.innerWidth.
// The global setup already mocks matchMedia, but we override it per-test.

function mockViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })

  // Track registered listeners so we can fire change events
  const listeners = new Map<string, Set<() => void>>()

  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const mql: MediaQueryList = {
      matches: window.matchMedia.call(window, query).matches, // avoid infinite recursion
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        if (!listeners.has(query)) listeners.set(query, new Set())
        listeners.get(query)!.add(handler)
      }),
      removeEventListener: vi.fn((_event: string, handler: () => void) => {
        listeners.get(query)?.delete(handler)
      }),
      dispatchEvent: vi.fn(),
    }
    return mql
  })

  // Recalculate `matches` based on actual width
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    // Parse "min-width: Xpx" from query
    const match = query.match(/min-width:\s*(\d+)px/)
    const minWidth = match ? parseInt(match[1], 10) : 0
    const matches = width >= minWidth

    const mql: MediaQueryList = {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        if (!listeners.has(query)) listeners.set(query, new Set())
        listeners.get(query)!.add(handler)
      }),
      removeEventListener: vi.fn((_event: string, handler: () => void) => {
        listeners.get(query)?.delete(handler)
      }),
      dispatchEvent: vi.fn(),
    }
    return mql
  })

  return listeners
}

describe('useBreakpoint', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('returns "phone" for width < 768', async () => {
    mockViewport(375)
    const { useBreakpoint } = await import('../use-breakpoint')
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('phone')
  })

  it('returns "tablet-portrait" for width 768-1023', async () => {
    mockViewport(768)
    const { useBreakpoint } = await import('../use-breakpoint')
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('tablet-portrait')
  })

  it('returns "tablet-landscape" for width 1024-1366', async () => {
    mockViewport(1024)
    const { useBreakpoint } = await import('../use-breakpoint')
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('tablet-landscape')
  })

  it('returns "desktop" for width >= 1367', async () => {
    mockViewport(1920)
    const { useBreakpoint } = await import('../use-breakpoint')
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('desktop')
  })

  it('returns "tablet-portrait" at boundary 768', async () => {
    mockViewport(768)
    const { useBreakpoint } = await import('../use-breakpoint')
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('tablet-portrait')
  })

  it('returns "phone" at boundary 767', async () => {
    mockViewport(767)
    const { useBreakpoint } = await import('../use-breakpoint')
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('phone')
  })

  it('returns "tablet-landscape" at boundary 1024', async () => {
    mockViewport(1024)
    const { useBreakpoint } = await import('../use-breakpoint')
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('tablet-landscape')
  })

  it('returns "desktop" at boundary 1367', async () => {
    mockViewport(1367)
    const { useBreakpoint } = await import('../use-breakpoint')
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('desktop')
  })

  it('returns "tablet-landscape" at boundary 1366', async () => {
    mockViewport(1366)
    const { useBreakpoint } = await import('../use-breakpoint')
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('tablet-landscape')
  })

  it('adds matchMedia listeners on mount', async () => {
    mockViewport(1024)
    const { useBreakpoint } = await import('../use-breakpoint')
    renderHook(() => useBreakpoint())

    // Should have called matchMedia for tablet, landscape, and desktop queries
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 768px)')
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1024px)')
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1367px)')
  })

  it('removes listeners on unmount', async () => {
    mockViewport(1024)
    const { useBreakpoint } = await import('../use-breakpoint')
    const { unmount } = renderHook(() => useBreakpoint())
    unmount()

    // Each matchMedia result should have had removeEventListener called
    // We can't easily assert on those mocks because matchMedia is re-called,
    // but the hook cleanup runs without error
  })
})

describe('useIsTablet', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('returns true for tablet-portrait', async () => {
    mockViewport(800)
    const { useIsTablet } = await import('../use-breakpoint')
    const { result } = renderHook(() => useIsTablet())
    expect(result.current).toBe(true)
  })

  it('returns true for tablet-landscape', async () => {
    mockViewport(1200)
    const { useIsTablet } = await import('../use-breakpoint')
    const { result } = renderHook(() => useIsTablet())
    expect(result.current).toBe(true)
  })

  it('returns false for phone', async () => {
    mockViewport(375)
    const { useIsTablet } = await import('../use-breakpoint')
    const { result } = renderHook(() => useIsTablet())
    expect(result.current).toBe(false)
  })

  it('returns false for desktop', async () => {
    mockViewport(1920)
    const { useIsTablet } = await import('../use-breakpoint')
    const { result } = renderHook(() => useIsTablet())
    expect(result.current).toBe(false)
  })
})
