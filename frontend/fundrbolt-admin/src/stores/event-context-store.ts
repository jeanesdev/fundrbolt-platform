/**
 * Event Context Zustand Store
 * Manages the currently selected event context for event-specific workflows in the admin PWA
 *
 * Business Rules:
 * - Auto-selects event using smart defaults: Active → Upcoming → Past (most recent)
 * - Manual selection overrides smart defaults and persists across navigation
 * - Selection clears when NPO context changes
 * - Persists selected event in localStorage
 * - Loads available events filtered by current NPO
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface EventContextOption {
  id: string
  name: string
  slug: string
  status: string
  event_datetime: string
}

interface EventContextState {
  // Currently selected event
  selectedEventId: string | null
  selectedEventName: string | null
  selectedEventSlug: string | null
  isManualSelection: boolean // User manually picked vs auto-selected

  // Available events for current NPO
  availableEvents: EventContextOption[]
  eventsLoading: boolean
  eventsError: string | null

  // Actions
  selectEvent: (
    eventId: string,
    eventName: string,
    eventSlug: string,
    isManual: boolean
  ) => void
  clearEvent: () => void
  setAvailableEvents: (events: EventContextOption[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void

  // Smart default logic
  applySmartDefault: () => void

  // Helper getters
  getSelectedEventId: () => string | null
  isEventSelected: () => boolean
}

/**
 * Smart default selection logic
 * Priority 1: Active events (status = 'active')
 * Priority 2: Upcoming events (start_date > now, sorted ASC)
 * Priority 3: Past events (start_date < now, sorted DESC - most recent)
 */
function selectSmartDefault(events: EventContextOption[]): EventContextOption | null {
  if (events.length === 0) return null

  const now = new Date()

  // Priority 1: Active events
  const activeEvents = events.filter((e) => e.status === 'active')
  if (activeEvents.length > 0) {
    // Return the next chronologically active event
    return activeEvents.sort((a, b) =>
      new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime()
    )[0]
  }

  // Priority 2: Upcoming events
  const upcomingEvents = events.filter((e) => new Date(e.event_datetime) > now)
  if (upcomingEvents.length > 0) {
    // Return the next chronologically upcoming event
    return upcomingEvents.sort((a, b) =>
      new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime()
    )[0]
  }

  // Priority 3: Past events (most recent first)
  const pastEvents = events.filter((e) => new Date(e.event_datetime) <= now)
  if (pastEvents.length > 0) {
    return pastEvents.sort((a, b) =>
      new Date(b.event_datetime).getTime() - new Date(a.event_datetime).getTime()
    )[0]
  }

  return null
}

export const useEventContextStore = create<EventContextState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedEventId: null,
      selectedEventName: null,
      selectedEventSlug: null,
      isManualSelection: false,
      availableEvents: [],
      eventsLoading: false,
      eventsError: null,

      // Actions
      selectEvent: (eventId, eventName, eventSlug, isManual) => {
        set({
          selectedEventId: eventId,
          selectedEventName: eventName,
          selectedEventSlug: eventSlug,
          isManualSelection: isManual,
          eventsError: null,
        })
      },

      clearEvent: () => {
        set({
          selectedEventId: null,
          selectedEventName: null,
          selectedEventSlug: null,
          isManualSelection: false,
          eventsError: null,
        })
      },

      setAvailableEvents: (events) => {
        set({ availableEvents: events })
      },

      setLoading: (loading) => {
        set({ eventsLoading: loading })
      },

      setError: (error) => {
        set({ eventsError: error })
      },

      reset: () => {
        set({
          selectedEventId: null,
          selectedEventName: null,
          selectedEventSlug: null,
          isManualSelection: false,
          availableEvents: [],
          eventsLoading: false,
          eventsError: null,
        })
      },

      applySmartDefault: () => {
        const { availableEvents, isManualSelection } = get()

        // Don't override manual selections
        if (isManualSelection) return

        const defaultEvent = selectSmartDefault(availableEvents)
        if (defaultEvent) {
          set({
            selectedEventId: defaultEvent.id,
            selectedEventName: defaultEvent.name,
            selectedEventSlug: defaultEvent.slug,
            isManualSelection: false,
            eventsError: null,
          })
        } else {
          // No events available - clear selection
          set({
            selectedEventId: null,
            selectedEventName: null,
            selectedEventSlug: null,
            isManualSelection: false,
          })
        }
      },

      // Getters
      getSelectedEventId: (): string | null => {
        return get().selectedEventId
      },

      isEventSelected: (): boolean => {
        return get().selectedEventId !== null
      },
    }),
    {
      name: 'fundrbolt-event-context-storage',
      partialize: (state) => ({
        selectedEventId: state.selectedEventId,
        selectedEventName: state.selectedEventName,
        selectedEventSlug: state.selectedEventSlug,
        isManualSelection: state.isManualSelection,
      }),
    }
  )
)
