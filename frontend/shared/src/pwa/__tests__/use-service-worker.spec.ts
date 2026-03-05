import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock the virtual module before importing the hook
const mockUpdateSW = vi.fn().mockResolvedValue(undefined)
const mockSetOfflineReady = vi.fn()
const mockSetNeedRefresh = vi.fn()

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(({ onRegisteredSW }: { onRegisteredSW?: (url: string, r: unknown) => void } = {}) => {
    // Simulate calling onRegisteredSW with a mock registration
    if (onRegisteredSW) {
      setTimeout(() => onRegisteredSW('sw.js', { update: vi.fn() }), 0)
    }
    return {
      offlineReady: [false, mockSetOfflineReady],
      needRefresh: [false, mockSetNeedRefresh],
      updateServiceWorker: mockUpdateSW,
    }
  }),
}))

// Import after mock
import { useServiceWorker } from '../use-service-worker'

describe('useServiceWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns offlineReady and needRefresh from useRegisterSW', () => {
    const { result } = renderHook(() => useServiceWorker())
    expect(result.current.offlineReady).toBe(false)
    expect(result.current.needRefresh).toBe(false)
  })

  it('exposes updateServiceWorker function', () => {
    const { result } = renderHook(() => useServiceWorker())
    expect(typeof result.current.updateServiceWorker).toBe('function')
  })

  it('dismissOfflineReady calls setter with false', () => {
    const { result } = renderHook(() => useServiceWorker())
    act(() => {
      result.current.dismissOfflineReady()
    })
    expect(mockSetOfflineReady).toHaveBeenCalledWith(false)
  })

  it('dismissUpdate calls setter with false', () => {
    const { result } = renderHook(() => useServiceWorker())
    act(() => {
      result.current.dismissUpdate()
    })
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false)
  })
})
