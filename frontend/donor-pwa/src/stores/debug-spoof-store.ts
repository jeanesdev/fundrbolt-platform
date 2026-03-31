import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { useAuthStore } from './auth-store'

const STORAGE_KEY = 'fundrbolt-debug-spoof-storage'

interface SpoofedUser {
  id: string
  label: string
}

interface DebugSpoofState {
  timeBaseRealMs: number | null
  timeBaseSpoofMs: number | null
  spoofedUser: SpoofedUser | null
  setSpoofedTime: (date: Date) => void
  clearSpoofedTime: () => void
  getEffectiveNowMs: () => number
  getEffectiveNowIso: () => string | null
  setSpoofedUser: (id: string, label: string) => void
  clearSpoofedUser: () => void
  reset: () => void
}

export const useDebugSpoofStore = create<DebugSpoofState>()(
  persist(
    (set, get) => ({
      timeBaseRealMs: null,
      timeBaseSpoofMs: null,
      spoofedUser: null,

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
        // Only super_admin users should ever see spoofed time
        const user = useAuthStore.getState().user
        if (user?.role !== 'super_admin') {
          return Date.now()
        }
        const { timeBaseRealMs, timeBaseSpoofMs } = get()
        if (timeBaseRealMs === null || timeBaseSpoofMs === null) {
          return Date.now()
        }

        return timeBaseSpoofMs + (Date.now() - timeBaseRealMs)
      },

      getEffectiveNowIso: () => {
        const user = useAuthStore.getState().user
        if (user?.role !== 'super_admin') {
          return null
        }
        const { timeBaseSpoofMs } = get()
        if (timeBaseSpoofMs === null) {
          return null
        }
        return new Date(get().getEffectiveNowMs()).toISOString()
      },

      setSpoofedUser: (id, label) =>
        set({
          spoofedUser: { id, label },
        }),

      clearSpoofedUser: () =>
        set({
          spoofedUser: null,
        }),

      reset: () =>
        set({
          timeBaseRealMs: null,
          timeBaseSpoofMs: null,
          spoofedUser: null,
        }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        timeBaseRealMs: state.timeBaseRealMs,
        timeBaseSpoofMs: state.timeBaseSpoofMs,
        spoofedUser: state.spoofedUser,
      }),
    }
  )
)

export function getEffectiveNow(): Date {
  return new Date(useDebugSpoofStore.getState().getEffectiveNowMs())
}
