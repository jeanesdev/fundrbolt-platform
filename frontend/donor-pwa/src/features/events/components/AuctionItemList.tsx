/**
 * AuctionItemList
 * Displays auction items in a grid with filtering and pagination
 */
import { AuctionType, type AuctionItem } from '@/types/auction-item'
import { AlertCircle, Gavel, Plus } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AuctionItemCard } from './AuctionItemCard'

interface AuctionItemListProps {
  items: AuctionItem[]
  isLoading?: boolean
  error?: string | null
  onAdd?: () => void
  onEdit?: (item: AuctionItem) => void
  onDelete?: (item: AuctionItem) => void
  onView?: (item: AuctionItem) => void
  readOnly?: boolean
}

export function AuctionItemList({
  items,
  isLoading = false,
  error = null,
  onAdd,
  onEdit,
  onDelete,
  onView,
  readOnly = false,
}: AuctionItemListProps) {
  // Group items by auction type
  const groupedItems = items.reduce(
    (acc, item) => {
      const type = item.auction_type
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push(item)
      return acc
    },
    {} as Record<AuctionType, AuctionItem[]>
  )

  // Get unique auction types, sorted (LIVE first, then SILENT)
  const auctionTypes = Object.keys(groupedItems).sort((a, b) => {
    if (a === 'LIVE') return -1
    if (b === 'LIVE') return 1
    return 0
  }) as AuctionType[]

  if (isLoading) {
    return (
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Skeleton className='h-64 w-full' />
        <Skeleton className='h-64 w-full' />
        <Skeleton className='h-64 w-full' />
        <Skeleton className='h-64 w-full' />
        <Skeleton className='h-64 w-full' />
        <Skeleton className='h-64 w-full' />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant='destructive'>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (items.length === 0) {
    return (
      <div className='py-12 text-center'>
        <Gavel className='text-muted-foreground mx-auto mb-4 h-16 w-16' />
        <h3 className='mb-2 text-lg font-semibold'>No auction items yet</h3>
        <p className='text-muted-foreground mb-6'>
          Add auction items to start fundraising
        </p>
        {!readOnly && onAdd && (
          <Button onClick={onAdd}>
            <Plus className='mr-2 h-4 w-4' />
            Add First Item
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className='space-y-8'>
      {/* Add Button */}
      {!readOnly && onAdd && (
        <div className='flex justify-end'>
          <Button onClick={onAdd}>
            <Plus className='mr-2 h-4 w-4' />
            Add Auction Item
          </Button>
        </div>
      )}

      {/* Grouped Items */}
      {auctionTypes.map((type) => {
        const typeItems = groupedItems[type]
        if (!typeItems || typeItems.length === 0) return null

        const displayName =
          type === AuctionType.LIVE ? 'Live Auction' : 'Silent Auction'

        return (
          <div key={type} className='space-y-4'>
            <h3 className='border-b pb-2 text-xl font-semibold'>
              {displayName} ({typeItems.length})
            </h3>
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {typeItems.map((item) => (
                <AuctionItemCard
                  key={item.id}
                  item={item}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onView={onView}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
