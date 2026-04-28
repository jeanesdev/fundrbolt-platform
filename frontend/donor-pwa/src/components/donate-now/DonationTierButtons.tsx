import type { DonationTier } from '@/lib/api/donateNow'

interface DonationTierButtonsProps {
  tiers: DonationTier[]
  selectedAmount: number
  isCustomSelected: boolean
  onSelect: (cents: number) => void
  onSelectCustom: () => void
}

export function DonationTierButtons({
  tiers,
  selectedAmount,
  isCustomSelected,
  onSelect,
  onSelectCustom,
}: DonationTierButtonsProps) {
  return (
    <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
      {tiers.map((tier) => {
        const isSelected = selectedAmount === tier.amount_cents
        const impactStatement = tier.impact_statement?.trim()

        return (
          <button
            key={tier.id}
            onClick={() => onSelect(tier.amount_cents)}
            className='rounded-lg border-2 p-3 text-center transition-colors'
            style={
              isSelected
                ? {
                  borderColor: 'rgb(var(--event-primary, 59, 130, 246))',
                  backgroundColor:
                    'rgb(var(--event-primary, 59, 130, 246) / 0.1)',
                  color: 'rgb(var(--event-primary, 59, 130, 246))',
                }
                : {
                  borderColor:
                    'rgb(var(--event-primary, 59, 130, 246) / 0.28)',
                  backgroundColor:
                    'rgb(var(--event-background, 255, 255, 255))',
                  color: 'var(--event-text-on-background, #000000)',
                }
            }
          >
            <div className='text-lg font-bold'>
              ${(tier.amount_cents / 100).toFixed(0)}
            </div>
            {impactStatement ? (
              <div
                className='mt-0.5 line-clamp-2 text-xs'
                style={{
                  color: 'var(--event-text-muted-on-background, #4B5563)',
                }}
              >
                {impactStatement}
              </div>
            ) : null}
          </button>
        )
      })}

      <button
        onClick={onSelectCustom}
        className='rounded-lg border-2 p-3 text-center transition-colors'
        style={
          isCustomSelected
            ? {
              borderColor: 'rgb(var(--event-primary, 59, 130, 246))',
              backgroundColor:
                'rgb(var(--event-primary, 59, 130, 246) / 0.1)',
              color: 'rgb(var(--event-primary, 59, 130, 246))',
            }
            : {
              borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.28)',
              backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
              color: 'var(--event-text-on-background, #000000)',
            }
        }
      >
        <div className='text-lg font-bold'>Custom</div>
        <div
          className='mt-0.5 text-xs'
          style={{ color: 'var(--event-text-muted-on-background, #4B5563)' }}
        >
          Choose any amount
        </div>
      </button>
    </div>
  )
}
