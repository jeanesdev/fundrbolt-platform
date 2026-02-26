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
import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'

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
  const [selectedItemId, setSelectedItemId] = useState('')

  const resolvedEventId = useMemo(() => {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (uuidPattern.test(eventId)) {
      return eventId
    }

    const matchedBySlug = availableEvents.find((event) => event.slug === eventId)
    return matchedBySlug?.id ?? selectedEventId ?? eventId
  }, [eventId, availableEvents, selectedEventId])

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
    summary: paddleSummary,
    isSubmitting: isSubmittingPaddle,
    setAmount: setPaddleAmount,
    setBidderNumber: setPaddleBidderNumber,
    setCustomLabel,
    setSelectedLabelIds,
    submitDonation,
    submitToken: paddleSubmitToken,
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
                  <CommandInput placeholder="Search item number or name..." />
                  <CommandList>
                    <CommandEmpty>No live auction items found.</CommandEmpty>
                    <CommandGroup>
                      {liveAuctionItems.map((item) => (
                        <CommandItem
                          key={item.id}
                          value={`${item.bid_number} ${item.title}`}
                          onSelect={() => {
                            setSelectedItemId(item.id)
                            setItemMenuOpen(false)
                          }}
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
