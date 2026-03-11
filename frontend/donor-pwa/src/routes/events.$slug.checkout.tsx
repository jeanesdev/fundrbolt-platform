/**
 * End-of-Night Donor Checkout Route
 *
 * Flow:
 *   1. Auth guard — unauthenticated visitors are bounced to /sign-in
 *   2. Load event + checkout balance
 *   3. If checkout not open → friendly "not yet open" screen
 *   4. If nothing owed → "all paid" confirmation
 *   5. Pay screen — balance summary, cover-fee toggle, card selector
 *   6. Success / declined result screen
 */

import { CheckoutSummary } from '@/components/payments/CheckoutSummary'
import { PaymentMethodSelector } from '@/components/payments/PaymentMethodSelector'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { getEventBySlug } from '@/lib/api/events'
import { getCheckoutBalance, submitCheckout } from '@/lib/api/payments'
import { hasValidRefreshToken } from '@/lib/storage/tokens'
import { useAuthStore } from '@/stores/auth-store'
import type { CheckoutResponse } from '@/types/payment'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Mail,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'

// ── Route definition ──────────────────────────────────────────────────────────

export const Route = createFileRoute('/events/$slug/checkout')({
  beforeLoad: async ({ location }) => {
    const { isAuthenticated } = useAuthStore.getState()
    if (!isAuthenticated && !hasValidRefreshToken()) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
  },
  component: EventCheckoutPage,
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount)
}

function genIdempotencyKey(): string {
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── Main component ────────────────────────────────────────────────────────────

function EventCheckoutPage() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { isAuthenticated, user } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      void navigate({
        to: '/sign-in',
        search: { redirect: `/events/${slug}/checkout` },
      })
    }
  }, [isAuthenticated, slug, navigate])

  // ── Data ──────────────────────────────────────────────────────────────────

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
    data: balance,
    isLoading: balanceLoading,
    error: balanceError,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ['checkout-balance', event?.id],
    queryFn: () => getCheckoutBalance(event!.id),
    enabled: !!event?.id && !!isAuthenticated,
    retry: 1,
  })

  // ── Local state ───────────────────────────────────────────────────────────

  const [coverFee, setCoverFee] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<CheckoutResponse | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Each attempt gets a fresh idempotency key
  const [idempotencyKey] = useState(genIdempotencyKey)

  // Derive amounts from balance
  const subtotal = balance?.total_balance ?? 0
  const processingFee = balance?.processing_fee ?? 0
  const totalWithFee = balance?.total_with_fee ?? 0
  const total = coverFee ? totalWithFee : subtotal

  // Extended line items when fee is covered
  const displayLineItems = balance
    ? coverFee
      ? [
          ...balance.line_items,
          { type: 'fee_coverage', label: 'Processing Fee', amount: processingFee },
        ]
      : balance.line_items
    : []

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!event || !selectedProfileId || !balance) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await submitCheckout({
        event_id: event.id,
        payment_profile_id: selectedProfileId,
        cover_processing_fee: coverFee,
        idempotency_key: idempotencyKey,
      })
      setResult(response)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again or contact support.'
      setSubmitError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Render guards ─────────────────────────────────────────────────────────

  if (!isAuthenticated) return null

  if (eventLoading || balanceLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (eventError || !event) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load event details. Please go back and try again.
          </AlertDescription>
        </Alert>
        <Button variant="ghost" className="mt-4" onClick={() => void navigate({ to: '/' })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to home
        </Button>
      </div>
    )
  }

  // Checkout not yet open
  if (!event.checkout_open) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            <CreditCard className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
            <CardTitle>Checkout Not Open Yet</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-center text-sm">
            <p>The event coordinator has not opened checkout yet.</p>
            <p className="mt-1">Check back in a little while!</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button
              variant="outline"
              onClick={() => void navigate({ to: '/events/$slug', params: { slug } })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to event
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Balance error
  if (balanceError) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Unable to load your balance. Please try again.</AlertDescription>
        </Alert>
        <Button variant="ghost" className="mt-4" onClick={() => void refetchBalance()}>
          Retry
        </Button>
      </div>
    )
  }

  // Nothing owed
  if (balance && subtotal === 0) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
            <CardTitle>All Paid Up!</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-center text-sm">
            <p>There is nothing outstanding on your account for this event.</p>
            {user?.first_name && (
              <p className="mt-1">Thanks, {user.first_name}! Enjoy the rest of the evening.</p>
            )}
          </CardContent>
          <CardFooter className="justify-center">
            <Button
              variant="outline"
              onClick={() => void navigate({ to: '/events/$slug', params: { slug } })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to event
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // ── Success / decline result screen ──────────────────────────────────────

  if (result) {
    const approved = result.status === 'approved'

    return (
      <div className="container mx-auto max-w-lg px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            {approved ? (
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
            ) : (
              <XCircle className="mx-auto mb-3 h-12 w-12 text-red-500" />
            )}
            <CardTitle>{approved ? 'Payment Successful!' : 'Payment Declined'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-center text-sm">
            {approved ? (
              <>
                <p className="text-muted-foreground">
                  {fmtCurrency(result.amount_charged)} charged to your card.
                </p>
                {result.receipt_pending && (
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span>A receipt is on its way to your email inbox.</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-muted-foreground">
                  {result.decline_reason ?? 'Your card was declined. Please try another card.'}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setResult(null)
                    setSubmitError(null)
                  }}
                >
                  Try Again
                </Button>
              </>
            )}
          </CardContent>
          {approved && (
            <CardFooter className="justify-center">
              <Button
                variant="outline"
                onClick={() => void navigate({ to: '/events/$slug', params: { slug } })}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to event
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    )
  }

  // ── Main checkout UI ──────────────────────────────────────────────────────

  const canSubmit = !!selectedProfileId && !isSubmitting && subtotal > 0

  return (
    <div className="container mx-auto max-w-lg space-y-6 px-4 py-8">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          onClick={() => void navigate({ to: '/events/$slug', params: { slug } })}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to event
        </Button>
        <h1 className="text-2xl font-bold">Checkout</h1>
        {event.name && <p className="text-muted-foreground text-sm">{event.name}</p>}
      </div>

      {/* Balance summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Balance</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <CheckoutSummary lineItems={displayLineItems} total={total} isLoading={balanceLoading} />
        </CardContent>
      </Card>

      {/* Cover processing fee toggle */}
      {processingFee > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id="cover-fee"
                checked={coverFee}
                onCheckedChange={(checked) => setCoverFee(checked === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="cover-fee" className="cursor-pointer font-medium leading-none">
                  Cover processing fee ({fmtCurrency(processingFee)})
                </Label>
                <p className="text-muted-foreground text-xs">
                  Adding {fmtCurrency(processingFee)} helps 100% of your contribution go directly to the cause.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card selection */}
      {event.npo_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <PaymentMethodSelector
              npoId={event.npo_id}
              selectedProfileId={selectedProfileId}
              onSelect={setSelectedProfileId}
              totalAmount={total}
              returnUrl={`${window.location.origin}/events/${slug}/checkout`}
            />
          </CardContent>
        </Card>
      )}

      {/* Total + submit */}
      <Card>
        <CardContent className="pt-6">
          <Separator className="mb-4" />
          <div className="mb-4 flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold">{fmtCurrency(total)}</span>
          </div>

          {submitError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pay {fmtCurrency(total)}
              </>
            )}
          </Button>

          {!selectedProfileId && subtotal > 0 && (
            <p className="text-muted-foreground mt-2 text-center text-xs">
              Select a payment method above to continue.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
