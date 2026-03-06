/**
 * useTabSwipe — Horizontal swipe gesture hook for tab navigation
 *
 * Detects left/right swipes on touch devices and calls the appropriate
 * callback to switch tabs. Also prevents the browser's native
 * back/forward navigation gesture by calling preventDefault() on
 * horizontal touchmove events.
 *
 * Thresholds:
 * - Minimum 50px horizontal distance
 * - Horizontal distance must be > 1.5× vertical distance (to avoid
 *   triggering during vertical scroll)
 * - Maximum 300ms swipe duration
 */
import { useCallback, useRef } from 'react'

interface UseTabSwipeOptions {
  /** Called when user swipes left (next tab) */
  onSwipeLeft?: () => void
  /** Called when user swipes right (previous tab) */
  onSwipeRight?: () => void
  /** Minimum horizontal distance in px to register as swipe (default 50) */
  minDistance?: number
  /** Maximum duration in ms for the swipe gesture (default 300) */
  maxDuration?: number
}

export function useTabSwipe({
  onSwipeLeft,
  onSwipeRight,
  minDistance = 50,
  maxDuration = 300,
}: UseTabSwipeOptions) {
  const touchStartRef = useRef<{
    x: number
    y: number
    time: number
  } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.touches[0]
    if (!touch) return

    const dx = Math.abs(touch.clientX - touchStartRef.current.x)
    const dy = Math.abs(touch.clientY - touchStartRef.current.y)

    // If the gesture is primarily horizontal, prevent the browser's
    // native back/forward swipe navigation
    if (dx > 10 && dx > dy * 1.2) {
      e.preventDefault()
    }
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return

      const touch = e.changedTouches[0]
      if (!touch) {
        touchStartRef.current = null
        return
      }

      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      const elapsed = Date.now() - touchStartRef.current.time

      touchStartRef.current = null

      // Guard: must be fast enough and primarily horizontal
      if (elapsed > maxDuration) return
      if (Math.abs(dx) < minDistance) return
      if (Math.abs(dx) < Math.abs(dy) * 1.5) return

      if (dx < 0) {
        // Swiped left → next tab
        onSwipeLeft?.()
      } else {
        // Swiped right → previous tab
        onSwipeRight?.()
      }
    },
    [onSwipeLeft, onSwipeRight, minDistance, maxDuration],
  )

  return { onTouchStart, onTouchMove, onTouchEnd }
}
