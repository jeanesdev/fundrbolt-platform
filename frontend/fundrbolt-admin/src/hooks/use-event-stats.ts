/**
 * useEventStats Hook
 * Fetches badge counts for the currently selected event using React Query
 */

import { useQuery } from '@tanstack/react-query'
import { eventApi } from '@/services/event-service'
import type { EventStats } from '@/types/event'

export function useEventStats(eventId?: string | null) {
  return useQuery<EventStats>({
    queryKey: ['event-stats', eventId],
    queryFn: async () => {
      if (!eventId) {
        throw new Error('Event ID is required to load stats')
      }
      return eventApi.getEventStats(eventId)
    },
    enabled: Boolean(eventId),
    staleTime: 30_000,
  })
}
