/**
 * CheckoutTipSection — T017
 *
 * Preset tip buttons + WheelPicker dialog for custom tips.
 */
import { useMemo, useState } from 'react'
import { WheelPicker, WheelPickerWrapper } from '@ncdai/react-wheel-picker'
import '@ncdai/react-wheel-picker/style.css'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const TIP_WHEEL_STEP_CENTS = 500 // $5 steps
const TIP_WHEEL_MIN_CENTS = 0
const TIP_WHEEL_MAX_CENTS = 50000 // $500

export interface CheckoutTipSectionProps {
  label: string
  presets: number[]
  defaultAmount: number
  value: number
  onChange: (cents: number) => void
}

function fmtDollars(cents: number): string {
  if (cents === 0) return '$0'
  return `$${(cents / 100).toFixed(0)}`
}

export function CheckoutTipSection({
  label,
  presets,
  value,
  onChange,
}: CheckoutTipSectionProps) {
  const [customOpen, setCustomOpen] = useState(false)
  const [wheelValue, setWheelValue] = useState<number>(
    Math.round(value / TIP_WHEEL_STEP_CENTS) * TIP_WHEEL_STEP_CENTS
  )

  const wheelOptions = useMemo(() => {
    const options = []
    for (
      let amount = TIP_WHEEL_MIN_CENTS;
      amount <= TIP_WHEEL_MAX_CENTS;
      amount += TIP_WHEEL_STEP_CENTS
    ) {
      options.push({
        value: amount,
        label: fmtDollars(amount),
      })
    }
    return options
  }, [])

  const isPreset = presets.includes(value)
  const isZero = value === 0
  const isCustom = !isPreset && !isZero

  function openCustom() {
    const normalized =
      Math.round(value / TIP_WHEEL_STEP_CENTS) * TIP_WHEEL_STEP_CENTS
    setWheelValue(
      Math.min(Math.max(normalized, TIP_WHEEL_MIN_CENTS), TIP_WHEEL_MAX_CENTS)
    )
    setCustomOpen(true)
  }

  function applyCustom() {
    onChange(wheelValue)
    setCustomOpen(false)
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium'>{label}</span>
        <span className='text-sm font-semibold'>{fmtDollars(value)}</span>
      </div>

      <div className='flex flex-wrap gap-2'>
        {/* $0 / No tip */}
        <button
          type='button'
          onClick={() => onChange(0)}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            isZero
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border hover:bg-muted'
          }`}
        >
          None
        </button>

        {presets.map((preset) => (
          <button
            key={preset}
            type='button'
            onClick={() => onChange(preset)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              value === preset
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted'
            }`}
          >
            {fmtDollars(preset)}
          </button>
        ))}

        <button
          type='button'
          onClick={openCustom}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            isCustom
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border hover:bg-muted'
          }`}
        >
          {isCustom ? fmtDollars(value) : 'Custom'}
        </button>
      </div>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className='max-w-xs'>
          <DialogHeader>
            <DialogTitle>Custom {label}</DialogTitle>
          </DialogHeader>

          <div className='relative h-[140px] overflow-hidden rounded-2xl px-3 py-2'>
            <WheelPickerWrapper className='flex h-full items-center justify-center'>
              <WheelPicker
                value={wheelValue}
                onValueChange={(v) => setWheelValue(Number(v))}
                options={wheelOptions}
                visibleCount={7}
                optionItemHeight={28}
                classNames={{
                  highlightWrapper: 'bg-muted/85 border-y border-border/70',
                  highlightItem: 'text-base font-semibold text-foreground',
                }}
              />
            </WheelPickerWrapper>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setCustomOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyCustom}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CheckoutTipSection
