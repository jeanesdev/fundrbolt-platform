import type { DonationTier } from '@/lib/api/donateNow'

interface DonationTierButtonsProps {
  tiers: DonationTier[]
  selectedAmount: number
  onSelect: (cents: number) => void
}

export function DonationTierButtons({ tiers, selectedAmount, onSelect }: DonationTierButtonsProps) {
  if (tiers.length === 0) return null

  return (
    <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
      {tiers.map((tier) => (
        <button
          key={tier.id}
          onClick={() => onSelect(tier.amount_cents)}
          className={`rounded-lg border-2 p-3 text-left transition-colors ${selectedAmount === tier.amount_cents
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:border-primary/50'
            }`}
        >
          <div className='text-lg font-bold'>${(tier.amount_cents / 100).toFixed(0)}</div>
          {tier.impact_statement && (
            <div className='mt-0.5 text-xs text-muted-foreground line-clamp-2'>
              {tier.impact_statement}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
