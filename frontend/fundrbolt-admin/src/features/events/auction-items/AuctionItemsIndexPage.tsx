/**
 * AuctionItemsIndexPage
 * Page for listing all auction items for an event
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import revenueGeneratorService, {
  type RGItem,
} from '@/services/revenueGeneratorService'
import { AuctionType, type AuctionItem } from '@/types/auction-item'
import { Plus, Printer, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { BidCardSizeDialog } from '@/components/reports/BidCardSizeDialog'
import { AuctionItemList } from '@/features/events/components/AuctionItemList'
import { RevenueGeneratorItemCard } from '@/features/events/components/RevenueGeneratorItemCard'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'
import { RGItemForm } from '@/features/revenue-generators/RGItemForm'

type TypeFilter = 'all' | 'live' | 'silent' | 'revenue_generators'

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'silent', label: 'Silent' },
  { value: 'revenue_generators', label: 'Revenue Generators' },
]

export function AuctionItemsIndexPage() {
  const navigate = useNavigate()
  const { currentEvent } = useEventWorkspace()
  const { eventId: routeEventId } = useParams({
    from: '/_authenticated/events/$eventId/auction-items/',
  })
  // Use the real UUID for API calls, keep route param for navigation
  const eventId = currentEvent.id
  const eventSlugOrId = routeEventId

  const { items, isLoading, error, fetchAuctionItems, deleteAuctionItem } =
    useAuctionItemStore()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [rgItems, setRgItems] = useState<RGItem[]>([])
  const [rgLoading, setRgLoading] = useState(false)
  const [showCreateRG, setShowCreateRG] = useState(false)
  const [showBidCardDialog, setShowBidCardDialog] = useState(false)

  const loadRGItems = useCallback(() => {
    if (!eventId) return
    setRgLoading(true)
    revenueGeneratorService
      .listItems(eventId)
      .then(setRgItems)
      .catch(() => toast.error('Failed to load revenue generator items'))
      .finally(() => setRgLoading(false))
  }, [eventId])

  useEffect(() => {
    if (eventId) {
      fetchAuctionItems(eventId).catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Failed to load auction items'
        )
      })
      loadRGItems()
    }
  }, [eventId, fetchAuctionItems, loadRGItems])

  const filteredAuctionItems = useMemo(() => {
    let list = items
    if (typeFilter === 'live') {
      list = list.filter((i) => i.auction_type === AuctionType.LIVE)
    } else if (typeFilter === 'silent') {
      list = list.filter((i) => i.auction_type === AuctionType.SILENT)
    }
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.bid_number?.toString().includes(q) ||
        item.description?.toLowerCase().includes(q)
    )
  }, [items, search, typeFilter])

  const filteredRGItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rgItems
    return rgItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
    )
  }, [rgItems, search])

  const showAuction =
    typeFilter === 'all' || typeFilter === 'live' || typeFilter === 'silent'
  const showRG = typeFilter === 'all' || typeFilter === 'revenue_generators'

  const handleAdd = () => {
    navigate({
      to: '/events/$eventId/auction-items/create',
      params: { eventId: eventSlugOrId },
    })
  }

  const handleEdit = (item: AuctionItem) => {
    navigate({
      to: '/events/$eventId/auction-items/$itemId/edit',
      params: { eventId: eventSlugOrId, itemId: item.id },
    })
  }

  const handleView = (item: AuctionItem) => {
    navigate({
      to: '/events/$eventId/auction-items/$itemId',
      params: { eventId: eventSlugOrId, itemId: item.id },
    })
  }

  const handleDelete = async (item: AuctionItem) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${item.title}"? This action cannot be undone.`
      )
    ) {
      return
    }

    try {
      await deleteAuctionItem(eventId, item.id)
      toast.success('Auction item deleted successfully')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete auction item'
      )
    }
  }

  return (
    <div className='space-y-4 md:space-y-6'>
      <div className='mb-4 space-y-4 md:mb-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold md:text-3xl'>Auction Items</h1>
            <p className='text-muted-foreground mt-1 text-sm md:mt-2 md:text-base'>
              Manage auction items for this event
            </p>
          </div>
          {typeFilter !== 'revenue_generators' ? (
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                onClick={() => setShowBidCardDialog(true)}
              >
                <Printer className='mr-2 h-4 w-4' />
                Print Bid Cards
              </Button>
              <Button onClick={handleAdd}>
                <Plus className='mr-2 h-4 w-4' />
                Add Item
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowCreateRG(true)}>
              <Plus className='mr-2 h-4 w-4' />
              Add Revenue Generator
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className='flex flex-col gap-3'>
            {/* Top row: title + search */}
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <CardTitle>Item Gallery</CardTitle>
                <CardDescription>
                  All live auction, silent auction, and revenue generator items
                </CardDescription>
              </div>
              <div className='relative w-full sm:w-64'>
                <Search className='text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2' />
                <Input
                  placeholder='Search items…'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className='pr-8 pl-8'
                />
                {search && (
                  <button
                    type='button'
                    onClick={() => setSearch('')}
                    className='text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2'
                  >
                    <X className='h-4 w-4' />
                  </button>
                )}
              </div>
            </div>
            {/* Filter pills */}
            <div className='flex flex-wrap gap-2'>
              {TYPE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => setTypeFilter(opt.value)}
                  className={[
                    'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                    typeFilter === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border text-foreground',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-8'>
          {/* Auction Items (Live / Silent) */}
          {showAuction && (
            <AuctionItemList
              items={filteredAuctionItems}
              isLoading={isLoading}
              error={error}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onView={handleView}
            />
          )}

          {/* Revenue Generator Items */}
          {showRG && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between border-b pb-2'>
                <h3 className='text-xl font-semibold'>
                  Revenue Generators ({filteredRGItems.length})
                </h3>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setShowCreateRG(true)}
                >
                  <Plus className='mr-1 h-3 w-3' />
                  Add
                </Button>
              </div>
              {rgLoading ? (
                <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className='bg-muted h-48 animate-pulse rounded-lg'
                    />
                  ))}
                </div>
              ) : filteredRGItems.length === 0 ? (
                <div className='py-8 text-center'>
                  <p className='text-muted-foreground mb-4 text-sm'>
                    {rgItems.length === 0
                      ? 'No revenue generator items yet. Add one to get started.'
                      : 'No items match your search.'}
                  </p>
                  {rgItems.length === 0 && (
                    <Button
                      variant='outline'
                      onClick={() => setShowCreateRG(true)}
                    >
                      <Plus className='mr-2 h-4 w-4' />
                      Add First Revenue Generator
                    </Button>
                  )}
                </div>
              ) : (
                <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                  {filteredRGItems.map((item) => (
                    <RevenueGeneratorItemCard
                      key={item.id}
                      item={item}
                      eventId={eventId}
                      onRefresh={loadRGItems}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <RGItemForm
        eventId={eventId}
        open={showCreateRG}
        onClose={() => setShowCreateRG(false)}
        onSaved={() => {
          setShowCreateRG(false)
          loadRGItems()
        }}
      />

      {eventId && (
        <BidCardSizeDialog
          open={showBidCardDialog}
          onClose={() => setShowBidCardDialog(false)}
          eventId={eventId}
        />
      )}
    </div>
  )
}
