/**
 * Ticket Listing Page — /events/$slug/tickets
 * Public page showing available ticket packages for an event.
 */
import { TicketPackageCard } from '@/components/tickets/TicketPackageCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getEventBySlug,
  getTicketPackages,
  type PublicTicketPackage,
} from '@/lib/api/events'
import { useAuthStore } from '@/stores/auth-store'
import { useTicketCartStore } from '@/stores/ticket-cart-store'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AlertCircle,
  CalendarDays,
  LogIn,
  MapPin,
  ShoppingCart,
  Ticket,
} from 'lucide-react'
import { useEffect, useMemo } from 'react'

export const Route = createFileRoute('/events/$slug/tickets/')({
  component: TicketListingPage,
})

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function TicketListingPage() {
  const { slug } = Route.useParams()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const cartItems = useTicketCartStore((s) => s.items)
  const addItem = useTicketCartStore((s) => s.addItem)
  const updateQuantity = useTicketCartStore((s) => s.updateQuantity)
  const setEvent = useTicketCartStore((s) => s.setEvent)
  const totalItems = useTicketCartStore((s) => s.totalItems)
  const subtotal = useTicketCartStore((s) => s.subtotal)

  const {
    data: event,
    isLoading: eventLoading,
    error: eventError,
  } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEventBySlug(slug),
    enabled: !!slug,
  })

  const {
    data: packages = [],
    isLoading: packagesLoading,
    error: packagesError,
  } = useQuery({
    queryKey: ['ticket-packages', slug],
    queryFn: () => getTicketPackages(slug),
    enabled: !!slug,
  })

  // Sync event to cart store when loaded
  useEffect(() => {
    if (event) {
      setEvent(event.id, slug)
    }
  }, [event, slug, setEvent])

  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of cartItems) {
      map.set(item.packageId, item.quantity)
    }
    return map
  }, [cartItems])

  const itemCount = totalItems()
  const cartSubtotal = subtotal()
  const isLoading = eventLoading || packagesLoading
  const error = eventError || packagesError

  const handleQuantityChange = (pkg: PublicTicketPackage, qty: number) => {
    const current = cartQuantityMap.get(pkg.id) ?? 0
    if (current === 0 && qty > 0) {
      addItem(
        {
          packageId: pkg.id,
          packageName: pkg.name,
          unitPrice: pkg.price,
          seatsPerPackage: pkg.seats_per_package,
          isSponsorship:
            pkg.name.toLowerCase().includes('sponsor') ||
            pkg.name.toLowerCase().includes('sponsorship'),
        },
        qty
      )
    } else {
      updateQuantity(pkg.id, qty)
    }
  }

  if (isLoading) {
    return (
      <div className='container mx-auto max-w-2xl space-y-4 px-4 py-8'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-5 w-64' />
        <div className='space-y-4 pt-4'>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className='h-40 w-full rounded-lg' />
          ))}
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className='container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-8'>
        <Card className='w-full max-w-md'>
          <CardContent className='flex flex-col items-center gap-4 py-8'>
            <AlertCircle className='text-destructive h-10 w-10' />
            <p className='text-muted-foreground text-center'>
              Unable to load ticket information. Please try again later.
            </p>
            <Button asChild variant='outline'>
              <Link to='/events/$slug' params={{ slug }}>
                Back to Event
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const eventDate = event.event_datetime ? new Date(event.event_datetime) : null

  return (
    <div className='container mx-auto max-w-2xl px-4 pt-6 pb-28'>
      {/* Event Header */}
      <div className='mb-6 space-y-2'>
        <h1 className='text-2xl font-bold'>{event.name}</h1>
        <div className='text-muted-foreground flex flex-wrap gap-3 text-sm'>
          {eventDate && (
            <span className='flex items-center gap-1'>
              <CalendarDays className='h-4 w-4' />
              {eventDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
          {event.venue_name && (
            <span className='flex items-center gap-1'>
              <MapPin className='h-4 w-4' />
              {event.venue_name}
            </span>
          )}
        </div>
      </div>

      {/* Auth Banner */}
      {!isAuthenticated && (
        <Card className='mb-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20'>
          <CardContent className='flex items-center gap-3 py-3'>
            <LogIn className='h-5 w-5 shrink-0 text-blue-600' />
            <p className='flex-1 text-sm text-blue-900 dark:text-blue-100'>
              Sign in to purchase tickets
            </p>
            <Button asChild size='sm'>
              <Link
                to='/sign-in'
                search={{ redirect: `/events/${slug}/tickets` }}
              >
                Sign In
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Ticket Packages */}
      <div className='space-y-3'>
        <h2 className='flex items-center gap-2 text-lg font-semibold'>
          <Ticket className='h-5 w-5' />
          Available Tickets
        </h2>

        {packages.length === 0 ? (
          <Card>
            <CardContent className='text-muted-foreground py-8 text-center'>
              No ticket packages are available for this event.
            </CardContent>
          </Card>
        ) : (
          packages.map((pkg) => (
            <TicketPackageCard
              key={pkg.id}
              id={pkg.id}
              name={pkg.name}
              description={pkg.description}
              price={pkg.price}
              seatsPerPackage={pkg.seats_per_package}
              quantityRemaining={pkg.quantity_remaining}
              isSoldOut={pkg.sold_out}
              isSponsorship={
                pkg.name.toLowerCase().includes('sponsor') ||
                pkg.name.toLowerCase().includes('sponsorship')
              }
              currentQuantity={cartQuantityMap.get(pkg.id) ?? 0}
              onQuantityChange={(qty) => handleQuantityChange(pkg, qty)}
              disabled={!isAuthenticated}
            />
          ))
        )}
      </div>

      {/* Sticky Cart Bar */}
      {itemCount > 0 && (
        <div className='bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-50 border-t p-4 shadow-lg backdrop-blur'>
          <div className='container mx-auto flex max-w-2xl items-center justify-between'>
            <div className='flex items-center gap-3'>
              <Badge variant='secondary' className='text-sm'>
                <ShoppingCart className='mr-1 h-3 w-3' />
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </Badge>
              <span className='font-semibold'>{fmtCurrency(cartSubtotal)}</span>
            </div>
            <Button asChild>
              <Link to='/events/$slug/tickets/checkout' params={{ slug }}>
                View Cart
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
