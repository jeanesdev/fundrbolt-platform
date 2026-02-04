/**
 * useEventContext Hook
 * Manages event context state with smart defaults and query invalidation
 *
 * Business Rules:
 * - Auto-selects event using smart defaults: Active → Upcoming → Past
 * - Manual selection overrides smart defaults and persists
 * - Clears event selection when NPO changes
 * - Changes to event selection invalidate TanStack Query cache for event-specific data
 * - Loads available events filtered by current NPO
 */

import { useEventContextStore, type EventContextOption } from '@/stores/event-context-store'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { useNpoContext } from './use-npo-context'
import { eventApi } from '@/services/event-service'

export interface UseEventContextReturn {
  selectedEventId: string | null
  selectedEventName: string | null
  selectedEventSlug: string | null
  isManualSelection: boolean
  availableEvents: EventContextOption[]
  isLoading: boolean
  error: string | null

  // Actions
  selectEvent: (eventId: string, eventName: string, eventSlug: string) => void
  clearEvent: () => void

  // Helpers
  isEventSelected: boolean
  hasMultipleEvents: boolean
  shouldShowSearch: boolean // True when 10+ events (per FR-006a)
}

export function useEventContext(): UseEventContextReturn {
  const queryClient = useQueryClient()
  const { selectedNpoId } = useNpoContext()

  const {
    selectedEventId,
    selectedEventName,
    selectedEventSlug,
    isManualSelection,
    availableEvents,
    eventsLoading: storeLoading,
    eventsError: storeError,
    selectEvent: storeSelectEvent,
    clearEvent: storeClearEvent,
    setAvailableEvents,
    applySmartDefault,
    isEventSelected: storeIsEventSelected,
  } = useEventContextStore()

  const isEventSelected = storeIsEventSelected()
  const hasMultipleEvents = availableEvents.length > 1
  const shouldShowSearch = availableEvents.length >= 10

  // Fetch events for current NPO
  const { data, isLoading: queryLoading, error: queryError } = useQuery({
    queryKey: ['events', 'list', { npoId: selectedNpoId }],
    queryFn: async () => {
      const response = await eventApi.listEvents({
        npo_id: selectedNpoId || undefined,
        page: 1,
        page_size: 1000, // Fetch all events for selector
      })
      return response
    },
    enabled: !!selectedNpoId, // Only fetch when NPO is selected
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Update available events and apply smart default when events data changes
  useEffect(() => {
    if (data?.items) {
      const eventOptions: EventContextOption[] = data.items.map((event) => ({
        id: event.id,
        name: event.name,
        slug: event.slug,
        status: event.status,
        event_datetime: event.event_datetime,
      }))

      setAvailableEvents(eventOptions)

      // Apply smart default only if no manual selection exists
      if (!isManualSelection) {
        applySmartDefault()
      }
    }
  }, [data, isManualSelection, setAvailableEvents, applySmartDefault])

  // Clear event selection when NPO changes
  useEffect(() => {
    storeClearEvent()
  }, [selectedNpoId, storeClearEvent])

  // Select event with manual flag and invalidate queries
  const selectEvent = useCallback(
    (eventId: string, eventName: string, eventSlug: string) => {
      // Update store with manual selection flag
      storeSelectEvent(eventId, eventName, eventSlug, true)

      // Invalidate event-specific queries to refetch with new context
      queryClient.invalidateQueries({ queryKey: ['events', eventId] })
      queryClient.invalidateQueries({ queryKey: ['event-stats', eventId] })
    },
    [storeSelectEvent, queryClient]
  )

  // Clear event selection
  const clearEvent = useCallback(() => {
    storeClearEvent()
    queryClient.invalidateQueries({ queryKey: ['events'] })
  }, [storeClearEvent, queryClient])

  // Combine store loading and query loading states
  const isLoading = storeLoading || queryLoading

  // Combine store error and query error
  const error = storeError || (queryError ? String(queryError) : null)

  return {
    selectedEventId,
    selectedEventName,
    selectedEventSlug,
    isManualSelection,
    availableEvents,
    isLoading,
    error,
    selectEvent,
    clearEvent,
    isEventSelected,
    hasMultipleEvents,
    shouldShowSearch,
  }
}
