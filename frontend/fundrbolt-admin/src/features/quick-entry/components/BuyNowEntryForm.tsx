import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useViewPreference } from '@/hooks/use-view-preference'
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
import { BidderAvatar } from '@/components/bidder-avatar'
import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import type {
  QuickEntryBuyNowBidResponse,
  QuickEntryBuyNowItem,
  QuickEntryBuyNowSummary,
} from '../api/quickEntryApi'

function parseToWholeDollar(value: string): string {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return ''
  return Number.parseInt(digits, 10).toLocaleString('en-US')
}

interface BuyNowEntryFormProps {
  items: QuickEntryBuyNowItem[]
  isLoadingItems: boolean
  isItemsError: boolean
  selectedItemId: string
  selectedItem: QuickEntryBuyNowItem | undefined
  onSelectItem: (id: string) => void
  amount: string
  bidderNumber: string
  bidderRef: React.RefObject<HTMLInputElement | null>
  recentBids: QuickEntryBuyNowBidResponse[]
  isSubmitting: boolean
  isDeleting: boolean
  onAmountChange: (v: string) => void
  onBidderNumberChange: (v: string) => void
  onBidderKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  onSubmit: () => void
  onDeleteBid: (id: string) => void
  summary?: QuickEntryBuyNowSummary
}

export function BuyNowEntryForm({
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
  isDeleting,
  onAmountChange,
  onBidderNumberChange,
  onBidderKeyDown,
  onSubmit,
  onDeleteBid,
  summary,
}: BuyNowEntryFormProps) {
  const [itemMenuOpen, setItemMenuOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const amountRef = useRef<HTMLInputElement>(null)
  const [viewMode, setViewMode] = useViewPreference('buy-now-log')

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
      {/* Event-level summary metrics */}
      {summary && (
        <div className='grid grid-cols-2 gap-3'>
          <div className='bg-muted/20 rounded-md border p-3'>
            <p className='text-muted-foreground text-xs'>Total Raised</p>
            <p className='text-xl font-semibold'>
              ${Number(summary.total_raised).toLocaleString('en-US')}
            </p>
          </div>
          <div className='bg-muted/20 rounded-md border p-3'>
            <p className='text-muted-foreground text-xs'>Number of Bids</p>
            <p className='text-xl font-semibold'>{summary.bid_count}</p>
          </div>
        </div>
      )}

      {/* Item selector */}
      <div className='space-y-1'>
        <label className='text-sm font-medium' htmlFor='buy-now-item'>
          Buy It Now Item
        </label>
        <Popover open={itemMenuOpen} onOpenChange={setItemMenuOpen}>
          <PopoverTrigger asChild>
            <button
              id='buy-now-item'
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
                        ? 'No buy-it-now items configured'
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
                          Buy It Now: $
                          {Math.round(item.buy_now_price).toLocaleString(
                            'en-US'
                          )}
                        </p>
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
              <p className='text-muted-foreground text-sm'>
                Buy It Now: $
                {Math.round(selectedItem.buy_now_price).toLocaleString('en-US')}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Entry form — only shown when item is selected */}
      {selectedItem ? (
        <form className='grid grid-cols-2 gap-3' onSubmit={handleSubmit}>
          <div className='space-y-1'>
            <label className='text-sm font-medium' htmlFor='buy-now-amount'>
              Amount
            </label>
            <input
              id='buy-now-amount'
              ref={amountRef}
              className='h-12 w-full rounded-md border px-3 py-2 text-lg'
              inputMode='numeric'
              value={amount}
              onChange={(e) =>
                onAmountChange(parseToWholeDollar(e.target.value))
              }
              onKeyDown={handleAmountKeyDown}
              placeholder='500'
              disabled={isSubmitting}
            />
          </div>

          <div className='space-y-1'>
            <label className='text-sm font-medium' htmlFor='buy-now-bidder'>
              Bidder Number
            </label>
            <input
              id='buy-now-bidder'
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
              {isSubmitting ? 'Recording…' : 'Record Buy It Now'}
            </button>
          </div>
        </form>
      ) : null}

      {/* Recent bids log */}
      {selectedItem && recentBids.length > 0 ? (
        <>
          <div className='flex justify-end'>
            <DataTableViewToggle value={viewMode} onChange={setViewMode} />
          </div>
          {viewMode === 'card' ? (
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {recentBids.map((bid) => (
                <div key={bid.id} className='space-y-1 rounded-md border p-3'>
                  <div className='flex items-center justify-between'>
                    <span className='font-medium'>#{bid.bidder_number}</span>
                    <span className='font-semibold'>
                      ${bid.amount.toLocaleString('en-US')}
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
                      {new Date(bid.entered_at).toLocaleTimeString()}
                    </span>
                    <button
                      type='button'
                      className='rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60'
                      onClick={() => onDeleteBid(bid.id)}
                      disabled={isDeleting}
                    >
                      Delete
                    </button>
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
                    <th className='px-3 py-2'>Time</th>
                    <th className='px-3 py-2'>Actions</th>
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
                        ${bid.amount.toLocaleString('en-US')}
                      </td>
                      <td className='px-3 py-2'>
                        {new Date(bid.entered_at).toLocaleTimeString()}
                      </td>
                      <td className='px-3 py-2'>
                        <button
                          type='button'
                          className='rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60'
                          onClick={() => onDeleteBid(bid.id)}
                          disabled={isDeleting}
                        >
                          Delete
                        </button>
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
          No buy-it-now bids recorded for this item yet.
        </p>
      ) : null}
    </div>
  )
}
