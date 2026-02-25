import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const STORAGE_KEY = 'fundrbolt-admin-debug-spoof-storage'

interface DebugSpoofState {
  timeBaseRealMs: number | null
  timeBaseSpoofMs: number | null
  setSpoofedTime: (date: Date) => void
  clearSpoofedTime: () => void
  getEffectiveNowMs: () => number
  getEffectiveNowIso: () => string | null
  reset: () => void
}

export const useDebugSpoofStore = create<DebugSpoofState>()(
  persist(
    (set, get) => ({
      timeBaseRealMs: null,
      timeBaseSpoofMs: null,

      setSpoofedTime: (date) =>
        set({
          timeBaseRealMs: Date.now(),
          timeBaseSpoofMs: date.getTime(),
        }),

      clearSpoofedTime: () =>
        set({
          timeBaseRealMs: null,
          timeBaseSpoofMs: null,
        }),

      getEffectiveNowMs: () => {
        const { timeBaseRealMs, timeBaseSpoofMs } = get()
        if (timeBaseRealMs === null || timeBaseSpoofMs === null) {
          return Date.now()
        }

        return timeBaseSpoofMs + (Date.now() - timeBaseRealMs)
      },

      getEffectiveNowIso: () => {
        const { timeBaseSpoofMs } = get()
        if (timeBaseSpoofMs === null) {
          return null
        }
        return new Date(get().getEffectiveNowMs()).toISOString()
      },

      reset: () =>
        set({
          timeBaseRealMs: null,
          timeBaseSpoofMs: null,
        }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        timeBaseRealMs: state.timeBaseRealMs,
        timeBaseSpoofMs: state.timeBaseSpoofMs,
      }),
    }
  )
)
