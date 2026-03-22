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
  status?: string // e.g. 'draft', 'published', 'cancelled'
  event_date?: string | null
  npo_name?: string | null
  logo_url?: string | null
  is_registered?: boolean // True only when donor registration is complete
  has_ticket_access?: boolean // True when donor owns tickets but is not registered
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

      setAvailableEvents: (events) => {
        const { selectedEventSlug, selectedEventId } = get()
        // Find the event matching the persisted selection by ID (most stable)
        // or by slug. If found by ID but slug changed, update the persisted slug
        // so redirects use the current slug. If not found at all, clear the
        // stale selection so the user isn't redirected to a 404.
        if (events.length === 0) {
          set({ availableEvents: events })
          return
        }
        const matchById = events.find((e) => e.id === selectedEventId)
        const matchBySlug = events.find((e) => e.slug === selectedEventSlug)
        if (matchById) {
          // Event still exists — update slug in case it was renamed
          set({
            availableEvents: events,
            selectedEventSlug: matchById.slug,
            selectedEventName: matchById.name,
          })
        } else if (matchBySlug) {
          // Found only by slug (no ID stored, or ID changed) — keep as-is
          set({ availableEvents: events })
        } else {
          // Event no longer accessible — clear stale selection
          set({
            availableEvents: events,
            selectedEventId: null,
            selectedEventName: 'Select Event',
            selectedEventSlug: null,
          })
        }
      },

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
      name: 'fundrbolt-event-context-storage',
      partialize: (state) => ({
        selectedEventId: state.selectedEventId,
        selectedEventName: state.selectedEventName,
        selectedEventSlug: state.selectedEventSlug,
      }),
    }
  )
)
