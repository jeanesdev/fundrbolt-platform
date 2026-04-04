import { type KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { eventApi } from '@/services/event-service'
import { Check, ChevronsUpDown, Gavel } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEventContext } from '@/hooks/use-event-context'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getLiveAuctionOverview,
  getQuickEntryLiveAuctionItems,
} from '../api/quickEntryApi'
import { useBuyNowEntry } from '../hooks/useBuyNowEntry'
import { useLiveAuctionControls } from '../hooks/useLiveAuctionControls'
import { useLiveBidEntry } from '../hooks/useLiveBidEntry'
import { usePaddleRaiseEntry } from '../hooks/usePaddleRaiseEntry'
import { useSilentBidEntry } from '../hooks/useSilentBidEntry'
import { BuyNowEntryForm } from './BuyNowEntryForm'
import { LiveBidEntryForm } from './LiveBidEntryForm'
import { LiveBidLogAndMetrics } from './LiveBidLogAndMetrics'
import { PaddleRaiseEntryForm } from './PaddleRaiseEntryForm'
import { SilentBidEntryForm } from './SilentBidEntryForm'

export function QuickEntryPage() {
  const { eventId } = useParams({
    from: '/_authenticated/events/$eventId/quick-entry',
  })
  const { selectedEventId, availableEvents } = useEventContext()
  const [mode, setMode] = useState<
    'LIVE_AUCTION' | 'PADDLE_RAISE' | 'BUY_NOW' | 'SILENT_AUCTION'
  >('LIVE_AUCTION')
  const [itemMenuOpen, setItemMenuOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [liveSelection, setLiveSelection] = useState<{
    eventId: string
    itemId: string
  }>({ eventId: '', itemId: '' })

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
    : (routeEventQuery.data?.id ??
      availableEvents.find((event) => event.slug === eventId)?.id ??
      selectedEventId ??
      '')

  const auctionItemsQuery = useQuery({
    queryKey: ['quick-entry', 'live-items', resolvedEventId],
    queryFn: () => getQuickEntryLiveAuctionItems(resolvedEventId),
    enabled: mode === 'LIVE_AUCTION' && !!resolvedEventId,
  })

  const liveAuctionItems = useMemo(
    () => auctionItemsQuery.data ?? [],
    [auctionItemsQuery.data]
  )
  const selectedItemId =
    liveSelection.eventId === resolvedEventId ? liveSelection.itemId : ''
  const selectedItem = useMemo(
    () => liveAuctionItems.find((item) => item.id === selectedItemId),
    [liveAuctionItems, selectedItemId]
  )

  const liveEventTotalRaised = useMemo(
    () =>
      liveAuctionItems.reduce(
        (sum, item) => sum + Number(item.current_bid_amount ?? 0),
        0
      ),
    [liveAuctionItems]
  )
  const liveEventBidCount = useMemo(
    () =>
      liveAuctionItems.reduce((sum, item) => sum + (item.bid_count ?? 0), 0),
    [liveAuctionItems]
  )

  const overviewQuery = useQuery({
    queryKey: ['quick-entry', 'live-auction-overview', resolvedEventId],
    queryFn: () => getLiveAuctionOverview(resolvedEventId!),
    enabled: !!resolvedEventId,
    refetchInterval: 10_000,
  })

  const selectLiveItem = (itemId: string) => {
    setLiveSelection({ eventId: resolvedEventId, itemId })
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

    const matching = liveAuctionItems.find(
      (item) =>
        item.bid_number.toString().startsWith(search) ||
        item.title.toLowerCase().includes(search)
    )
    if (!matching) {
      return
    }

    event.preventDefault()
    selectLiveItem(matching.id)
    window.setTimeout(() => {
      const amountInput = document.getElementById(
        'quick-entry-amount'
      ) as HTMLInputElement | null
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
  } = useLiveBidEntry(resolvedEventId, selectedItemId)

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
    isSummaryError,
    isDeleting,
    isAssigningWinner,
    isRemovingWinner,
    deleteBid,
    assignWinner,
    removeWinner,
  } = useLiveAuctionControls(resolvedEventId, selectedItemId)

  const {
    amount: paddleAmount,
    bidderNumber: paddleBidderNumber,
    selectedLabelIds,
    customLabel,
    isMonthly,
    labels,
    labelsError,
    isLoadingLabels,
    summary: paddleSummary,
    isSubmitting: isSubmittingPaddle,
    setAmount: setPaddleAmount,
    setBidderNumber: setPaddleBidderNumber,
    setCustomLabel,
    setSelectedLabelIds,
    setIsMonthly,
    submitDonation,
    submitToken: paddleSubmitToken,
    recentDonations,
  } = usePaddleRaiseEntry(resolvedEventId)

  const buyNow = useBuyNowEntry(resolvedEventId)
  const silent = useSilentBidEntry(resolvedEventId)

  return (
    <div className='space-y-2 p-4'>
      <h1 className='text-xl font-semibold'>Quick Entry</h1>
      <div className='space-y-3'>
        <Tabs
          value={mode}
          onValueChange={(value) =>
            setMode(
              value as
                | 'LIVE_AUCTION'
                | 'PADDLE_RAISE'
                | 'BUY_NOW'
                | 'SILENT_AUCTION'
            )
          }
        >
          <TabsList className='h-11'>
            <TabsTrigger value='LIVE_AUCTION' className='min-h-9 px-4'>
              Live Auction
            </TabsTrigger>
            <TabsTrigger value='PADDLE_RAISE' className='min-h-9 px-4'>
              Paddle Raise
            </TabsTrigger>
            <TabsTrigger value='BUY_NOW' className='min-h-9 px-4'>
              Buy It Now
            </TabsTrigger>
            <TabsTrigger value='SILENT_AUCTION' className='min-h-9 px-4'>
              Silent Auction
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'LIVE_AUCTION' ? (
          <div className='space-y-3'>
            {liveAuctionItems.length > 0 && (
              <div className='grid grid-cols-2 gap-3 lg:grid-cols-3'>
                <div className='bg-muted/20 rounded-md border p-3'>
                  <p className='text-muted-foreground text-xs'>Total Raised</p>
                  <p className='text-xl font-semibold'>
                    ${liveEventTotalRaised.toLocaleString('en-US')}
                  </p>
                </div>
                <div className='bg-muted/20 rounded-md border p-3'>
                  <p className='text-muted-foreground text-xs'>
                    Number of Bids
                  </p>
                  <p className='text-xl font-semibold'>{liveEventBidCount}</p>
                </div>
                <div className='bg-muted/20 col-span-2 rounded-md border p-3 lg:col-span-1'>
                  <p className='text-muted-foreground text-xs'>Items Done</p>
                  <p className='text-xl font-semibold'>
                    {overviewQuery.data?.items_with_winner ?? 0} /{' '}
                    {overviewQuery.data?.total_items ?? liveAuctionItems.length}
                  </p>
                </div>
              </div>
            )}
            <div className='space-y-1'>
              <label className='text-sm font-medium' htmlFor='quick-entry-item'>
                Live Auction Item
              </label>
              <Popover open={itemMenuOpen} onOpenChange={setItemMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    id='quick-entry-item'
                    type='button'
                    role='combobox'
                    aria-expanded={itemMenuOpen}
                    className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus-visible:ring-[3px]'
                  >
                    <span className='truncate text-left'>
                      {selectedItem
                        ? `#${selectedItem.bid_number} · ${selectedItem.title}${selectedItem.status === 'sold' ? ' ✓ Sold' : ''}`
                        : auctionItemsQuery.isLoading
                          ? 'Loading live auction items...'
                          : auctionItemsQuery.isError
                            ? 'Failed to load live auction items'
                            : 'Select live auction item'}
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
                      placeholder='Search item number or name...'
                      value={itemSearch}
                      onValueChange={setItemSearch}
                      onKeyDown={handleItemSearchKeyDown}
                    />
                    <CommandList className='max-h-72'>
                      <CommandEmpty>No live auction items found.</CommandEmpty>
                      <CommandGroup>
                        {liveAuctionItems.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={`${item.bid_number} ${item.title}`}
                            onSelect={() => selectLiveItem(item.id)}
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
                              <p className='flex items-center gap-1 truncate text-sm font-medium'>
                                #{item.bid_number} · {item.title}
                                {item.status === 'sold' && (
                                  <span className='inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900 dark:text-green-300'>
                                    <Gavel className='h-2.5 w-2.5' />
                                    Sold
                                  </span>
                                )}
                              </p>
                              <p className='text-muted-foreground text-xs'>
                                Starting: $
                                {Math.round(item.starting_bid).toLocaleString(
                                  'en-US'
                                )}
                              </p>
                              {item.current_bid_amount != null && (
                                <p className='text-xs font-medium text-green-600 dark:text-green-400'>
                                  Current: $
                                  {Math.round(
                                    item.current_bid_amount
                                  ).toLocaleString('en-US')}
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
          </div>
        ) : null}
      </div>

      {mode === 'LIVE_AUCTION' && selectedItem ? (
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
            <div className='space-y-1'>
              <p className='text-sm font-medium'>
                #{selectedItem.bid_number} · {selectedItem.title}
              </p>
              <p className='text-muted-foreground text-sm'>
                {selectedItem.description || 'No description provided.'}
              </p>
              <p className='text-muted-foreground text-sm'>
                Starting Bid: $
                {Math.round(selectedItem.starting_bid).toLocaleString('en-US')}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {mode === 'LIVE_AUCTION' ? (
        <>
          {summary?.bids.some((b) => b.status === 'winning') ? (
            <p className='text-muted-foreground text-sm'>
              Auction closed — reopen auction to continue bidding.
            </p>
          ) : null}
          <LiveBidEntryForm
            amount={amount}
            bidderNumber={bidderNumber}
            onAmountChange={setAmount}
            onBidderNumberChange={setBidderNumber}
            onSubmit={submitBid}
            disabled={
              isSubmitting || summary?.bids.some((b) => b.status === 'winning')
            }
            isSubmitting={isSubmitting}
            focusAmountToken={submitToken}
          />

          <LiveBidLogAndMetrics
            summary={summary}
            isLoading={isLoadingSummary}
            isError={isSummaryError}
            hasSelectedItem={!!selectedItemId}
            isDeleting={isDeleting}
            isAssigningWinner={isAssigningWinner}
            isRemovingWinner={isRemovingWinner}
            onDeleteBid={deleteBid}
            onAssignWinner={assignWinner}
            onRemoveWinner={removeWinner}
          />
        </>
      ) : mode === 'PADDLE_RAISE' ? (
        <PaddleRaiseEntryForm
          amount={paddleAmount}
          bidderNumber={paddleBidderNumber}
          customLabel={customLabel}
          selectedLabelIds={selectedLabelIds}
          isMonthly={isMonthly}
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
          onIsMonthlyChange={setIsMonthly}
          onSubmit={submitDonation}
        />
      ) : mode === 'BUY_NOW' ? (
        <BuyNowEntryForm
          items={buyNow.items}
          isLoadingItems={buyNow.isLoadingItems}
          isItemsError={buyNow.isItemsError}
          selectedItemId={buyNow.selectedItemId}
          selectedItem={buyNow.selectedItem}
          onSelectItem={buyNow.setSelectedItemId}
          amount={buyNow.amount}
          bidderNumber={buyNow.bidderNumber}
          bidderRef={buyNow.bidderRef}
          recentBids={buyNow.recentBids}
          isSubmitting={buyNow.isSubmitting}
          isDeleting={buyNow.isDeleting}
          onAmountChange={buyNow.setAmount}
          onBidderNumberChange={buyNow.setBidderNumber}
          onBidderKeyDown={buyNow.handleBidderKeyDown}
          onSubmit={buyNow.submitBid}
          onDeleteBid={buyNow.deleteBid}
          summary={buyNow.summary}
        />
      ) : (
        <SilentBidEntryForm
          items={silent.items}
          isLoadingItems={silent.isLoadingItems}
          isItemsError={silent.isItemsError}
          selectedItemId={silent.selectedItemId}
          selectedItem={silent.selectedItem}
          onSelectItem={silent.setSelectedItemId}
          amount={silent.amount}
          bidderNumber={silent.bidderNumber}
          bidderRef={silent.bidderRef}
          recentBids={silent.recentBids}
          isSubmitting={silent.isSubmitting}
          onAmountChange={silent.setAmount}
          onBidderNumberChange={silent.setBidderNumber}
          onBidderKeyDown={silent.handleBidderKeyDown}
          onSubmit={silent.submitBid}
        />
      )}
    </div>
  )
}
