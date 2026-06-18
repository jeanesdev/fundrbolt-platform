import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { useDonateNow } from '@/features/donate-now/useDonateNow'

interface DonationConfirmDialogProps {
  state: ReturnType<typeof useDonateNow>
  npoName: string
}

export function DonationConfirmDialog({
  state,
  npoName,
}: DonationConfirmDialogProps) {
  const {
    showConfirm,
    setShowConfirm,
    coversProcessingFee,
    setCoversProcessingFee,
    feePercent,
    effectiveAmountCents,
    processingFeeCents,
    totalCents,
    isMonthly,
    isPending,
    handleDonate,
    donateError,
    savePendingDonation,
  } = state
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()
  const [confirmSlideValue, setConfirmSlideValue] = useState<number[]>([0])
  const [isConfirmDragging, setIsConfirmDragging] = useState(false)

  const knobDiameterPx = 56
  const knobRadiusPx = knobDiameterPx / 2
  const getSliderCenterX = (pct: number) =>
    `calc(${knobRadiusPx}px + (100% - ${knobDiameterPx}px) * ${pct / 100})`
  const getKnobLeft = (pct: number) =>
    `calc(${getSliderCenterX(pct)} - ${knobRadiusPx}px)`
  const getFillWidth = (pct: number) => getSliderCenterX(pct)
  const confirmPercent = confirmSlideValue[0] ?? 0

  const resetConfirmSlide = () => {
    setConfirmSlideValue([0])
    setIsConfirmDragging(false)
  }

  const handleAuthRedirect = (target: 'sign-in' | 'sign-up') => {
    savePendingDonation()
    const url = new URL(window.location.href)
    url.searchParams.set('donateResume', '1')
    const redirect = `${url.pathname}${url.search}`

    if (target === 'sign-in') {
      void navigate({ to: '/sign-in', search: { redirect } })
      return
    }

    void navigate({ to: '/sign-up', search: { intent: 'donor', redirect } })
  }

  return (
    <Dialog
      open={showConfirm}
      onOpenChange={(open) => {
        setShowConfirm(open)
        if (!open) {
          resetConfirmSlide()
        }
      }}
    >
      <DialogContent
        className='max-w-md'
        style={{
          backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))',
          color: 'var(--event-card-text, #ffffff)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--event-card-text, #ffffff)' }}>
            Confirm Your Donation
          </DialogTitle>
          <DialogDescription
            style={{
              color: 'var(--event-card-text-muted, rgba(255,255,255,0.7))',
            }}
          >
            You are about to donate{' '}
            <strong>${(totalCents / 100).toFixed(2)}</strong>{' '}
            {isMonthly ? 'monthly ' : ''}to {npoName}.
            {!isAuthenticated && (
              <>
                <br />
                Sign in or register to complete your donation.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {feePercent > 0 && (
            <div
              className='rounded-lg p-4'
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }}
            >
              <div className='mb-3 flex items-center justify-between'>
                <p
                  className='text-sm font-medium'
                  style={{ color: 'var(--event-card-text, #ffffff)' }}
                >
                  Cover processing fee ({(feePercent * 100).toFixed(1)}%)
                </p>
                <Switch
                  checked={coversProcessingFee}
                  onCheckedChange={setCoversProcessingFee}
                  className='border-white/80 data-[state=checked]:!bg-emerald-700 data-[state=unchecked]:!bg-white/35'
                />
              </div>
              <div className='space-y-1 text-sm'>
                <div className='flex items-center justify-between'>
                  <span
                    style={{
                      color:
                        'var(--event-card-text-muted, rgba(255,255,255,0.7))',
                    }}
                  >
                    Donation amount
                  </span>
                  <span style={{ color: 'var(--event-card-text, #ffffff)' }}>
                    ${(effectiveAmountCents / 100).toFixed(2)}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span
                    style={{
                      color:
                        'var(--event-card-text-muted, rgba(255,255,255,0.7))',
                    }}
                  >
                    Processing fee
                  </span>
                  <span style={{ color: 'var(--event-card-text, #ffffff)' }}>
                    $
                    {coversProcessingFee
                      ? (processingFeeCents / 100).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
                <div className='mt-2 flex items-center justify-between border-t border-white/20 pt-2 text-base font-semibold'>
                  <span style={{ color: 'var(--event-card-text, #ffffff)' }}>
                    Total
                  </span>
                  <span style={{ color: 'var(--event-card-text, #ffffff)' }}>
                    ${(totalCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {isAuthenticated && (
            <div
              className='relative h-14 overflow-hidden rounded-[28px]'
              style={{
                backgroundColor: 'rgb(255, 255, 255)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                touchAction: 'none',
              }}
              onPointerDown={() => setIsConfirmDragging(true)}
              onPointerLeave={() => {
                if (!isConfirmDragging) {
                  setConfirmSlideValue([0])
                }
              }}
            >
              <div className='pointer-events-none absolute inset-0 z-0 bg-white' />
              <div
                className='pointer-events-none absolute top-0 bottom-0 left-0 z-[1] rounded-l-[28px] bg-[rgb(34_197_94)]'
                style={{ width: getFillWidth(confirmPercent) }}
              />
              <div className='pointer-events-none absolute inset-y-0 right-14 left-14 z-[2] flex items-center justify-center text-xs font-semibold text-black sm:text-base'>
                {isPending ? (
                  <span>Processing…</span>
                ) : (
                  <>
                    <span>Slide to Confirm ·</span>
                    <span className='ml-1'>
                      ${(totalCents / 100).toFixed(2)}
                    </span>
                  </>
                )}
              </div>
              <div
                className='pointer-events-none absolute top-0 z-[3] flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--event-primary,59,130,246))] text-white shadow-md'
                style={{ left: getKnobLeft(confirmPercent) }}
              >
                {isPending ? (
                  <Loader2 className='h-5 w-5 animate-spin' />
                ) : (
                  <ArrowRight className='h-6 w-6' />
                )}
              </div>
              <Slider
                value={confirmSlideValue}
                onValueChange={(value) => setConfirmSlideValue(value)}
                onValueCommit={(value) => {
                  setIsConfirmDragging(false)
                  const pct = value[0] ?? 0
                  if (pct >= 95 && !isPending) {
                    handleDonate()
                  }
                  setConfirmSlideValue([0])
                }}
                min={0}
                max={100}
                step={1}
                className='absolute inset-0 z-20 w-full opacity-0'
                aria-label='Slide to confirm donation'
                disabled={isPending}
              />
            </div>
          )}

          {!isAuthenticated && (
            <div className='grid grid-cols-2 gap-3'>
              <Button
                variant='outline'
                onClick={() => handleAuthRedirect('sign-up')}
                style={{
                  color: 'var(--event-card-text, #ffffff)',
                  borderColor: 'rgba(255, 255, 255, 0.4)',
                  backgroundColor: 'rgba(0, 0, 0, 0.15)',
                }}
              >
                Register
              </Button>
              <Button
                onClick={() => handleAuthRedirect('sign-in')}
                style={{
                  backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
                  color: 'var(--event-text-on-primary, #ffffff)',
                }}
              >
                Login
              </Button>
            </div>
          )}

          <Button
            variant='outline'
            onClick={() => setShowConfirm(false)}
            disabled={isPending}
            style={{
              color: 'var(--event-card-text, #ffffff)',
              borderColor: 'rgba(255, 255, 255, 0.4)',
              backgroundColor: 'rgba(0, 0, 0, 0.15)',
            }}
          >
            Cancel
          </Button>
        </div>

        {donateError && (
          <p className='text-destructive text-sm'>
            {(donateError as { response?: { data?: { detail?: string } } })
              .response?.data?.detail ?? 'Payment failed. Please try again.'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
