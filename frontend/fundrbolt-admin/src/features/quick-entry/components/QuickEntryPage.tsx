import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEventContext } from '@/hooks/use-event-context'
import { cn } from '@/lib/utils'
import { eventApi } from '@/services/event-service'
import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { Check, ChevronsUpDown } from 'lucide-react'
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react'

import { getQuickEntryLiveAuctionItems } from '../api/quickEntryApi'
import { useLiveAuctionControls } from '../hooks/useLiveAuctionControls'
import { useLiveBidEntry } from '../hooks/useLiveBidEntry'
import { usePaddleRaiseEntry } from '../hooks/usePaddleRaiseEntry'
import { LiveBidEntryForm } from './LiveBidEntryForm'
import { LiveBidLogAndMetrics } from './LiveBidLogAndMetrics'
import { PaddleRaiseEntryForm } from './PaddleRaiseEntryForm'

export function QuickEntryPage() {
  const { eventId } = useParams({ from: '/_authenticated/events/$eventId/quick-entry' })
  const { selectedEventId, availableEvents } = useEventContext()
  const [mode, setMode] = useState<'LIVE_AUCTION' | 'PADDLE_RAISE'>('LIVE_AUCTION')
  const [itemMenuOpen, setItemMenuOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')

  const isRouteEventUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      eventId
    )

  const routeEventQuery = useQuery({
    queryKey: ['quick-entry', 'event-by-slug', eventId],
    queryFn: () => eventApi.getEventBySlug(eventId),
    enabled: !isRouteEventUuid,
  })

  const resolvedEventId = isRouteEventUuid
    ? eventId
    : routeEventQuery.data?.id ??
    availableEvents.find((event) => event.slug === eventId)?.id ??
    selectedEventId ??
    ''

  const auctionItemsQuery = useQuery({
    queryKey: ['quick-entry', 'live-items', resolvedEventId],
    queryFn: () => getQuickEntryLiveAuctionItems(resolvedEventId),
    enabled: mode === 'LIVE_AUCTION' && !!resolvedEventId,
  })

  const liveAuctionItems = useMemo(
    () => auctionItemsQuery.data ?? [],
    [auctionItemsQuery.data]
  )
  const selectedItem = useMemo(
    () => liveAuctionItems.find((item) => item.id === selectedItemId),
    [liveAuctionItems, selectedItemId]
  )

  const selectLiveItem = (itemId: string) => {
    setSelectedItemId(itemId)
    setItemMenuOpen(false)
    setItemSearch('')
  }

  const handleItemSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Tab') {
      return
    }

    const search = itemSearch.trim().toLowerCase()
    if (!search) {
      return
    }

    const matching = liveAuctionItems.find((item) =>
      item.bid_number.toString().startsWith(search) || item.title.toLowerCase().includes(search)
    )
    if (!matching) {
      return
    }

    event.preventDefault()
    selectLiveItem(matching.id)
    window.setTimeout(() => {
      const amountInput = document.getElementById('quick-entry-amount') as HTMLInputElement | null
      amountInput?.focus()
      amountInput?.select()
    }, 0)
  }

  const {
    amount,
    bidderNumber,
    setAmount,
    setBidderNumber,
    submitBid,
    isSubmitting,
    submitToken,
  } =
    useLiveBidEntry(resolvedEventId, selectedItemId)

  useEffect(() => {
    if (!selectedItem) {
      return
    }
    if (selectedItem.starting_bid > 0) {
      setAmount(Math.round(selectedItem.starting_bid).toLocaleString('en-US'))
    }
  }, [selectedItem, setAmount])

  const {
    summary,
    isLoadingSummary,
    isDeleting,
    isAssigningWinner,
    deleteBid,
    assignWinner,
  } = useLiveAuctionControls(resolvedEventId, selectedItemId)

  const {
    amount: paddleAmount,
    bidderNumber: paddleBidderNumber,
    selectedLabelIds,
    customLabel,
    labels,
    labelsError,
    isLoadingLabels,
    summary: paddleSummary,
    isSubmitting: isSubmittingPaddle,
    setAmount: setPaddleAmount,
    setBidderNumber: setPaddleBidderNumber,
    setCustomLabel,
    setSelectedLabelIds,
    submitDonation,
    submitToken: paddleSubmitToken,
    recentDonations,
  } = usePaddleRaiseEntry(resolvedEventId)

  return (
    <div className="space-y-2 p-4">
      <h1 className="text-xl font-semibold">Quick Entry</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="quick-entry-mode">
            Entry Mode
          </label>
          <Select
            value={mode}
            onValueChange={(value) => setMode(value as 'LIVE_AUCTION' | 'PADDLE_RAISE')}
          >
            <SelectTrigger id="quick-entry-mode" className="w-full bg-popover text-popover-foreground">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LIVE_AUCTION">Live Auction</SelectItem>
              <SelectItem value="PADDLE_RAISE">Paddle Raise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === 'LIVE_AUCTION' ? (
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="quick-entry-item">
              Live Auction Item
            </label>
            <Popover open={itemMenuOpen} onOpenChange={setItemMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  id="quick-entry-item"
                  type="button"
                  role="combobox"
                  aria-expanded={itemMenuOpen}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus-visible:ring-[3px]"
                >
                  <span className="truncate text-left">
                    {selectedItem
                      ? `#${selectedItem.bid_number} · ${selectedItem.title}`
                      : auctionItemsQuery.isLoading
                        ? 'Loading live auction items...'
                        : auctionItemsQuery.isError
                          ? 'Failed to load live auction items'
                          : 'Select live auction item'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search item number or name..."
                    value={itemSearch}
                    onValueChange={setItemSearch}
                    onKeyDown={handleItemSearchKeyDown}
                  />
                  <CommandList>
                    <CommandEmpty>No live auction items found.</CommandEmpty>
                    <CommandGroup>
                      {liveAuctionItems.map((item) => (
                        <CommandItem
                          key={item.id}
                          value={`${item.bid_number} ${item.title}`}
                          onSelect={() => selectLiveItem(item.id)}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedItemId === item.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <span className="truncate">#{item.bid_number} · {item.title}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
      </div>

      {mode === 'LIVE_AUCTION' && selectedItem ? (
        <section className="rounded-md border p-3">
          <div className="grid gap-3 md:grid-cols-[120px_1fr] md:items-start">
            {selectedItem.primary_image_url ? (
              <img
                src={selectedItem.primary_image_url}
                alt={selectedItem.title}
                className="h-28 w-full rounded-md object-cover md:h-24"
              />
            ) : (
              <div className="bg-muted text-muted-foreground flex h-28 w-full items-center justify-center rounded-md text-xs md:h-24">
                No image
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                #{selectedItem.bid_number} · {selectedItem.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedItem.description || 'No description provided.'}
              </p>
              <p className="text-sm text-muted-foreground">
                Starting Bid: ${Math.round(selectedItem.starting_bid).toLocaleString('en-US')}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {mode === 'LIVE_AUCTION' ? (
        <>
          <LiveBidEntryForm
            amount={amount}
            bidderNumber={bidderNumber}
            onAmountChange={setAmount}
            onBidderNumberChange={setBidderNumber}
            onSubmit={submitBid}
            disabled={isSubmitting}
            focusAmountToken={submitToken}
          />

          <LiveBidLogAndMetrics
            summary={summary}
            isLoading={isLoadingSummary}
            isDeleting={isDeleting}
            isAssigningWinner={isAssigningWinner}
            onDeleteBid={deleteBid}
            onAssignWinner={assignWinner}
          />
        </>
      ) : (
        <PaddleRaiseEntryForm
          amount={paddleAmount}
          bidderNumber={paddleBidderNumber}
          customLabel={customLabel}
          selectedLabelIds={selectedLabelIds}
          labels={labels}
          labelsError={labelsError}
          isLoadingLabels={isLoadingLabels}
          recentDonations={recentDonations}
          summary={paddleSummary}
          submitToken={paddleSubmitToken}
          disabled={isSubmittingPaddle}
          onAmountChange={setPaddleAmount}
          onBidderNumberChange={setPaddleBidderNumber}
          onCustomLabelChange={setCustomLabel}
          onSelectedLabelIdsChange={setSelectedLabelIds}
          onSubmit={submitDonation}
        />
      )}
    </div>
  )
}
