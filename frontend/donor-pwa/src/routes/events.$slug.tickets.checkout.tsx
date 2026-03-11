/**
 * Ticket Checkout Route — /events/$slug/tickets/checkout?package=<id>
 * 4-step flow: package + promo → payment method → review → success
 */
import { CheckoutSummary } from '@/components/payments/CheckoutSummary'
import { PaymentMethodSelector } from '@/components/payments/PaymentMethodSelector'
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
import { getEventBySlug, getTicketPackages } from '@/lib/api/events'
import type { PublicTicketPackage } from '@/lib/api/events'
import { submitCheckout, validatePromoCode } from '@/lib/api/payments'
import { useAuthStore } from '@/stores/auth-store'
import type {
  CheckoutRequest,
  CheckoutResponse,
  LineItem,
  PromoCodeValidation,
} from '@/types/payment'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle, Tag, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/events/$slug/tickets/checkout')({
  component: TicketsCheckoutPage,
})

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function calcPromoDiscount(
  promo: PromoCodeValidation,
  pkg: PublicTicketPackage,
): number {
  if (promo.discount_type === 'percentage') {
    return Math.round((pkg.price * promo.discount_value) / 100)
  }
  return Math.min(promo.discount_value * 100, pkg.price)
}

function TicketsCheckoutPage() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(window.location.search)
  const preselectedPackageId = searchParams.get('package')

  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    preselectedPackageId,
  )
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<PromoCodeValidation | null>(
    null,
  )
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  )
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResponse | null>(
    null,
  )
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      void navigate({
        to: '/sign-in',
        search: { redirect: `/events/${slug}/tickets/checkout` },
      })
    }
  }, [isAuthenticated, navigate, slug])

  const { data: event } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEventBySlug(slug),
    enabled: !!slug,
  })

  const { data: packages = [] } = useQuery({
    queryKey: ['ticket-packages', slug],
    queryFn: () => getTicketPackages(slug),
    enabled: !!slug,
  })

  const selectedPackage = packages.find((p) => p.id === selectedPackageId)

  const lineItems: LineItem[] = selectedPackage
    ? [
        {
          type: 'ticket',
          label: `${selectedPackage.name} × 1`,
          amount: selectedPackage.price / 100,
        },
      ]
    : []

  const promoDiscount =
    appliedPromo && selectedPackage
      ? calcPromoDiscount(appliedPromo, selectedPackage)
      : 0

  const subtotal = selectedPackage
    ? Math.max(selectedPackage.price - promoDiscount, 0)
    : 0

  async function handleValidatePromo() {
    if (!promoCode.trim() || !event?.id) return
    setPromoLoading(true)
    setPromoError(null)
    try {
      const result = await validatePromoCode(event.id, promoCode.trim())
      setAppliedPromo(result)
    } catch {
      setPromoError('Invalid or expired promo code')
    } finally {
      setPromoLoading(false)
    }
  }

  async function handleSubmitCheckout() {
    if (!event?.id || !selectedProfileId || !selectedPackage) return
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const payload: CheckoutRequest = {
        event_id: event.id,
        payment_profile_id: selectedProfileId,
      }
      const result = await submitCheckout(payload)
      setCheckoutResult(result)
      if (result.status === 'declined') {
        setCheckoutError(result.decline_reason ?? 'Payment declined. Please try again.')
        return
      }
      setStep(4)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Checkout failed. Please retry.'
      setCheckoutError(msg)
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="container mx-auto max-w-xl px-4 py-8">
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a Ticket Package</CardTitle>
            <CardDescription>{event?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackageId(pkg.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  selectedPackageId === pkg.id
                    ? 'border-primary bg-primary/10'
                    : 'hover:border-primary/50'
                }`}
              >
                <div className="flex justify-between font-medium">
                  <span>{pkg.name}</span>
                  <span>{fmtCurrency(pkg.price)}</span>
                </div>
                {pkg.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {pkg.description}
                  </p>
                )}
              </button>
            ))}

            {selectedPackage && (
              <div className="space-y-2">
                <Label>Promo Code</Label>
                {appliedPromo ? (
                  <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                    <Tag className="h-4 w-4" />
                    <span className="font-medium">{appliedPromo.code}</span>
                    <span>— save {fmtCurrency(promoDiscount)}</span>
                    <button
                      onClick={() => {
                        setAppliedPromo(null)
                        setPromoCode('')
                      }}
                      className="ml-auto"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Enter code"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleValidatePromo()
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => void handleValidatePromo()}
                      disabled={promoLoading || !promoCode.trim()}
                    >
                      Apply
                    </Button>
                  </div>
                )}
                {promoError && (
                  <p className="text-sm text-red-500">{promoError}</p>
                )}
              </div>
            )}

            <Button
              className="w-full"
              disabled={!selectedPackage}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && event && (
        <Card>
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 mb-2"
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <CardTitle>Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentMethodSelector
              npoId={event.npo_id}
              selectedProfileId={selectedProfileId}
              onSelect={setSelectedProfileId}
            />
            <Button
              className="mt-4 w-full"
              disabled={!selectedProfileId}
              onClick={() => setStep(3)}
            >
              Review Order
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && selectedPackage && (
        <Card>
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 mb-2"
              onClick={() => setStep(2)}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <CardTitle>Review & Pay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CheckoutSummary
              lineItems={lineItems}
              total={subtotal / 100}
              promoDiscount={
                appliedPromo
                  ? { code: appliedPromo.code, amount: promoDiscount / 100 }
                  : undefined
              }
            />
            {checkoutError && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {checkoutError}
              </p>
            )}
            <Button
              className="w-full"
              onClick={() => void handleSubmitCheckout()}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Processing…' : `Pay ${fmtCurrency(subtotal)}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 4 && checkoutResult && (
        <Card className="text-center">
          <CardContent className="space-y-4 py-10">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="text-2xl font-bold">Payment Successful!</h2>
            <p className="text-muted-foreground">
              {checkoutResult.receipt_pending
                ? 'Your receipt will be emailed to you shortly.'
                : 'Check your email for your receipt.'}
            </p>
            <div className="flex justify-center gap-3 pt-4">
              <Button asChild variant="outline">
                <Link to="/events/$slug" params={{ slug }}>Back to Event</Link>
              </Button>
              <Button asChild>
                <Link to="/events/$slug/tickets" params={{ slug }}>Browse More Tickets</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
