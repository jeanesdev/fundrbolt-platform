import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { useDonateNow } from '@/features/donate-now/useDonateNow'
import type { DonationTier } from '@/lib/api/donateNow'
import { WheelPicker, WheelPickerWrapper } from '@ncdai/react-wheel-picker'
import '@ncdai/react-wheel-picker/style.css'
import { ArrowRight } from 'lucide-react'
import { useMemo, useState } from 'react'

interface DonationAmountSelectorProps {
  state: ReturnType<typeof useDonateNow>
  tiers: DonationTier[]
}

const WHEEL_STEP_CENTS = 500
const WHEEL_MIN_CENTS = 500
const WHEEL_EXTEND_THRESHOLD_STEPS = 5
const WHEEL_EXTEND_BY_STEPS = 100

const FALLBACK_TIERS: DonationTier[] = [
  {
    id: 'fallback-25',
    amount_cents: 2500,
    impact_statement: '',
    display_order: 0,
  },
  {
    id: 'fallback-50',
    amount_cents: 5000,
    impact_statement: '',
    display_order: 1,
  },
  {
    id: 'fallback-100',
    amount_cents: 10000,
    impact_statement: '',
    display_order: 2,
  },
  {
    id: 'fallback-250',
    amount_cents: 25000,
    impact_statement: '',
    display_order: 3,
  },
]

