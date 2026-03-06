/**
 * useSwipeDownToClose — detects a vertical swipe-down gesture and calls `onClose`.
 *
 * Attach the returned `onTouchStart` and `onTouchEnd` handlers to the
 * scrollable container (or its wrapper) of a dialog / modal.
 */

import { useCallback, useRef } from 'react';

const SWIPE_THRESHOLD_Y = 80

export function useSwipeDownToClose(onClose: () => void) {
  const touchStartRef = useRef<{ x: number; y: number; scrollTop: number } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLElement>) => {
    const touch = e.touches[0]
    if (!touch) return

    // Record scroll position of the target element (or nearest scrollable parent)
    const scrollable = (e.currentTarget as HTMLElement) ?? null
    const scrollTop = scrollable?.scrollTop ?? 0

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      scrollTop,
    }
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      const start = touchStartRef.current
      if (!start) return

      const touch = e.changedTouches[0]
      if (!touch) return

      const dy = touch.clientY - start.y
      const dx = touch.clientX - start.x

      // Only trigger if:
      // 1. Vertical swipe is dominant (dy > |dx|)
      // 2. Swipe distance exceeds threshold
      // 3. Scroll was at or near top when swipe started (so we don't interfere with scrolling)
      if (
        dy > SWIPE_THRESHOLD_Y &&
        Math.abs(dy) > Math.abs(dx) * 1.5 &&
        start.scrollTop < 10
      ) {
        onClose()
      }

      touchStartRef.current = null
    },
    [onClose],
  )

  return { onTouchStart, onTouchEnd }
}
