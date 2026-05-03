import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useViewPreference } from '@/hooks/use-view-preference'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import {
  createQuickEntryRGEntry,
  getQuickEntryRGAllEntries,
  getQuickEntryRGItems,
  type QuickEntryRGHistoryItem,
  type QuickEntryRGItem,
} from '../api/quickEntryApi'

interface Props {
  eventId: string
}

export function RevenueGeneratorEntryForm({ eventId }: Props) {
  const [selectedItemId, setSelectedItemId] = useState('')
  const [bidderNumber, setBidderNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)
  const bidderRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useViewPreference('rg-entries')

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['quick-entry', 'rg-items', eventId],
    queryFn: () => getQuickEntryRGItems(eventId),
    enabled: !!eventId,
    retry: false,
  })

  const { data: historyData } = useQuery({
    queryKey: ['quick-entry', 'rg-entries', eventId],
    queryFn: () => getQuickEntryRGAllEntries(eventId),
    enabled: !!eventId,
    refetchInterval: 10_000,
  })

  const allEntries: QuickEntryRGHistoryItem[] = historyData ?? []

  useEffect(() => {
    if (!isLoading) {
      setLoadingTimedOut(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setLoadingTimedOut(true)
    }, 3000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isLoading])

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
      await createQuickEntryRGEntry(eventId, selectedItemId, bidder)
      await queryClient.invalidateQueries({
        queryKey: ['quick-entry', 'rg-entries', eventId],
      })
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
        {isLoading && !loadingTimedOut ? (
          <p className='text-muted-foreground text-sm'>Loading items…</p>
        ) : isError || loadingTimedOut ? (
          <p className='text-destructive text-sm'>
            Unable to load revenue generator items right now.
          </p>
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

      {allEntries.length > 0 && (
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
              All Entries ({allEntries.length})
            </p>
            <DataTableViewToggle value={viewMode} onChange={setViewMode} />
          </div>

          {viewMode === 'card' ? (
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {allEntries.map((entry) => (
                <div
                  key={entry.entry_id}
                  className='space-y-1 rounded-md border p-3'
                >
                  <div className='flex items-center justify-between'>
                    <Badge variant='outline'>#{entry.bidder_number}</Badge>
                    <span className='text-muted-foreground text-xs'>
                      {new Date(entry.purchased_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className='text-sm font-medium'>
                    {entry.donor_name ?? (
                      <span className='text-muted-foreground'>
                        Unknown donor
                      </span>
                    )}
                  </p>
                  <p className='text-muted-foreground truncate text-sm'>
                    {entry.item_name}
                  </p>
                  <div className='flex items-center justify-between text-sm'>
                    <span className='font-medium'>
                      ${Number(entry.amount_paid).toFixed(2)}
                    </span>
                    <span className='text-muted-foreground'>
                      {entry.entry_count_for_item}x
                      {entry.table_number != null
                        ? ` · T${entry.table_number}`
                        : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full min-w-[540px] text-sm'>
                <thead>
                  <tr className='bg-muted/20 text-left'>
                    <th className='px-3 py-2 font-medium'>Bidder</th>
                    <th className='px-3 py-2 font-medium'>Name</th>
                    <th className='px-3 py-2 font-medium'>Table</th>
                    <th className='px-3 py-2 font-medium'>Item</th>
                    <th className='px-3 py-2 font-medium'>Entries</th>
                    <th className='px-3 py-2 font-medium'>Amount</th>
                    <th className='px-3 py-2 font-medium'>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {allEntries.map((entry) => (
                    <tr
                      key={entry.entry_id}
                      className='hover:bg-muted/10 border-t transition-colors first:border-t-0'
                    >
                      <td className='px-3 py-2'>
                        <Badge variant='outline'>#{entry.bidder_number}</Badge>
                      </td>
                      <td className='px-3 py-2'>
                        {entry.donor_name ?? (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </td>
                      <td className='px-3 py-2'>
                        {entry.table_number != null ? (
                          <span className='font-medium'>
                            T{entry.table_number}
                          </span>
                        ) : (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </td>
                      <td className='max-w-[140px] truncate px-3 py-2'>
                        {entry.item_name}
                      </td>
                      <td className='px-3 py-2 text-center'>
                        {entry.entry_count_for_item}x
                      </td>
                      <td className='px-3 py-2 font-medium'>
                        ${Number(entry.amount_paid).toFixed(2)}
                      </td>
                      <td className='text-muted-foreground px-3 py-2 text-xs'>
                        {new Date(entry.purchased_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
