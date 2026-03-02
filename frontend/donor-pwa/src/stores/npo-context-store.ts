/**
 * NPO Context Zustand Store
 * Manages the currently selected NPO context for filtering data across the admin PWA
 *
 * Business Rules:
 * - SuperAdmin can select any NPO or "Fundrbolt Platform" (null npoId)
 * - NPO Admin sees only their assigned NPO (non-selectable)
 * - Event Coordinator sees NPOs they're registered with
 * - Staff sees only their assigned NPO (non-selectable)
 * - Selection persists across sessions via localStorage
 * - Cleared on logout
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface NPOContextOption {
  id: string | null // null represents "Fundrbolt Platform" for SuperAdmin
  name: string
  logo_url?: string | null
}

interface NPOContextState {
  // Currently selected NPO
  selectedNpoId: string | null
  selectedNpoName: string

  // Available NPO options for current user (populated on login based on role)
  availableNpos: NPOContextOption[]

  // Loading state
  isLoading: boolean
  error: string | null

  // Actions
  setSelectedNpo: (npoId: string | null, npoName: string) => void
  setAvailableNpos: (npos: NPOContextOption[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void

  // Helper getters
  getSelectedNpoId: () => string | null
  isFundrBoltPlatformView: () => boolean
}

export const useNPOContextStore = create<NPOContextState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedNpoId: null,
      selectedNpoName: 'Fundrbolt Platform',
      availableNpos: [],
      isLoading: false,
      error: null,

      // Setters
      setSelectedNpo: (npoId, npoName) =>
        set({
          selectedNpoId: npoId,
          selectedNpoName: npoName,
          error: null
        }),

      setAvailableNpos: (npos) =>
        set({ availableNpos: npos }),

      setLoading: (loading) =>
        set({ isLoading: loading }),

      setError: (error) =>
        set({ error }),

      reset: () =>
        set({
          selectedNpoId: null,
          selectedNpoName: 'Fundrbolt Platform',
          availableNpos: [],
          isLoading: false,
          error: null,
        }),

      // Getters
      getSelectedNpoId: (): string | null => {
        return get().selectedNpoId
      },

      isFundrBoltPlatformView: (): boolean => {
        return get().selectedNpoId === null
      },
    }),
    {
      name: 'fundrbolt-npo-context-storage',
      partialize: (state) => ({
        selectedNpoId: state.selectedNpoId,
        selectedNpoName: state.selectedNpoName,
      }),
    }
  )
)