export function DonationAmountSelector({
  state,
  tiers,
}: DonationAmountSelectorProps) {
  const {
    selectedAmount,
    setSelectedAmount,
    customAmount,
    setCustomAmount,
    isMonthly,
    setIsMonthly,
    coversProcessingFee,
    setCoversProcessingFee,
    effectiveAmountCents,
    totalCents,
    feePercent,
    setShowConfirm,
    isPending,
    wallMessage,
    setWallMessage,
    isAnonymous,
    setIsAnonymous,
    showAmount,
    setShowAmount,
  } = state

  const displayTiers = tiers.length > 0 ? tiers : FALLBACK_TIERS

  const normalizeWheelAmount = (amountCents: number) =>
    Math.max(
      WHEEL_MIN_CENTS,
      Math.round(amountCents / WHEEL_STEP_CENTS) * WHEEL_STEP_CENTS
    )

  const [spinnerAmountCents, setSpinnerAmountCents] = useState<number>(
    normalizeWheelAmount(Math.max(effectiveAmountCents || 2500, WHEEL_MIN_CENTS))
  )
  const [wheelMaxCents, setWheelMaxCents] = useState<number>(
    normalizeWheelAmount(
      Math.max(
        effectiveAmountCents || 2500,
        ...displayTiers.map((tier) => tier.amount_cents),
        25000
      )
    )
  )
  const [isOtherModalOpen, setIsOtherModalOpen] = useState(false)
  const [otherAmountInput, setOtherAmountInput] = useState('')

  // Slide pill state
  const [slideValue, setSlideValue] = useState<number[]>([0])
  const [isSlideConfirmed, setIsSlideConfirmed] = useState(false)

  const sliderKnobDiameterPx = 56
  const sliderKnobRadiusPx = sliderKnobDiameterPx / 2
  const getSliderCenterX = (percent: number) =>
    `calc(${sliderKnobRadiusPx}px + (100% - ${sliderKnobDiameterPx}px) * ${percent / 100})`
  const getSliderKnobLeft = (percent: number) =>
    `calc(${getSliderCenterX(percent)} - ${sliderKnobRadiusPx}px)`
  const getSliderFillWidth = (percent: number) => getSliderCenterX(percent)

  const slidePercent = slideValue[0] ?? 0

  const wheelAmounts = useMemo(() => {
    const amounts: number[] = []
    for (
      let amount = WHEEL_MIN_CENTS;
      amount <= wheelMaxCents;
      amount += WHEEL_STEP_CENTS
    ) {
      amounts.push(amount)
    }
    return amounts
  }, [wheelMaxCents])

  const wheelOptions = useMemo(
    () =>
      wheelAmounts.map((amount) => ({
        value: amount,
        label: `$${(amount / 100).toFixed(0)}`,
      })),
    [wheelAmounts]
  )

  const applySpinnerAmount = (amountCents: number) => {
    const normalized = normalizeWheelAmount(amountCents)
    setSpinnerAmountCents(normalized)

    if (
      normalized >=
      wheelMaxCents - WHEEL_STEP_CENTS * WHEEL_EXTEND_THRESHOLD_STEPS
    ) {
      setWheelMaxCents((prev) =>
        prev + WHEEL_STEP_CENTS * WHEEL_EXTEND_BY_STEPS
      )
    }

    const match = displayTiers.find((tier) => tier.amount_cents === normalized)
    if (match) {
      setSelectedAmount(match.amount_cents)
      setCustomAmount('')
    } else {
      setSelectedAmount(0)
      setCustomAmount((normalized / 100).toFixed(0))
    }
  }

  const handleTierSelect = (cents: number) => {
    applySpinnerAmount(cents)
  }

  const handleSelectCustom = () => {
    const initialAmount = customAmount
      ? Math.max(Math.round(parseFloat(customAmount || '0') * 100), WHEEL_MIN_CENTS)
      : Math.max(effectiveAmountCents || selectedAmount, WHEEL_MIN_CENTS)
    setOtherAmountInput((initialAmount / 100).toFixed(2).replace(/\.00$/, ''))
    setIsOtherModalOpen(true)
  }

  const handleCustomAmountChange = (nextValue: string) => {
    if (!/^\d*(\.\d{0,2})?$/.test(nextValue)) {
      return
    }

    setSelectedAmount(0)
    setCustomAmount(nextValue)

    const parsedAmount = parseFloat(nextValue)
    if (!Number.isNaN(parsedAmount) && parsedAmount > 0) {
      const normalized = normalizeWheelAmount(Math.round(parsedAmount * 100))
      setSpinnerAmountCents(normalized)
      if (
        normalized >=
        wheelMaxCents - WHEEL_STEP_CENTS * WHEEL_EXTEND_THRESHOLD_STEPS
      ) {
        setWheelMaxCents((prev) =>
          prev + WHEEL_STEP_CENTS * WHEEL_EXTEND_BY_STEPS
        )
      }
    }
  }

  const handleOtherAmountConfirm = () => {
    const parsedAmount = parseFloat(otherAmountInput)
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return
    }

    const cents = Math.round(parsedAmount * 100)
    setSelectedAmount(0)
    setCustomAmount(otherAmountInput)
    handleCustomAmountChange(otherAmountInput)
    setSpinnerAmountCents(normalizeWheelAmount(cents))
    setIsOtherModalOpen(false)
  }

  const isValid = effectiveAmountCents > 0
  const isCustomSelected =
    !!customAmount ||
    (isValid &&
      !displayTiers.some((tier) => tier.amount_cents === selectedAmount))

  return (
    <div
      className='rounded-xl p-4 space-y-3'
      style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))' }}
    >
      <Dialog open={isOtherModalOpen} onOpenChange={setIsOtherModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Donation Amount</DialogTitle>
            <DialogDescription>
              Enter your custom donation amount in dollars.
            </DialogDescription>
          </DialogHeader>
          <Input
            type='text'
            inputMode='decimal'
            value={otherAmountInput}
            onChange={(event) => {
              const next = event.target.value
              if (/^\d*(\.\d{0,2})?$/.test(next)) {
                setOtherAmountInput(next)
              }
            }}
            placeholder='e.g. 125'
            aria-label='Custom donation amount'
          />
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsOtherModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleOtherAmountConfirm}>Use Amount</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Giving level buttons */}
      <div className='grid grid-cols-3 gap-2'>
        {displayTiers.map((tier) => {
          const isSelected =
            !isCustomSelected && selectedAmount === tier.amount_cents
          return (
            <button
              key={tier.id}
              onClick={() => handleTierSelect(tier.amount_cents)}
              className='rounded-lg border-2 p-3 text-center transition-colors'
              style={
                isSelected
                  ? {
                    borderColor: 'rgba(255,255,255,0.9)',
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    color: 'var(--event-text-on-primary, #FFFFFF)',
                  }
                  : {
                    borderColor: 'rgba(255,255,255,0.35)',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: 'var(--event-text-on-primary, #FFFFFF)',
                  }
              }
            >
              <div className='text-lg font-bold'>
                ${(tier.amount_cents / 100).toFixed(0)}
              </div>
              {tier.impact_statement?.trim() ? (
                <div className='mt-0.5 line-clamp-2 text-xs opacity-80'>
                  {tier.impact_statement}
                </div>
              ) : null}
            </button>
          )
        })}
        <button
          onClick={handleSelectCustom}
          className='rounded-lg border-2 p-3 text-center transition-colors'
          style={
            isCustomSelected
              ? {
                borderColor: 'rgba(255,255,255,0.9)',
                backgroundColor: 'rgba(255,255,255,0.25)',
                color: 'var(--event-text-on-primary, #FFFFFF)',
              }
              : {
                borderColor: 'rgba(255,255,255,0.35)',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'var(--event-text-on-primary, #FFFFFF)',
              }
          }
        >
          <div className='text-lg font-bold'>
            {isCustomSelected && customAmount
              ? `$${parseFloat(customAmount).toFixed(0)}`
              : 'Other'}
          </div>
        </button>
      </div>

      {/* Wheel picker */}
      <div
        className='relative h-[140px] overflow-hidden rounded-2xl px-3 py-2'
        style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}
      >
        <WheelPickerWrapper className='flex h-full items-center justify-center'>
          <WheelPicker
            value={spinnerAmountCents}
            onValueChange={(value) => applySpinnerAmount(Number(value))}
            options={wheelOptions}
            visibleCount={13}
            dragSensitivity={1.0}
            scrollSensitivity={1.0}
            optionItemHeight={28}
            classNames={{
              optionItem: 'text-sm font-medium text-foreground/60',
              highlightWrapper: 'bg-muted/85 border-y border-border/70',
              highlightItem: 'text-base font-semibold text-foreground',
            }}
          />
        </WheelPickerWrapper>
      </div>

      {/* Processing fee switch */}
      {feePercent > 0 && (
        <div className='flex items-center justify-between'>
          <p
            className='text-sm font-medium'
            style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}
          >
            Cover processing fee ({(feePercent * 100).toFixed(1)}%)
          </p>
          <Switch
            checked={coversProcessingFee}
            onCheckedChange={setCoversProcessingFee}
            className='border-white/80 data-[state=checked]:!bg-emerald-700 data-[state=unchecked]:!bg-white/35'
          />
        </div>
      )}

      <div className='flex items-center justify-between'>
        <p
          className='text-sm font-medium'
          style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}
        >
          Make this monthly
        </p>
        <Switch
          checked={isMonthly}
          onCheckedChange={setIsMonthly}
          className='border-white/80 data-[state=checked]:!bg-emerald-700 data-[state=unchecked]:!bg-white/35'
        />
      </div>

      {/* Total donation label */}
      <div
        className='text-center text-base font-semibold'
        style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}
      >
        Total Donation: ${(totalCents / 100).toFixed(2)}
      </div>

      {/* Slide to donate pill */}
      {isValid && (
        <div
          className='relative h-14 overflow-hidden rounded-[28px]'
          style={{
            backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
            border: '1px solid rgba(255,255,255,0.35)',
          }}
        >
          <div className='pointer-events-none absolute inset-0 z-0 bg-white' />
          <div
            className='pointer-events-none absolute top-0 bottom-0 left-0 z-[1] rounded-l-[28px] bg-[rgb(34_197_94)]'
            style={{ width: getSliderFillWidth(slidePercent) }}
          />
          <div className='pointer-events-none absolute inset-y-0 right-14 left-14 z-[2] flex items-center justify-center text-xs font-semibold text-[var(--event-text-on-background,#000000)] sm:text-base'>
            Slide to Donate ·{' '}
            <span className='ml-1'>${(totalCents / 100).toFixed(2)}</span>
          </div>
          <div
            className='pointer-events-none absolute top-0 z-[3] flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--event-primary,59,130,246))] text-white shadow-md'
            style={{ left: getSliderKnobLeft(slidePercent) }}
          >
            <ArrowRight className='h-6 w-6' />
          </div>
          <Slider
            value={slideValue}
            onValueChange={(v) => {
              if (isSlideConfirmed || isPending) {
                return
              }

              const nextPercent = v[0] ?? 0
              if (nextPercent >= 95) {
                setIsSlideConfirmed(true)
                setShowConfirm(true)
                setSlideValue([0])
                setTimeout(() => {
                  setIsSlideConfirmed(false)
                }, 250)
                return
              }

              setSlideValue(v)
            }}
            min={0}
            max={100}
            step={1}
            className='absolute inset-0 z-20 w-full opacity-0'
            aria-label='Slide to donate'
            disabled={isSlideConfirmed || isPending}
          />
        </div>
      )}

      <div className='space-y-2 rounded-xl bg-white/10 p-3'>
        <div>
          <label
            htmlFor='support-wall-message'
            className='text-xs font-medium'
            style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}
          >
            Support wall message
          </label>
          <Textarea
            id='support-wall-message'
            value={wallMessage}
            onChange={(event) => setWallMessage(event.target.value)}
            placeholder='Share why you support this cause'
            className='mt-1 border-white/40 bg-white text-black placeholder:text-gray-500'
          />
        </div>

        <div className='flex items-center justify-between'>
          <p
            className='text-sm font-medium'
            style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}
          >
            Donate anonymously
          </p>
          <Switch
            checked={isAnonymous}
            onCheckedChange={setIsAnonymous}
            className='border-white/80 data-[state=checked]:!bg-emerald-700 data-[state=unchecked]:!bg-white/35'
          />
        </div>

        <div className='flex items-center justify-between'>
          <p
            className='text-sm font-medium'
            style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}
          >
            Show donation amount on wall
          </p>
          <Switch
            checked={showAmount}
            onCheckedChange={setShowAmount}
            className='border-white/80 data-[state=checked]:!bg-emerald-700 data-[state=unchecked]:!bg-white/35'
          />
        </div>
      </div>
    </div>
  )
}
