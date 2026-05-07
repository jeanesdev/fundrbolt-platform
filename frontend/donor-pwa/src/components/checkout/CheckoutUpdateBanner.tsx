/**
 * CheckoutUpdateBanner — T020
 *
 * Sticky amber banner shown when the organizer has updated checkout items.
 * Dismissed explicitly by the user via the X button or the "Got it" button.
 * (IntersectionObserver auto-dismiss is not used here because sticky elements
 * never leave the viewport, so the observer would never fire.)
 */
import { useState } from 'react'
import { X } from 'lucide-react'

export interface CheckoutUpdateBannerProps {
  onAcknowledge: () => void
}

export function CheckoutUpdateBanner({
  onAcknowledge,
}: CheckoutUpdateBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  function handleDismiss() {
    setDismissed(true)
    onAcknowledge()
  }

  if (dismissed) return null

  return (
    <div className='sticky top-0 z-30 flex items-center gap-3 bg-amber-400 px-4 py-3 text-amber-950 shadow-sm'>
      <p className='flex-1 text-sm font-medium'>
        Your items were updated by the organizer. Review below, then tap{' '}
        <strong>Got it</strong> to continue.
      </p>
      <button
        type='button'
        aria-label='Acknowledge item update'
        onClick={handleDismiss}
        className='shrink-0 rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-700'
      >
        Got it
      </button>
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
