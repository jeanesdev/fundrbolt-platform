/**
 * Multi-package Cart Checkout Route — /events/$slug/tickets/checkout
 * 4-step flow: Cart Review → Sponsorship Info (conditional) → Payment → Success
 */
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useTicketCartStore } from '@/stores/ticket-cart-store'
import { getEventBySlug } from '@/lib/api/events'
import {
  checkout,
  validateCart,
  type CartValidationResponse,
  type CheckoutResponse,
  type SponsorshipDetails,
} from '@/lib/api/ticket-purchases'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SponsorshipInfoForm } from '@/components/tickets/SponsorshipInfoForm'

export const Route = createFileRoute('/events/$slug/tickets/checkout')({
  component: TicketsCheckoutPage,
})

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function TicketsCheckoutPage() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const cartItems = useTicketCartStore((s) => s.items)
  const eventId = useTicketCartStore((s) => s.eventId)
  const updateQuantity = useTicketCartStore((s) => s.updateQuantity)
  const removeItem = useTicketCartStore((s) => s.removeItem)
  const clearCart = useTicketCartStore((s) => s.clearCart)
  const cartSubtotal = useTicketCartStore((s) => s.subtotal)
  const cartHasSponsorship = useTicketCartStore((s) => s.hasSponsorship)

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [promoCode, setPromoCode] = useState('')
  const [validationResult, setValidationResult] =
    useState<CartValidationResponse | null>(null)
  const [sponsorshipDetails, setSponsorshipDetails] =
    useState<SponsorshipDetails | null>(null)
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResponse | null>(
    null
  )

  // Payment form fields (UI only)
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')

  const { data: event } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEventBySlug(slug),
    enabled: !!slug,
  })

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isAuthenticated) {
      void navigate({
        to: '/sign-in',
        search: { redirect: `/events/${slug}/tickets/checkout` },
      })
    }
  }, [isAuthenticated, navigate, slug])

  const validateMutation = useMutation({
    mutationFn: () => {
      if (!eventId) throw new Error('No event selected')
      const items = cartItems.map((i) => ({
        package_id: i.packageId,
        quantity: i.quantity,
      }))
      return validateCart(eventId, items, promoCode.trim() || null)
    },
    onSuccess: (data) => {
      setValidationResult(data)
      if (data.promo_code_applied) {
        toast.success(`Promo code "${data.promo_code_applied}" applied!`)
      }
    },
    onError: () => {
      toast.error('Invalid or expired promo code')
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: () => {
      if (!eventId) throw new Error('No event selected')
      return checkout(eventId, {
        items: cartItems.map((i) => ({
          package_id: i.packageId,
          quantity: i.quantity,
        })),
        promo_code: validationResult?.promo_code_applied ?? null,
        sponsorship_details: sponsorshipDetails,
      })
    },
    onSuccess: (data) => {
      setCheckoutResult(data)
      clearCart()
      setStep(4)
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Checkout failed. Please retry.'
      toast.error(msg)
    },
  })

  const handleApplyPromo = () => {
    if (!promoCode.trim()) return
    validateMutation.mutate()
  }

  const handleClearPromo = () => {
    setPromoCode('')
    setValidationResult(null)
  }

  const handleContinueToPayment = () => {
    if (cartHasSponsorship() && !sponsorshipDetails) {
      setStep(2)
    } else {
      setStep(3)
    }
  }

  const handleSponsorshipSubmit = (details: SponsorshipDetails) => {
    setSponsorshipDetails(details)
    setStep(3)
  }

  const handleCompleteCheckout = () => {
    checkoutMutation.mutate()
  }

  const displaySubtotal = validationResult
    ? Math.round(validationResult.subtotal * 100)
    : cartSubtotal()
  const displayDiscount = validationResult
    ? Math.round(validationResult.discount * 100)
    : 0
  const displayTotal = validationResult
    ? Math.round(validationResult.total * 100)
    : displaySubtotal

  if (!isAuthenticated) return null

  if (cartItems.length === 0 && step !== 4) {
    return (
      <div className='container mx-auto flex min-h-[50vh] max-w-xl items-center justify-center px-4 py-8'>
        <Card className='w-full text-center'>
          <CardContent className='space-y-4 py-10'>
            <ShoppingCart className='text-muted-foreground mx-auto h-12 w-12' />
            <h2 className='text-xl font-semibold'>Your cart is empty</h2>
            <p className='text-muted-foreground'>
              Browse ticket packages to add items to your cart.
            </p>
            <Button asChild>
              <Link to='/events/$slug/tickets' params={{ slug }}>
                Browse Tickets
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='container mx-auto max-w-xl px-4 py-8'>
      {/* Step 1: Cart Review */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <Button variant='ghost' size='sm' className='mb-2 -ml-2' asChild>
              <Link to='/events/$slug/tickets' params={{ slug }}>
                <ArrowLeft className='mr-1 h-4 w-4' /> Back to Tickets
              </Link>
            </Button>
            <CardTitle>Review Your Cart</CardTitle>
            <CardDescription>{event?.name}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Cart Items */}
            {cartItems.map((item) => (
              <div
                key={item.packageId}
                className='flex items-center justify-between gap-3 rounded-lg border p-3'
              >
                <div className='flex-1 space-y-1'>
                  <p className='font-medium'>{item.packageName}</p>
                  <p className='text-muted-foreground text-sm'>
                    {fmtCurrency(item.unitPrice)} each · {item.seatsPerPackage}{' '}
                    {item.seatsPerPackage === 1 ? 'seat' : 'seats'}
                  </p>
                </div>
                <div className='flex items-center gap-1'>
                  <Button
                    variant='outline'
                    size='icon'
                    className='h-7 w-7'
                    onClick={() =>
                      updateQuantity(item.packageId, item.quantity - 1)
                    }
                    aria-label='Decrease quantity'
                  >
                    <Minus className='h-3 w-3' />
                  </Button>
                  <span className='w-8 text-center text-sm tabular-nums'>
                    {item.quantity}
                  </span>
                  <Button
                    variant='outline'
                    size='icon'
                    className='h-7 w-7'
                    onClick={() =>
                      updateQuantity(item.packageId, item.quantity + 1)
                    }
                    aria-label='Increase quantity'
                  >
                    <Plus className='h-3 w-3' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='text-destructive h-7 w-7'
                    onClick={() => removeItem(item.packageId)}
                    aria-label='Remove item'
                  >
                    <Trash2 className='h-3 w-3' />
                  </Button>
                </div>
                <span className='w-20 text-right font-medium'>
                  {fmtCurrency(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}

            {/* Promo Code */}
            <div className='space-y-2'>
              <Label>Promo Code</Label>
              {validationResult?.promo_code_applied ? (
                <div className='flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300'>
                  <Tag className='h-4 w-4' />
                  <span className='font-medium'>
                    {validationResult.promo_code_applied}
                  </span>
                  <span>— save {fmtCurrency(displayDiscount)}</span>
                  <button onClick={handleClearPromo} className='ml-auto'>
                    <X className='h-4 w-4' />
                  </button>
                </div>
              ) : (
                <div className='flex gap-2'>
                  <Input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder='Enter promo code'
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyPromo()
                    }}
                  />
                  <Button
                    variant='outline'
                    onClick={handleApplyPromo}
                    disabled={validateMutation.isPending || !promoCode.trim()}
                  >
                    {validateMutation.isPending ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      'Apply'
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Warnings */}
            {validationResult?.warnings.map((w, i) => (
              <div
                key={i}
                className='flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
              >
                <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
                <span>{w}</span>
              </div>
            ))}

            {/* Totals */}
            <div className='space-y-1 border-t pt-3'>
              <div className='flex justify-between text-sm'>
                <span>Subtotal</span>
                <span>{fmtCurrency(displaySubtotal)}</span>
              </div>
              {displayDiscount > 0 && (
                <div className='flex justify-between text-sm text-green-600'>
                  <span>Discount</span>
                  <span>−{fmtCurrency(displayDiscount)}</span>
                </div>
              )}
              <div className='flex justify-between text-lg font-bold'>
                <span>Total</span>
                <span>{fmtCurrency(displayTotal)}</span>
              </div>
            </div>

            <Button className='w-full' onClick={handleContinueToPayment}>
              Continue to Payment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Sponsorship Info (conditional) */}
      {step === 2 && eventId && (
        <Card>
          <CardContent className='py-6'>
            <SponsorshipInfoForm
              eventId={eventId}
              onSubmit={handleSponsorshipSubmit}
              onBack={() => setStep(1)}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Payment */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <Button
              variant='ghost'
              size='sm'
              className='mb-2 -ml-2'
              onClick={() =>
                setStep(cartHasSponsorship() && sponsorshipDetails ? 2 : 1)
              }
            >
              <ArrowLeft className='mr-1 h-4 w-4' /> Back
            </Button>
            <CardTitle className='flex items-center gap-2'>
              <CreditCard className='h-5 w-5' />
              Payment
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-5'>
            {/* Order Summary */}
            <div className='bg-muted/50 space-y-2 rounded-lg p-4'>
              <h3 className='text-sm font-semibold'>Order Summary</h3>
              {cartItems.map((item) => (
                <div
                  key={item.packageId}
                  className='flex justify-between text-sm'
                >
                  <span>
                    {item.packageName} × {item.quantity}
                  </span>
                  <span>{fmtCurrency(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
              {displayDiscount > 0 && (
                <div className='flex justify-between text-sm text-green-600'>
                  <span>Discount</span>
                  <span>−{fmtCurrency(displayDiscount)}</span>
                </div>
              )}
              <div className='flex justify-between border-t pt-2 font-bold'>
                <span>Total</span>
                <span>{fmtCurrency(displayTotal)}</span>
              </div>
            </div>

            {/* Payment Form (placeholder UI) */}
            <div className='space-y-3'>
              <div className='space-y-2'>
                <Label htmlFor='card-number'>Card Number</Label>
                <Input
                  id='card-number'
                  placeholder='4242 4242 4242 4242'
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  maxLength={19}
                />
              </div>
              <div className='flex gap-3'>
                <div className='flex-1 space-y-2'>
                  <Label htmlFor='card-expiry'>Expiry</Label>
                  <Input
                    id='card-expiry'
                    placeholder='MM/YY'
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    maxLength={5}
                  />
                </div>
                <div className='w-24 space-y-2'>
                  <Label htmlFor='card-cvv'>CVV</Label>
                  <Input
                    id='card-cvv'
                    placeholder='123'
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    maxLength={4}
                  />
                </div>
              </div>
            </div>

            {checkoutMutation.isError && (
              <div className='rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300'>
                {checkoutMutation.error instanceof Error
                  ? checkoutMutation.error.message
                  : 'Checkout failed. Please try again.'}
              </div>
            )}

            <Button
              className='w-full'
              onClick={handleCompleteCheckout}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Processing…
                </>
              ) : (
                `Complete Purchase — ${fmtCurrency(displayTotal)}`
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Success */}
      {step === 4 && checkoutResult && (
        <Card className='text-center'>
          <CardContent className='space-y-4 py-10'>
            <CheckCircle className='mx-auto h-16 w-16 text-green-500' />
            <h2 className='text-2xl font-bold'>Purchase Complete!</h2>
            <p className='text-muted-foreground'>
              Your tickets have been confirmed. Check your email for a receipt.
            </p>

            {checkoutResult.purchases.length > 0 && (
              <div className='mx-auto max-w-sm space-y-2 text-left'>
                {checkoutResult.purchases.map((p) => (
                  <div
                    key={p.purchase_id}
                    className='bg-muted/50 flex justify-between rounded-md px-3 py-2 text-sm'
                  >
                    <span>
                      {p.package_name} × {p.quantity}
                    </span>
                    <span className='font-medium'>
                      {fmtCurrency(Math.round(p.total_price * 100))}
                    </span>
                  </div>
                ))}
                <div className='flex justify-between border-t pt-2 font-bold'>
                  <span>Total Charged</span>
                  <span>
                    {fmtCurrency(
                      Math.round(checkoutResult.total_charged * 100)
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className='flex justify-center gap-3 pt-4'>
              <Button asChild variant='outline'>
                <Link to='/events/$slug' params={{ slug }}>
                  Back to Event
                </Link>
              </Button>
              <Button asChild>
                <Link to='/tickets'>View My Tickets</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
