import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createQuickEntryRGEntry,
  getQuickEntryRGItems,
  type QuickEntryRGEntryResponse,
  type QuickEntryRGItem,
} from '../api/quickEntryApi'

interface Props {
  eventId: string
}

export function RevenueGeneratorEntryForm({ eventId }: Props) {
  const [selectedItemId, setSelectedItemId] = useState('')
  const [bidderNumber, setBidderNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [recentEntries, setRecentEntries] = useState<
    QuickEntryRGEntryResponse[]
  >([])
  const bidderRef = useRef<HTMLInputElement>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['quick-entry', 'rg-items', eventId],
    queryFn: () => getQuickEntryRGItems(eventId),
    enabled: !!eventId,
  })

  const selectedItem = items.find(
    (i: QuickEntryRGItem) => i.id === selectedItemId
  )

  useEffect(() => {
    if (items.length > 0 && !selectedItemId) {
      setSelectedItemId(items[0].id)
    }
  }, [items, selectedItemId])

  const handleSubmit = async () => {
    const bidder = parseInt(bidderNumber, 10)
    if (!selectedItemId || isNaN(bidder) || bidder < 100 || bidder > 999) return
    setSubmitting(true)
    try {
      const result = await createQuickEntryRGEntry(
        eventId,
        selectedItemId,
        bidder
      )
      setRecentEntries((prev) => [result, ...prev].slice(0, 20))
      setBidderNumber('')
      bidderRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-1'>
        <label className='text-sm font-medium'>Item</label>
        {isLoading ? (
          <p className='text-muted-foreground text-sm'>Loading items…</p>
        ) : items.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            No open revenue generator items for this event.
          </p>
        ) : (
          <div className='flex flex-wrap gap-2'>
            {items.map((item: QuickEntryRGItem) => (
              <Button
                key={item.id}
                variant={selectedItemId === item.id ? 'default' : 'outline'}
                size='sm'
                onClick={() => setSelectedItemId(item.id)}
              >
                {item.name}{' '}
                <span className='ml-1 opacity-70'>
                  ${Number(item.price_per_entry).toFixed(2)}
                </span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <div className='space-y-2'>
          <div className='space-y-1'>
            <label className='text-sm font-medium' htmlFor='rg-bidder'>
              Bidder Number
            </label>
            <div className='flex gap-2'>
              <Input
                id='rg-bidder'
                ref={bidderRef}
                type='number'
                min={100}
                max={999}
                placeholder='e.g. 142'
                value={bidderNumber}
                onChange={(e) => setBidderNumber(e.target.value)}
                onKeyDown={handleKeyDown}
                className='max-w-[160px]'
                autoFocus
              />
              <Button
                onClick={handleSubmit}
                disabled={submitting || !bidderNumber}
              >
                {submitting
                  ? 'Recording…'
                  : `Record Entry — $${Number(selectedItem.price_per_entry).toFixed(2)}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {recentEntries.length > 0 && (
        <div className='space-y-1'>
          <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
            Recent Entries
          </p>
          <div className='space-y-1'>
            {recentEntries.map((entry, idx) => (
              <div
                key={`${entry.entry_id}-${idx}`}
                className='bg-muted/30 flex items-center justify-between rounded px-2 py-1 text-sm'
              >
                <span>
                  <Badge variant='outline' className='mr-2'>
                    #{entry.bidder_number}
                  </Badge>
                  {entry.donor_name ?? `Bidder #${entry.bidder_number}`}
                </span>
                <span className='text-muted-foreground'>
                  {entry.item_name} · {entry.entry_count_for_item}x ·{' '}
                  <span className='text-foreground font-medium'>
                    ${Number(entry.amount_paid).toFixed(2)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
