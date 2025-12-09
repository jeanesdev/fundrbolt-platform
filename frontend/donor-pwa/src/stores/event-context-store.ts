/**
 * Event Context Zustand Store
 * Manages the currently selected event context for the donor PWA
 *
 * Business Rules:
 * - Donors see only events they are registered for
 * - Users with admin access see events they have admin access to
 * - Selection persists across sessions via localStorage
 * - Cleared on logout
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface EventContextOption {
  id: string
  name: string
  slug: string
  event_date?: string | null
  npo_name?: string | null
  logo_url?: string | null
  has_admin_access?: boolean // True if user is admin/staff for this event
}

interface EventContextState {
  // Currently selected event
  selectedEventId: string | null
  selectedEventName: string
  selectedEventSlug: string | null

  // Available event options for current user (populated on login)
  availableEvents: EventContextOption[]

  // Loading state
  isLoading: boolean
  error: string | null

  // Actions
  setSelectedEvent: (eventId: string | null, eventName: string, eventSlug: string | null) => void
  setAvailableEvents: (events: EventContextOption[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void

  // Helper getters
  getSelectedEventId: () => string | null
  getSelectedEventSlug: () => string | null
}

export const useEventContextStore = create<EventContextState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedEventId: null,
      selectedEventName: 'Select Event',
      selectedEventSlug: null,
      availableEvents: [],
      isLoading: false,
      error: null,

      // Setters
      setSelectedEvent: (eventId, eventName, eventSlug) =>
        set({
          selectedEventId: eventId,
          selectedEventName: eventName,
          selectedEventSlug: eventSlug,
          error: null,
        }),

      setAvailableEvents: (events) => set({ availableEvents: events }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      reset: () =>
        set({
          selectedEventId: null,
          selectedEventName: 'Select Event',
          selectedEventSlug: null,
          availableEvents: [],
          isLoading: false,
          error: null,
        }),

      // Getters
      getSelectedEventId: (): string | null => {
        return get().selectedEventId
      },

      getSelectedEventSlug: (): string | null => {
        return get().selectedEventSlug
      },
    }),
    {
      name: 'augeo-event-context-storage',
      partialize: (state) => ({
        selectedEventId: state.selectedEventId,
        selectedEventName: state.selectedEventName,
        selectedEventSlug: state.selectedEventSlug,
      }),
    }
  )
)
