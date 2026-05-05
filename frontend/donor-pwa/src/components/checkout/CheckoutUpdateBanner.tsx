/**
 * CheckoutUpdateBanner — T020
 *
 * Sticky amber banner shown when the organizer has updated checkout items.
 * Auto-acknowledges when scrolled fully out of view.
 */
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export interface CheckoutUpdateBannerProps {
  onAcknowledge: () => void
}

export function CheckoutUpdateBanner({
  onAcknowledge,
}: CheckoutUpdateBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Auto-acknowledge when banner scrolls fully out of view
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.intersectionRatio === 0) {
          onAcknowledge()
        }
      },
      { threshold: 0 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [onAcknowledge])

  function handleDismiss() {
    setDismissed(true)
    onAcknowledge()
  }

  if (dismissed) return null

  return (
    <div
      ref={ref}
      className='sticky top-0 z-30 flex items-center gap-3 bg-amber-400 px-4 py-3 text-amber-950 shadow-sm'
    >
      <p className='flex-1 text-sm font-medium'>
        Your items were updated by the organizer. Please review before
        confirming.
      </p>
      <button
        type='button'
        aria-label='Dismiss update notice'
        onClick={handleDismiss}
        className='shrink-0 rounded-full p-0.5 transition-colors hover:bg-amber-500'
      >
        <X className='h-4 w-4' />
      </button>
    </div>
  )
}

export default CheckoutUpdateBanner
