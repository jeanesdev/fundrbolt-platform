import type { SupportWallEntry as SupportWallEntryType } from '@/lib/api/donateNow'
import { Badge } from '@/components/ui/badge'

interface SupportWallEntryProps {
  entry: SupportWallEntryType
}

export function SupportWallEntry({ entry }: SupportWallEntryProps) {
  const name = entry.is_anonymous
    ? 'Anonymous'
    : (entry.display_name ?? 'Someone')
  const dateStr = new Date(entry.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      className='space-y-1 rounded-lg border p-4'
      style={{
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.22)',
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
      }}
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <span className='font-medium'>{name}</span>
          {entry.is_monthly && (
            <Badge
              variant='outline'
              className='font-semibold'
              style={{
                borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.45)',
                backgroundColor:
                  'rgb(var(--event-primary, 59, 130, 246) / 0.14)',
                color: 'var(--event-text-on-background, #111827)',
              }}
            >
              Monthly
            </Badge>
          )}
        </div>
        <span
          className='text-sm'
          style={{ color: 'var(--event-text-muted-on-background, #4B5563)' }}
        >
          {dateStr}
        </span>
      </div>
      {entry.show_amount && entry.amount_cents != null && (
        <p
          className='text-sm font-semibold'
          style={{ color: 'rgb(var(--event-accent, 248, 113, 113))' }}
        >
          ${(entry.amount_cents / 100).toFixed(2)}
          {entry.tier_label ? ` — ${entry.tier_label}` : ''}
        </p>
      )}
      {entry.message && (
        <p
          className='text-sm'
          style={{ color: 'var(--event-text-muted-on-background, #4B5563)' }}
        >
          {entry.message}
        </p>
      )}
    </div>
  )
}
