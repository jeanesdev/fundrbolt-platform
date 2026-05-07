/**
 * End-of-Night Donor Checkout Route
 *
 * Flow:
 *   1. Auth guard — unauthenticated visitors are bounced to /sign-in
 *   2. Load event + checkout session (10s polling)
 *   3. If checkout not open → friendly "not yet open" screen
 *   4. If session complete → read-only receipt view
 *   5. Pay screen:
 *      - Sticky update banner when organizer updates items
 *      - Item summary
 *      - Auctioneer + FundrBolt tip sections
 *      - Payment method selector (card/cash/check/daf)
 *      - Processing fee coverage toggle (card only)
 *      - Double-swipe confirm
 *   6. Contact admin form at the bottom
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useCheckoutStore } from '@/stores/checkout-store'
import {
  confirmCheckout,
  downloadCheckoutReceipt,
  getCheckoutSession,
  getCheckoutStatus,
  updateCheckoutSession,
} from '@/lib/api/checkout'
import { getEventBySlug } from '@/lib/api/events'
import { hasValidRefreshToken } from '@/lib/storage/tokens'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { BoothInstructionsCard } from '@/components/checkout/BoothInstructionsCard'
import { CheckoutPaymentMethods } from '@/components/checkout/CheckoutPaymentMethods'
import { CheckoutReceiptView } from '@/components/checkout/CheckoutReceiptView'
import { CheckoutTipSection } from '@/components/checkout/CheckoutTipSection'
import { CheckoutUpdateBanner } from '@/components/checkout/CheckoutUpdateBanner'
import { ContactAdminForm } from '@/components/checkout/ContactAdminForm'
import { SwipeToConfirm } from '@/components/checkout/SwipeToConfirm'
import { CheckoutSummary } from '@/components/payments/CheckoutSummary'

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

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

type ConfirmStage = 'idle' | 'reviewing' | 'submitted'

// ── Main component ────────────────────────────────────────────────────────────

function EventCheckoutPage() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      void navigate({
        to: '/sign-in',
        search: { redirect: `/events/${slug}/checkout` },
      })
    }
  }, [isAuthenticated, slug, navigate])

  // ── Checkout store (T025 — restore persisted preferences) ─────────────────
  const {
    paymentMethod,
    auctioneerTipCents,
    platformTipCents,
    coverProcessingFee,
    acknowledgedItemsUpdatedAt,
    setPaymentMethod,
    setAuctioneerTipCents,
    setPlatformTipCents,
    setCoverProcessingFee,
    setAcknowledgedItemsUpdatedAt,
  } = useCheckoutStore()

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  )
  const [confirmStage, setConfirmStage] = useState<ConfirmStage>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Data queries ───────────────────────────────────────────────────────────

  const {
    data: event,
    isLoading: eventLoading,
    error: eventError,
  } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEventBySlug(slug),
    enabled: !!slug,
  })

  // Checkout status — determines if checkout is open
  const { data: checkoutStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['checkout-status', event?.id],
    queryFn: () => getCheckoutStatus(event!.id),
    enabled: !!event?.id && !!isAuthenticated,
    refetchInterval: 10_000,
    retry: 1,
  })

  // Checkout session — full session with items and totals (T021 — 10s polling)
  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
    refetch: refetchSession,
  } = useQuery({
    queryKey: ['checkout-session', event?.id],
    queryFn: () => getCheckoutSession(event!.id),
    enabled:
      !!event?.id &&
      !!isAuthenticated &&
      (checkoutStatus?.checkout_open ?? event?.checkout_open ?? false),
    refetchInterval: 10_000,
    retry: 1,
  })

  // Sync coverProcessingFee from the session on first load so that the
  // server-side default (true) is reflected even for users with an old
  // persisted store value of false.
  const coverFeeInitialized = useRef(false)

  useEffect(() => {
    if (session && !coverFeeInitialized.current) {
      coverFeeInitialized.current = true
      setCoverProcessingFee(session.cover_processing_fee)
    }
  }, [session, setCoverProcessingFee])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateSessionMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateCheckoutSession>[1]) =>
      updateCheckoutSession(event!.id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['checkout-session', event?.id], updated)
    },
    // Suppress global error toast — this mutation is a background preference sync
    // and any failure is silent (the UI continues working with local state).
    onError: () => {},
  })

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmCheckout(event!.id, {
        payment_method: paymentMethod,
        payment_profile_id:
          paymentMethod === 'card'
            ? (selectedProfileId ?? undefined)
            : undefined,
        acknowledged_items_updated_at: acknowledgedItemsUpdatedAt ?? undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['checkout-session', event?.id], updated)
      setConfirmStage('submitted')
      setSubmitError(null)
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        response?: { data?: { detail?: string } }
        message?: string
      }
      setSubmitError(
        axiosErr.response?.data?.detail ??
          axiosErr.message ??
          'An unexpected error occurred. Please try again.'
      )
      setConfirmStage('idle')
    },
  })

  // ── Derived values ─────────────────────────────────────────────────────────

  const checkoutOpen =
    checkoutStatus?.checkout_open ?? event?.checkout_open ?? false

  // T021 — compare items_updated_at with acknowledgedItemsUpdatedAt
  const sessionItemsUpdatedAt = session?.items_updated_at
  const showUpdateBanner = useMemo(() => {
    if (!sessionItemsUpdatedAt) return false
    if (!acknowledgedItemsUpdatedAt) return true
    return (
      new Date(sessionItemsUpdatedAt) > new Date(acknowledgedItemsUpdatedAt)
    )
  }, [sessionItemsUpdatedAt, acknowledgedItemsUpdatedAt])

  const visibleItems = session?.items.filter((item) => !item.deleted_at) ?? []
  const subtotalCents = session?.subtotal_cents ?? 0
  const processingFeeCents = session?.processing_fee_cents ?? 0
  const totalCents = session?.total_cents ?? 0

  // Display line items from session — group duplicates with a quantity suffix
  const displayLineItems = useMemo(() => {
    // Aggregate items with the same source_type + name
    const grouped = new Map<
      string,
      { type: string; name: string; amount: number; count: number }
    >()
    for (const item of visibleItems) {
      const key = `${item.source_type}\x00${item.name}`
      const existing = grouped.get(key)
      if (existing) {
        existing.amount += item.effective_amount_cents / 100
        existing.count++
      } else {
        grouped.set(key, {
          type: item.source_type,
          name: item.name,
          amount: item.effective_amount_cents / 100,
          count: 1,
        })
      }
    }
    const items = Array.from(grouped.values()).map(
      ({ type, name, amount, count }) => ({
        type,
        label: count > 1 ? `${name} × ${count}` : name,
        amount,
      })
    )
    if (auctioneerTipCents > 0) {
      items.push({
        type: 'auctioneer_tip',
        label: 'Tip the Auctioneer',
        amount: auctioneerTipCents / 100,
      })
    }
    if (platformTipCents > 0) {
      items.push({
        type: 'platform_tip',
        label: 'Tip the FundrBolt Team',
        amount: platformTipCents / 100,
      })
    }
    if (coverProcessingFee && processingFeeCents > 0) {
      items.push({
        type: 'fee_coverage',
        label: 'Processing Fee',
        amount: processingFeeCents / 100,
      })
    }
    return items
  }, [
    visibleItems,
    auctioneerTipCents,
    platformTipCents,
    coverProcessingFee,
    processingFeeCents,
  ])

  // Double-swipe disabled when update banner is visible
  const swipeDisabled =
    !checkoutOpen || showUpdateBanner || confirmMutation.isPending

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleTipChange(field: 'auctioneer' | 'platform', cents: number) {
    if (field === 'auctioneer') {
      setAuctioneerTipCents(cents)
    } else {
      setPlatformTipCents(cents)
    }
    void updateSessionMutation.mutateAsync(
      field === 'auctioneer'
        ? { auctioneer_tip_cents: cents }
        : { platform_tip_cents: cents }
    )
  }

  function handlePaymentMethodChange(
    method: 'card' | 'cash' | 'check' | 'daf'
  ) {
    setPaymentMethod(method)
    void updateSessionMutation.mutateAsync({ payment_method: method })
    // Reset confirm stage when method changes
    setConfirmStage('idle')
  }

  function handleCoverFeeChange(cover: boolean) {
    setCoverProcessingFee(cover)
    void updateSessionMutation.mutateAsync({ cover_processing_fee: cover })
  }

  function handleSlideToReview() {
    setConfirmStage('reviewing')
  }

  function handleDialogConfirm() {
    setConfirmStage('submitted')
    confirmMutation.mutate()
  }

  function handleAcknowledgeUpdate() {
    if (session?.items_updated_at) {
      setAcknowledgedItemsUpdatedAt(session.items_updated_at)
    }
  }

  // ── Render guards ─────────────────────────────────────────────────────────

  if (!isAuthenticated) return null

  const isLoading = eventLoading || statusLoading || sessionLoading

  if (isLoading && !session && !event) {
    return (
      <div className='flex min-h-dvh items-center justify-center'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    )
  }

  if (eventError || !event) {
    return (
      <div className='bg-background min-h-screen'>
        <div className='container mx-auto max-w-lg px-4 py-12'>
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              Unable to load event details. Please go back and try again.
            </AlertDescription>
          </Alert>
          <Button
            variant='ghost'
            className='mt-4'
            onClick={() => void navigate({ to: '/' })}
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to home
          </Button>
        </div>
      </div>
    )
  }

  // Session loading error
  if (sessionError && !session) {
    return (
      <div className='bg-background min-h-screen'>
        <div className='container mx-auto max-w-lg px-4 py-12'>
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              Unable to load your checkout session. Please try again.
            </AlertDescription>
          </Alert>
          <Button
            variant='ghost'
            className='mt-4'
            onClick={() => void refetchSession()}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Session still loading
  if (!session) {
    return (
      <div className='bg-background flex min-h-dvh items-center justify-center'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    )
  }

  // T026 — Read-only mode when checkout is complete
  if (session.status === 'complete') {
    return (
      <div className='bg-background min-h-screen'>
        <div className='container mx-auto max-w-lg space-y-6 px-4 py-8'>
          <div>
            <Button
              variant='ghost'
              size='sm'
              className='mb-2 -ml-2'
              onClick={() =>
                void navigate({ to: '/events/$slug', params: { slug } })
              }
            >
              <ArrowLeft className='mr-1 h-4 w-4' />
              Back to event
            </Button>
            <div className='flex items-center gap-2'>
              <CheckCircle2 className='h-6 w-6 text-green-500' />
              <h1 className='text-2xl font-bold'>Checkout Complete</h1>
            </div>
            {event.name && (
              <p className='text-muted-foreground text-sm'>{event.name}</p>
            )}
          </div>

          <CheckoutReceiptView
            session={session}
            event={{ name: event.name, id: event.id, slug: event.slug }}
            onDownloadReceipt={() =>
              void downloadCheckoutReceipt(event.id).catch(() =>
                toast.error(
                  'Receipt not available yet. Please try again shortly.'
                )
              )
            }
          />
        </div>{' '}
      </div>
    )
  }

  // ── Main checkout UI ──────────────────────────────────────────────────────

  const showProcessingFeeToggle =
    paymentMethod === 'card' && processingFeeCents > 0

  const canCardPay = paymentMethod !== 'card' || !!selectedProfileId

  return (
    <div className='bg-background min-h-screen'>
      <div className='container mx-auto max-w-lg px-4 pb-12'>
        {/* Update banner — sticky, T021 */}
        {showUpdateBanner && (
          <CheckoutUpdateBanner onAcknowledge={handleAcknowledgeUpdate} />
        )}

        <div className='space-y-6 py-8'>
          {/* Header */}
          <div>
            <Button
              variant='ghost'
              size='sm'
              className='mb-2 -ml-2'
              onClick={() =>
                void navigate({ to: '/events/$slug', params: { slug } })
              }
            >
              <ArrowLeft className='mr-1 h-4 w-4' />
              Back to event
            </Button>
            <h1 className='text-2xl font-bold'>Checkout</h1>
            {event.name && (
              <p className='text-muted-foreground text-sm'>{event.name}</p>
            )}
          </div>

          {/* Items summary */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Your Balance</CardTitle>
            </CardHeader>
            <CardContent className='pt-0'>
              <CheckoutSummary
                lineItems={displayLineItems}
                total={totalCents / 100}
                isLoading={sessionLoading}
              />
            </CardContent>
          </Card>

          {/* T023 — Tip sections */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Gratuity</CardTitle>
            </CardHeader>
            <CardContent className='space-y-5 pt-0'>
              <CheckoutTipSection
                label='Tip the Auctioneer'
                presets={[2000, 5000, 10000]}
                defaultAmount={5000}
                value={auctioneerTipCents}
                onChange={(cents) => handleTipChange('auctioneer', cents)}
              />
              <Separator />
              <CheckoutTipSection
                label='Tip the FundrBolt Development Team'
                presets={[500, 1000, 2500]}
                defaultAmount={0}
                value={platformTipCents}
                onChange={(cents) => handleTipChange('platform', cents)}
              />
              {event.name && (
                <p className='text-muted-foreground text-xs'>
                  Help the FundrBolt team to continue supporting great causes
                  like <span className='font-medium'>{event.name}</span> through
                  their fundraising software.
                </p>
              )}
            </CardContent>
          </Card>

          {/* T024 — Payment methods */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Payment Method</CardTitle>
            </CardHeader>
            <CardContent className='pt-0'>
              <CheckoutPaymentMethods
                value={paymentMethod}
                onChange={handlePaymentMethodChange}
                cashInstructions={checkoutStatus?.cash_instructions}
                eventNpoName={event.npo_name ?? undefined}
                npoId={event.npo_id ?? undefined}
                selectedProfileId={selectedProfileId}
                onSelectProfile={setSelectedProfileId}
                totalAmount={totalCents / 100}
                returnUrl={`${window.location.origin}/events/${slug}/checkout`}
              />
            </CardContent>
          </Card>

          {/* Processing fee toggle — card only */}
          {showProcessingFeeToggle && (
            <Card>
              <CardContent className='pt-6'>
                <div className='flex items-start gap-3'>
                  <Checkbox
                    id='cover-fee'
                    checked={coverProcessingFee}
                    onCheckedChange={(checked) =>
                      handleCoverFeeChange(checked === true)
                    }
                    className='mt-0.5'
                  />
                  <div className='space-y-1'>
                    <Label
                      htmlFor='cover-fee'
                      className='cursor-pointer leading-none font-medium'
                    >
                      Cover processing fee ({fmtCurrency(processingFeeCents)})
                    </Label>
                    <p className='text-muted-foreground text-xs'>
                      Adding {fmtCurrency(processingFeeCents)} helps 100% of
                      your contribution go directly to the cause.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Total */}
          <Card>
            <CardContent className='pt-6'>
              <div className='mb-4 flex items-center justify-between'>
                <span className='text-muted-foreground text-sm'>Subtotal</span>
                <span className='text-sm tabular-nums'>
                  {fmtCurrency(subtotalCents)}
                </span>
              </div>
              {auctioneerTipCents > 0 && (
                <div className='mb-2 flex items-center justify-between'>
                  <span className='text-muted-foreground text-sm'>
                    Tip the Auctioneer
                  </span>
                  <span className='text-sm tabular-nums'>
                    {fmtCurrency(auctioneerTipCents)}
                  </span>
                </div>
              )}
              {platformTipCents > 0 && (
                <div className='mb-2 flex items-center justify-between'>
                  <span className='text-muted-foreground text-sm'>
                    Tip the FundrBolt Team
                  </span>
                  <span className='text-sm tabular-nums'>
                    {fmtCurrency(platformTipCents)}
                  </span>
                </div>
              )}
              {coverProcessingFee && processingFeeCents > 0 && (
                <div className='mb-2 flex items-center justify-between'>
                  <span className='text-muted-foreground text-sm'>
                    Processing Fee
                  </span>
                  <span className='text-sm tabular-nums'>
                    {fmtCurrency(processingFeeCents)}
                  </span>
                </div>
              )}
              <Separator className='my-3' />
              <div className='flex items-center justify-between'>
                <span className='font-semibold'>Total</span>
                <span className='text-lg font-bold'>
                  {fmtCurrency(totalCents)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Swipe to review */}
          <Card>
            <CardContent className='space-y-4 pt-6'>
              {submitError && (
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              {confirmMutation.isPending && (
                <div className='flex items-center justify-center gap-2 py-4'>
                  <Loader2 className='h-5 w-5 animate-spin' />
                  <span className='text-sm'>Processing payment…</span>
                </div>
              )}

              {!confirmMutation.isPending && (
                <div className='space-y-3'>
                  <SwipeToConfirm
                    key={confirmStage}
                    label='Slide to Confirm'
                    onComplete={handleSlideToReview}
                    disabled={
                      swipeDisabled || (paymentMethod === 'card' && !canCardPay)
                    }
                    completed={confirmStage === 'submitted'}
                  />
                  {!checkoutOpen && (
                    <div className='flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3'>
                      <AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-blue-600' />
                      <p className='text-sm text-blue-800'>
                        Checkout is not open yet. You can review your items and
                        set up payment, but you won&apos;t be able to confirm
                        until the event coordinator opens checkout.
                      </p>
                    </div>
                  )}
                  {checkoutOpen && showUpdateBanner && (
                    <div className='flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3'>
                      <AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-amber-600' />
                      <div className='min-w-0 flex-1 text-sm text-amber-800'>
                        <p className='font-medium'>
                          Your items were updated — review required
                        </p>
                        <p className='mt-0.5 text-xs text-amber-700'>
                          Scroll up and tap{' '}
                          <strong className='font-semibold'>Got it</strong> on
                          the amber banner to continue.
                        </p>
                      </div>
                    </div>
                  )}
                  {checkoutOpen &&
                    !showUpdateBanner &&
                    paymentMethod === 'card' &&
                    !canCardPay && (
                      <p className='text-muted-foreground text-center text-xs'>
                        Select a card above to continue.
                      </p>
                    )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Confirmation dialog */}
          <Dialog
            open={confirmStage === 'reviewing'}
            onOpenChange={(open) => {
              if (!open && confirmStage === 'reviewing') setConfirmStage('idle')
            }}
          >
            <DialogContent className='max-w-sm'>
              <DialogHeader>
                <DialogTitle>Confirm Payment</DialogTitle>
              </DialogHeader>

              <div className='max-h-[60vh] space-y-1 overflow-y-auto text-sm'>
                {displayLineItems.map((item) => (
                  <div
                    key={`${item.type}-${item.label}`}
                    className='flex items-center justify-between py-0.5'
                  >
                    <span className='text-foreground/70 flex-1 pr-4'>
                      {item.label}
                    </span>
                    <span className='tabular-nums'>
                      {fmtCurrency(item.amount * 100)}
                    </span>
                  </div>
                ))}
                {coverProcessingFee && processingFeeCents > 0 && (
                  <div className='flex items-center justify-between py-0.5'>
                    <span className='text-foreground/70'>Processing Fee</span>
                    <span className='tabular-nums'>
                      {fmtCurrency(processingFeeCents)}
                    </span>
                  </div>
                )}
                <Separator className='my-2' />
                <div className='flex items-center justify-between font-semibold'>
                  <span>Total</span>
                  <span className='text-lg'>{fmtCurrency(totalCents)}</span>
                </div>
              </div>

              <SwipeToConfirm
                label='Slide to Confirm Payment'
                onComplete={handleDialogConfirm}
                disabled={confirmMutation.isPending}
                completed={confirmStage === 'submitted'}
              />

              {confirmMutation.isPending && (
                <div className='flex items-center justify-center gap-2 py-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  <span className='text-sm'>Processing payment…</span>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Booth instructions for non-card methods (inline reminder) */}
          {(paymentMethod === 'cash' ||
            paymentMethod === 'check' ||
            paymentMethod === 'daf') && (
            <BoothInstructionsCard
              cashInstructions={checkoutStatus?.cash_instructions}
              npoName={event.npo_name ?? undefined}
            />
          )}

          {/* T053 — Contact admin */}
          <div className='flex justify-center pb-4'>
            <ContactAdminForm eventId={event.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
