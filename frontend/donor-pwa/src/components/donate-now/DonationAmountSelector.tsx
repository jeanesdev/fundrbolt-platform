import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { useDonateNow } from '@/features/donate-now/useDonateNow'
import type { DonationTier } from '@/lib/api/donateNow'
import { DonationTierButtons } from './DonationTierButtons'

interface DonationAmountSelectorProps {
  state: ReturnType<typeof useDonateNow>
  tiers: DonationTier[]
}

export function DonationAmountSelector({ state, tiers }: DonationAmountSelectorProps) {
  const {
    selectedAmount,
    setSelectedAmount,
    customAmount,
    setCustomAmount,
    coversProcessingFee,
    setCoversProcessingFee,
    effectiveAmountCents,
    processingFeeCents,
    totalCents,
    feePercent,
    setShowConfirm,
  } = state

  const handleTierSelect = (cents: number) => {
    setSelectedAmount(cents)
    setCustomAmount('')
  }

  const isValid = effectiveAmountCents > 0

  return (
    <section className='space-y-4'>
      <h2 className='text-xl font-semibold'>Choose an Amount</h2>

      <DonationTierButtons
        tiers={tiers}
        selectedAmount={customAmount ? 0 : selectedAmount}
        onSelect={handleTierSelect}
      />

      <div className='space-y-1'>
        <Label htmlFor='custom-amount'>Or enter a custom amount</Label>
        <div className='relative'>
          <span className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'>$</span>
          <Input
            id='custom-amount'
            type='number'
            min='1'
            step='1'
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value)
              setSelectedAmount(0)
            }}
            placeholder='0'
            className='pl-7'
          />
        </div>
      </div>

      {feePercent > 0 && (
        <div className='flex items-center justify-between rounded-lg bg-muted/50 p-3'>
          <div>
            <p className='text-sm font-medium'>Cover processing fee ({(feePercent * 100).toFixed(1)}%)</p>
            <p className='text-xs text-muted-foreground'>So 100% of your gift goes to the cause</p>
          </div>
          <Switch
            checked={coversProcessingFee}
            onCheckedChange={setCoversProcessingFee}
          />
        </div>
      )}

      {isValid && (
        <div className='rounded-lg border p-3 text-sm'>
          <div className='flex justify-between'>
            <span>Donation</span>
            <span>${(effectiveAmountCents / 100).toFixed(2)}</span>
          </div>
          {processingFeeCents > 0 && (
            <div className='flex justify-between text-muted-foreground'>
              <span>Processing fee</span>
              <span>${(processingFeeCents / 100).toFixed(2)}</span>
            </div>
          )}
          <div className='mt-2 flex justify-between border-t pt-2 font-semibold'>
            <span>Total charged</span>
            <span>${(totalCents / 100).toFixed(2)}</span>
          </div>
        </div>
      )}

      <Button
        className='w-full'
        size='lg'
        disabled={!isValid}
        onClick={() => setShowConfirm(true)}
      >
        Donate ${isValid ? (totalCents / 100).toFixed(2) : '—'}
      </Button>
    </section>
  )
}
