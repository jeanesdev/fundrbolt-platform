import type { SupportWallEntry as SupportWallEntryType } from '@/lib/api/donateNow'

interface SupportWallEntryProps {
  entry: SupportWallEntryType
}

export function SupportWallEntry({ entry }: SupportWallEntryProps) {
  const name = entry.is_anonymous ? 'Anonymous' : (entry.display_name ?? 'Someone')
  const dateStr = new Date(entry.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className='rounded-lg border p-4 space-y-1'>
      <div className='flex items-center justify-between'>
        <span className='font-medium'>{name}</span>
        <span className='text-sm text-muted-foreground'>{dateStr}</span>
      </div>
      {entry.show_amount && entry.amount_cents != null && (
        <p className='text-sm text-green-600 font-semibold'>
          ${(entry.amount_cents / 100).toFixed(2)}
          {entry.tier_label ? ` — ${entry.tier_label}` : ''}
        </p>
      )}
      {entry.message && <p className='text-sm text-muted-foreground'>{entry.message}</p>}
    </div>
  )
}
