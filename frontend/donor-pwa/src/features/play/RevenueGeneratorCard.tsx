import { type RevenueGeneratorItemSummary } from '@/services/revenueGeneratorService'

interface Props {
  item: RevenueGeneratorItemSummary
  brandPrimary?: string
  onPurchase?: (itemId: string) => void
  isPurchasing?: boolean
}

export function RevenueGeneratorCard({
  item,
  brandPrimary,
  onPurchase,
  isPurchasing,
}: Props) {
  const primary = brandPrimary ?? '59, 130, 246'

  return (
    <div
      className='animate-card-enter overflow-hidden rounded-2xl border'
      style={{
        borderColor: `rgba(${primary}, 0.2)`,
        backgroundColor: `rgba(${primary}, 0.04)`,
      }}
    >
      <div className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex-1 space-y-1'>
            <h3
              className='font-semibold'
              style={{ color: 'var(--event-text-on-background, #111827)' }}
            >
              {item.name}
            </h3>
            {item.description && (
              <p
                className='text-sm'
                style={{ color: 'var(--event-text-on-background, #6B7280)' }}
              >
                {item.description}
              </p>
            )}
          </div>
          <div className='shrink-0 text-right'>
            <span
              className='text-lg font-bold'
              style={{ color: `rgb(${primary})` }}
            >
              ${Number(item.price_per_entry).toFixed(2)}
            </span>
            <p
              className='text-xs'
              style={{ color: 'var(--event-text-on-background, #6B7280)' }}
            >
              per entry
            </p>
          </div>
        </div>

        <div className='mt-3 flex items-center gap-4'>
          <div>
            <span
              className='text-sm font-medium'
              style={{ color: 'var(--event-text-on-background, #374151)' }}
            >
              {item.my_entry_count}{' '}
              {item.my_entry_count === 1 ? 'entry' : 'entries'} (mine)
            </span>
          </div>
          {item.current_winner_name && (
            <div>
              <span
                className='text-xs'
                style={{ color: 'var(--event-text-on-background, #6B7280)' }}
              >
                🏆 {item.current_winner_name}
              </span>
            </div>
          )}
          <div className='ml-auto'>
            <span
              className='rounded-full px-2 py-0.5 text-xs font-medium'
              style={
                item.is_open_for_entries
                  ? {
                      backgroundColor: `rgba(${primary}, 0.15)`,
                      color: `rgb(${primary})`,
                    }
                  : {
                      backgroundColor: 'rgba(107, 114, 128, 0.1)',
                      color: 'rgb(107, 114, 128)',
                    }
              }
            >
              {item.is_open_for_entries ? 'Open' : 'Closed'}
            </span>
          </div>
        </div>

        {item.is_open_for_entries && onPurchase && (
          <button
            className='mt-3 w-full rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50'
            style={{ backgroundColor: `rgb(${primary})` }}
            onClick={() => onPurchase(item.id)}
            disabled={isPurchasing}
          >
            {isPurchasing
              ? 'Processing…'
              : `Buy Entry — $${Number(item.price_per_entry).toFixed(2)}`}
          </button>
        )}
      </div>
    </div>
  )
}
