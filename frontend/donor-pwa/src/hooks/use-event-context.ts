/**
 * useEventContext Hook
 * Manages event context state with query invalidation for the donor PWA
 *
 * Business Rules:
 * - Donors see events they are registered for
 * - Admin users see events they have admin access to
 * - Changes to event selection navigate to that event's page
 * - Invalidates TanStack Query cache on event change
 */

import {
  useEventContextStore,
  type EventContextOption,
} from '@/stores/event-context-store'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

export interface UseEventContextReturn {
  selectedEventId: string | null
  selectedEventName: string
  selectedEventSlug: string | null
  availableEvents: EventContextOption[]
  isLoading: boolean
  error: string | null

  // Actions
  selectEvent: (event: EventContextOption) => void
  setAvailableEvents: (events: EventContextOption[]) => void

  // Helpers
  hasEvents: boolean
  eventCount: number
}

export function useEventContext(): UseEventContextReturn {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const {
    selectedEventId,
    selectedEventName,
    selectedEventSlug,
    availableEvents,
    isLoading,
    error,
    setSelectedEvent,
    setAvailableEvents: storeSetAvailableEvents,
  } = useEventContextStore()

  const hasEvents = availableEvents.length > 0
  const eventCount = availableEvents.length

  // Auto-select first event if none selected and events are available
  useEffect(() => {
    if (!selectedEventId && availableEvents.length > 0) {
      const firstEvent = availableEvents[0]
      setSelectedEvent(firstEvent.id, firstEvent.name, firstEvent.slug)
    }
  }, [selectedEventId, availableEvents, setSelectedEvent])

  // Select event and navigate to it
  const selectEvent = useCallback(
    (event: EventContextOption) => {
      // Update store
      setSelectedEvent(event.id, event.name, event.slug)

      // Invalidate queries to refetch with new event context
      queryClient.invalidateQueries()

      // Navigate to the event page
      navigate({ to: '/events/$eventId', params: { eventId: event.id } })
    },
    [setSelectedEvent, queryClient, navigate]
  )

  const setAvailableEvents = useCallback(
    (events: EventContextOption[]) => {
      storeSetAvailableEvents(events)

      // Auto-select first event if we have events and none selected
      if (events.length > 0 && !selectedEventId) {
        const firstEvent = events[0]
        setSelectedEvent(firstEvent.id, firstEvent.name, firstEvent.slug)
      }
    },
    [storeSetAvailableEvents, selectedEventId, setSelectedEvent]
  )

  return {
    selectedEventId,
    selectedEventName,
    selectedEventSlug,
    availableEvents,
    isLoading,
    error,
    selectEvent,
    setAvailableEvents,
    hasEvents,
    eventCount,
  }
}
