import { type RevenueGeneratorItemSummary } from '@/services/revenueGeneratorService'

interface Props {
  item: RevenueGeneratorItemSummary
  brandPrimary?: string
}

export function RevenueGeneratorCard({ item, brandPrimary }: Props) {
  const primary = brandPrimary ?? '59, 130, 246'

  return (
    <div
      className='animate-card-enter overflow-hidden rounded-2xl border'
      style={{
        borderColor: `rgb(${primary} / 0.2)`,
        backgroundColor: `rgb(${primary} / 0.04)`,
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
              {item.total_entries.toLocaleString()} entries
            </span>
          </div>
          {item.max_entries_per_person && (
            <div>
              <span
                className='text-xs'
                style={{ color: 'var(--event-text-on-background, #6B7280)' }}
              >
                Max {item.max_entries_per_person} per person
              </span>
            </div>
          )}
          <div className='ml-auto'>
            <span
              className='rounded-full px-2 py-0.5 text-xs font-medium'
              style={
                item.is_open
                  ? {
                      backgroundColor: `rgb(${primary} / 0.15)`,
                      color: `rgb(${primary})`,
                    }
                  : {
                      backgroundColor: 'rgb(107, 114, 128, 0.1)',
                      color: 'rgb(107, 114, 128)',
                    }
              }
            >
              {item.is_open ? 'Open' : 'Closed'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
