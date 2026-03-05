import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useInstallPrompt } from '../use-install-prompt'

describe('useInstallPrompt', () => {
  let listeners: Record<string, Set<EventListener>>
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    listeners = { beforeinstallprompt: new Set(), appinstalled: new Set() }
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      listeners[event]?.add(handler as EventListener)
    })
    vi.spyOn(window, 'removeEventListener').mockImplementation((event, handler) => {
      listeners[event]?.delete(handler as EventListener)
    })
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
  })

  it('starts with canShow false when no beforeinstallprompt fired', () => {
    const { result } = renderHook(() => useInstallPrompt('test-app'))
    expect(result.current.canShow).toBe(false)
  })

  it('detects iOS from user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      configurable: true,
    })
    const { result } = renderHook(() => useInstallPrompt('test-app'))
    expect(result.current.isIOS).toBe(true)
  })

  it('detects installed state via matchMedia standalone', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    const { result } = renderHook(() => useInstallPrompt('test-app'))
    expect(result.current.isInstalled).toBe(true)
  })

  it('dismiss writes timestamp to localStorage scoped by appId', () => {
    const { result } = renderHook(() => useInstallPrompt('my-app'))
    act(() => {
      result.current.dismiss()
    })
    const key = 'pwa-install-dismissed-my-app'
    expect(localStorage.getItem(key)).toBeTruthy()
  })

  it('respects cooldown period from localStorage', () => {
    const key = 'pwa-install-dismissed-test'
    localStorage.setItem(key, String(Date.now())) // just dismissed
    const { result } = renderHook(() => useInstallPrompt('test'))
    // Even if beforeinstallprompt fires, cooldown should prevent canShow
    expect(result.current.canShow).toBe(false)
  })

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useInstallPrompt('test'))
    expect(listeners.beforeinstallprompt.size).toBeGreaterThan(0)
    unmount()
    expect(listeners.beforeinstallprompt.size).toBe(0)
  })
})
