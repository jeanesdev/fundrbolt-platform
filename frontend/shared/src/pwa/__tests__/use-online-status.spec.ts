import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnlineStatus } from '../use-online-status'

describe('useOnlineStatus', () => {
  const originalOnLine = navigator.onLine
  let listeners: Record<string, Set<EventListener>>

  beforeEach(() => {
    listeners = { online: new Set(), offline: new Set() }
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      listeners[event]?.add(handler as EventListener)
    })
    vi.spyOn(window, 'removeEventListener').mockImplementation((event, handler) => {
      listeners[event]?.delete(handler as EventListener)
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('returns false when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it('registers online and offline event listeners', () => {
    renderHook(() => useOnlineStatus())
    expect(listeners.online.size).toBe(1)
    expect(listeners.offline.size).toBe(1)
  })

  it('transitions from online to offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => {
      listeners.offline.forEach((fn) => fn(new Event('offline')))
    })
    expect(result.current).toBe(false)
  })

  it('transitions from offline to online', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)

    act(() => {
      listeners.online.forEach((fn) => fn(new Event('online')))
    })
    expect(result.current).toBe(true)
  })

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useOnlineStatus())
    expect(listeners.online.size).toBe(1)

    unmount()
    expect(listeners.online.size).toBe(0)
    expect(listeners.offline.size).toBe(0)
  })
})
