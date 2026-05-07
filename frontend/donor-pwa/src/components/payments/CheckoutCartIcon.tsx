/**
 * CheckoutCartIcon — shaking cart icon with red item-count badge.
 * Appears in page headers when the organizer has opened checkout and
 * the session is not yet complete. Clicking navigates to the checkout page.
 */
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ShoppingCart } from 'lucide-react'
import { getCheckoutSession, getCheckoutStatus } from '@/lib/api/checkout'

interface CheckoutCartIconProps {
  eventId: string
  eventSlug: string
  /** 'hero' for transparent overlay (white icon), 'header' for sticky headers (muted icon) */
  variant?: 'hero' | 'header'
}

export function CheckoutCartIcon({
  eventId,
  eventSlug,
  variant = 'hero',
}: CheckoutCartIconProps) {
  const navigate = useNavigate()

  const { data: status } = useQuery({
    queryKey: ['checkout-status', eventId],
    queryFn: () => getCheckoutStatus(eventId),
    staleTime: 10_000,
    refetchInterval: 10_000,
  })

  const isPending =
    (status?.donor_visible ?? false) && status?.session_status !== 'complete'

  const { data: session } = useQuery({
    queryKey: ['checkout-session', eventId],
    queryFn: () => getCheckoutSession(eventId),
    enabled: isPending,
    staleTime: 10_000,
    refetchInterval: 10_000,
  })

  if (!isPending) return null

  const itemCount = session?.items.filter((i) => !i.deleted_at).length ?? 0

  const colorClasses =
    variant === 'hero'
      ? 'text-white/90 hover:bg-white/10 hover:text-white'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'

  return (
    <button
      type='button'
      onClick={() =>
        void navigate({
          to: '/events/$slug/checkout',
          params: { slug: eventSlug },
        })
      }
      className={`relative inline-flex items-center justify-center rounded-lg p-2 transition-colors ${colorClasses}`}
      aria-label={`Checkout${itemCount > 0 ? ` (${itemCount} item${itemCount !== 1 ? 's' : ''})` : ''}`}
    >
      <ShoppingCart className='animate-cart-shake h-5 w-5' />
      {itemCount > 0 && (
        <span className='absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none font-bold text-white'>
          {itemCount > 9 ? '9+' : itemCount}
        </span>
      )}
    </button>
  )
}
