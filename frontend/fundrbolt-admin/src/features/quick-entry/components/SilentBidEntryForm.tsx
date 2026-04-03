import { BidderAvatar } from '@/components/bidder-avatar'
import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useViewPreference } from '@/hooks/use-view-preference'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react'
import type {
  QuickEntrySilentBidResponse,
  QuickEntrySilentItem,
} from '../api/quickEntryApi'

function parseToWholeDollar(value: string): string {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return ''
  return Number.parseInt(digits, 10).toLocaleString('en-US')
}

interface SilentBidEntryFormProps {
  items: QuickEntrySilentItem[]
  isLoadingItems: boolean
  isItemsError: boolean
  selectedItemId: string
  selectedItem: QuickEntrySilentItem | undefined
  onSelectItem: (id: string) => void
  amount: string
  bidderNumber: string
  bidderRef: React.RefObject<HTMLInputElement | null>
  recentBids: QuickEntrySilentBidResponse[]
  isSubmitting: boolean
  onAmountChange: (v: string) => void
  onBidderNumberChange: (v: string) => void
  onBidderKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  onSubmit: () => void
}

export function SilentBidEntryForm({
  items,
  isLoadingItems,
  isItemsError,
  selectedItemId,
  selectedItem,
  onSelectItem,
  amount,
  bidderNumber,
  bidderRef,
  recentBids,
  isSubmitting,
  onAmountChange,
  onBidderNumberChange,
  onBidderKeyDown,
  onSubmit,
}: SilentBidEntryFormProps) {
  const [itemMenuOpen, setItemMenuOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const amountRef = useRef<HTMLInputElement>(null)
  const [viewMode, setViewMode] = useViewPreference('silent-bid-log')

  const handleItemSelect = (id: string) => {
    onSelectItem(id)
    setItemMenuOpen(false)
    setItemSearch('')
  }

  const handleItemSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Tab') return
    const search = itemSearch.trim().toLowerCase()
    if (!search) return
    const match = items.find(
      (i) =>
        i.bid_number.toString().startsWith(search) ||
        i.title.toLowerCase().includes(search)
    )
    if (!match) return
    e.preventDefault()
    handleItemSelect(match.id)
    window.setTimeout(() => {
      amountRef.current?.focus()
      amountRef.current?.select()
    }, 0)
  }

  const handleAmountKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      bidderRef.current?.focus()
      bidderRef.current?.select()
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <div className='space-y-3'>
      {/* Item selector */}
      <div className='space-y-1'>
        <label className='text-sm font-medium' htmlFor='silent-item'>
          Silent Auction Item
        </label>
        <Popover open={itemMenuOpen} onOpenChange={setItemMenuOpen}>
          <PopoverTrigger asChild>
            <button
              id='silent-item'
              type='button'
              role='combobox'
              aria-expanded={itemMenuOpen}
              className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus-visible:ring-[3px]'
            >
              <span className='truncate text-left'>
                {selectedItem
                  ? `#${selectedItem.bid_number} · ${selectedItem.title}`
                  : isLoadingItems
                    ? 'Loading items…'
                    : isItemsError
                      ? 'Failed to load items'
                      : items.length === 0
                        ? 'No silent auction items'
                        : 'Select item'}
              </span>
              <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className='w-[var(--radix-popover-trigger-width)] p-0'
            align='start'
          >
            <Command>
              <CommandInput
                placeholder='Search item number or name…'
                value={itemSearch}
                onValueChange={setItemSearch}
                onKeyDown={handleItemSearchKeyDown}
              />
              <CommandList className='max-h-72'>
                <CommandEmpty>No items found.</CommandEmpty>
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.bid_number} ${item.title}`}
                      onSelect={() => handleItemSelect(item.id)}
                      className='flex items-center gap-3 py-2'
                    >
                      <div className='h-12 w-12 shrink-0 overflow-hidden rounded'>
                        {item.primary_image_url ? (
                          <img
                            src={item.primary_image_url}
                            alt={item.title}
                            className='h-full w-full object-cover'
                          />
                        ) : (
                          <div className='bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-[10px]'>
                            No img
                          </div>
                        )}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-medium'>
                          #{item.bid_number} · {item.title}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          Start: $
                          {Math.round(item.starting_bid).toLocaleString(
                            'en-US'
                          )}
                          {' · '}Increment: $
                          {Math.round(item.bid_increment).toLocaleString(
                            'en-US'
                          )}
                        </p>
                        {item.current_bid_amount != null && (
                          <p className='text-xs font-medium text-green-600 dark:text-green-400'>
                            Current: $
                            {Math.round(item.current_bid_amount).toLocaleString(
                              'en-US'
                            )}
                          </p>
                        )}
                      </div>
                      <Check
                        className={cn(
                          'ml-auto h-4 w-4 shrink-0',
                          selectedItemId === item.id
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected item card */}
      {selectedItem ? (
        <section className='rounded-md border p-3'>
          <div className='grid grid-cols-[72px_1fr] items-start gap-2'>
            {selectedItem.primary_image_url ? (
              <img
                src={selectedItem.primary_image_url}
                alt={selectedItem.title}
                className='h-16 w-full rounded object-cover'
              />
            ) : (
              <div className='bg-muted text-muted-foreground flex h-16 w-full items-center justify-center rounded text-xs'>
                No image
              </div>
            )}
            <div className='space-y-0.5'>
              <p className='text-sm font-medium'>
                #{selectedItem.bid_number} · {selectedItem.title}
              </p>
              <div className='flex flex-wrap gap-x-4 gap-y-0.5 text-sm'>
                <span className='text-muted-foreground'>
                  Starting: $
                  {Math.round(selectedItem.starting_bid).toLocaleString(
                    'en-US'
                  )}
                </span>
                <span className='text-muted-foreground'>
                  Increment: $
                  {Math.round(selectedItem.bid_increment).toLocaleString(
                    'en-US'
                  )}
                </span>
              </div>
              <div className='flex flex-wrap gap-x-4 gap-y-0.5 text-sm'>
                {selectedItem.current_bid_amount != null ? (
                  <span className='font-medium text-green-600 dark:text-green-400'>
                    Current High: $
                    {Math.round(selectedItem.current_bid_amount).toLocaleString(
                      'en-US'
                    )}
                  </span>
                ) : (
                  <span className='text-muted-foreground'>No bids yet</span>
                )}
                {selectedItem.min_next_bid_amount != null && (
                  <span className='text-muted-foreground'>
                    Min Next: $
                    {Math.round(
                      selectedItem.min_next_bid_amount
                    ).toLocaleString('en-US')}
                  </span>
                )}
              </div>
              {selectedItem.bid_count > 0 && (
                <p className='text-muted-foreground text-xs'>
                  {selectedItem.bid_count} bid
                  {selectedItem.bid_count !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Entry form */}
      {selectedItem ? (
        <form className='grid grid-cols-2 gap-3' onSubmit={handleSubmit}>
          <div className='space-y-1'>
            <label className='text-sm font-medium' htmlFor='silent-amount'>
              Bid Amount
            </label>
            <input
              id='silent-amount'
              ref={amountRef}
              className='h-12 w-full rounded-md border px-3 py-2 text-lg'
              inputMode='numeric'
              value={amount}
              onChange={(e) =>
                onAmountChange(parseToWholeDollar(e.target.value))
              }
              onKeyDown={handleAmountKeyDown}
              placeholder={
                selectedItem.min_next_bid_amount
                  ? Math.round(selectedItem.min_next_bid_amount).toLocaleString(
                    'en-US'
                  )
                  : Math.round(selectedItem.starting_bid).toLocaleString(
                    'en-US'
                  )
              }
              disabled={isSubmitting}
            />
          </div>

          <div className='space-y-1'>
            <label className='text-sm font-medium' htmlFor='silent-bidder'>
              Bidder Number
            </label>
            <input
              id='silent-bidder'
              ref={bidderRef}
              className='h-12 w-full rounded-md border px-3 py-2 text-lg'
              inputMode='numeric'
              value={bidderNumber}
              onChange={(e) =>
                onBidderNumberChange(e.target.value.replace(/[^\d]/g, ''))
              }
              onKeyDown={onBidderKeyDown}
              placeholder='123'
              disabled={isSubmitting}
            />
          </div>

          <div className='col-span-2'>
            <button
              type='submit'
              className='bg-primary text-primary-foreground h-12 w-full rounded-md px-4 py-3 text-base font-medium disabled:cursor-not-allowed disabled:opacity-60'
              disabled={isSubmitting || !amount || !bidderNumber}
            >
              {isSubmitting ? 'Placing Bid…' : 'Place Silent Bid'}
            </button>
          </div>
        </form>
      ) : null}

      {/* Recent bids log */}
      {selectedItem && recentBids.length > 0 ? (
        <>
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-medium'>Bid History</h3>
            <DataTableViewToggle value={viewMode} onChange={setViewMode} />
          </div>
          {viewMode === 'card' ? (
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {recentBids.map((bid) => (
                <div key={bid.id} className='space-y-1 rounded-md border p-3'>
                  <div className='flex items-center justify-between'>
                    <span className='font-medium'>#{bid.bidder_number}</span>
                    <span className='font-semibold'>
                      ${Math.round(bid.amount).toLocaleString('en-US')}
                    </span>
                  </div>
                  <p className='flex items-center gap-2 text-sm'>
                    {bid.donor_name ? (
                      <BidderAvatar name={bid.donor_name} />
                    ) : null}
                    {bid.donor_name ?? '—'}
                  </p>
                  <div className='flex items-center justify-between'>
                    <span className='text-muted-foreground text-xs'>
                      {new Date(bid.placed_at).toLocaleTimeString()}
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        bid.bid_status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {bid.bid_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full min-w-[480px] text-sm'>
                <thead>
                  <tr className='bg-muted/20 text-left'>
                    <th className='px-3 py-2'>Bidder</th>
                    <th className='px-3 py-2'>Donor</th>
                    <th className='px-3 py-2'>Amount</th>
                    <th className='px-3 py-2'>Status</th>
                    <th className='px-3 py-2'>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBids.map((bid) => (
                    <tr key={bid.id} className='border-t'>
                      <td className='px-3 py-2'>{bid.bidder_number}</td>
                      <td className='px-3 py-2'>
                        <div className='flex items-center gap-2'>
                          {bid.donor_name ? (
                            <BidderAvatar name={bid.donor_name} />
                          ) : null}
                          {bid.donor_name ?? '—'}
                        </div>
                      </td>
                      <td className='px-3 py-2'>
                        ${Math.round(bid.amount).toLocaleString('en-US')}
                      </td>
                      <td className='px-3 py-2'>
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-xs font-medium',
                            bid.bid_status === 'active'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {bid.bid_status}
                        </span>
                      </td>
                      <td className='px-3 py-2'>
                        {new Date(bid.placed_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : selectedItem ? (
        <p className='text-muted-foreground text-sm'>
          No bids placed for this item yet.
        </p>
      ) : null}
    </div>
  )
}
