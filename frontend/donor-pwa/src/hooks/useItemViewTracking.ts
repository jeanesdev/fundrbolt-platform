/**
 * useItemViewTracking - Hook to track time spent viewing auction items
 *
 * Automatically tracks viewing duration and sends to API when unmounted
 */

import auctionItemService from '@/services/auctionItemService'
import { useEffect, useRef } from 'react'

export interface UseItemViewTrackingOptions {
  eventId: string
  itemId: string | null
  enabled?: boolean
}

/**
 * Hook to track item view duration
 */
export function useItemViewTracking({
  eventId,
  itemId,
  enabled = true,
}: UseItemViewTrackingOptions) {
  const startTimeRef = useRef<number | null>(null)
  const itemIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Skip if disabled or no item
    if (!enabled || !itemId) {
      return
    }

    // Start tracking when item opens
    startTimeRef.current = Date.now()
    itemIdRef.current = itemId

    // Cleanup: Send view duration when item closes or changes
    return () => {
      const startTime = startTimeRef.current
      const trackedItemId = itemIdRef.current

      if (startTime && trackedItemId) {
        const durationMs = Date.now() - startTime
        const durationSeconds = Math.floor(durationMs / 1000)

        // Only track if viewed for at least 1 second
        if (durationSeconds >= 1) {
          auctionItemService.trackItemView(
            eventId,
            trackedItemId,
            durationSeconds,
          ).catch((err) => {
            console.error('[ViewTracking] Failed to record view:', err)
          })
        }

        // Reset refs
        startTimeRef.current = null
        itemIdRef.current = null
      }
    }
  }, [enabled, eventId, itemId])
}

export default useItemViewTracking
