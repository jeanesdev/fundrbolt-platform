import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDebugSpoofStore } from '@/stores/debug-spoof-store'

describe('debug-spoof-store', () => {
  beforeEach(() => {
    vi.useRealTimers()
    useDebugSpoofStore.getState().reset()
  })

  it('returns real time when spoofing is disabled', () => {
    const now = Date.now()
    const effectiveNow = useDebugSpoofStore.getState().getEffectiveNowMs()

    expect(Math.abs(effectiveNow - now)).toBeLessThan(100)
  })

  it('advances spoofed time relative to real elapsed time', () => {
    vi.useFakeTimers()

    const spoofDate = new Date('2026-02-19T12:00:00.000Z')
    useDebugSpoofStore.getState().setSpoofedTime(spoofDate)

    const start = useDebugSpoofStore.getState().getEffectiveNowMs()
    expect(start).toBe(spoofDate.getTime())

    vi.advanceTimersByTime(30_000)

    const after = useDebugSpoofStore.getState().getEffectiveNowMs()
    expect(after).toBe(spoofDate.getTime() + 30_000)
  })

  it('stores and clears spoofed user identity', () => {
    useDebugSpoofStore.getState().setSpoofedUser('user-123', 'Test User')

    expect(useDebugSpoofStore.getState().spoofedUser).toEqual({
      id: 'user-123',
      label: 'Test User',
    })

    useDebugSpoofStore.getState().clearSpoofedUser()

    expect(useDebugSpoofStore.getState().spoofedUser).toBeNull()
  })
})
