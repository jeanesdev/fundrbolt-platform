import { cn } from '@/lib/utils'

export interface GalleryItem {
  id: string
  bid_number: number
  title: string
  primary_image_url?: string | null
  /** Primary price line, e.g. "Starting Bid: $500" or "Buy It Now: $200" */
  priceLabel: string
  /** Optional secondary line, e.g. current highest bid */
  subLabel?: string | null
}

interface ItemGalleryProps {
  items: GalleryItem[]
  selectedItemId: string
  onSelectItem: (id: string) => void
  maxHeightClass?: string
}

export function ItemGallery({
  items,
  selectedItemId,
  onSelectItem,
  maxHeightClass = 'max-h-72',
}: ItemGalleryProps) {
  if (items.length === 0) return null

  return (
    <div className={cn('overflow-y-auto rounded-md border', maxHeightClass)}>
      {items.map((item) => {
        const isSelected = item.id === selectedItemId
        return (
          <button
            key={item.id}
            type='button'
            onClick={() => onSelectItem(item.id)}
            className={cn(
              'flex w-full items-center gap-3 border-b px-3 py-2 text-left transition-colors last:border-b-0',
              isSelected
                ? 'bg-primary/10 ring-primary/40 ring-1'
                : 'hover:bg-muted/40'
            )}
          >
            {/* Thumbnail */}
            <div className='h-14 w-14 shrink-0 overflow-hidden rounded'>
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

            {/* Text */}
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium'>
                #{item.bid_number} · {item.title}
              </p>
              <p className='text-muted-foreground text-xs'>{item.priceLabel}</p>
              {item.subLabel ? (
                <p className='text-xs font-medium text-green-600 dark:text-green-400'>
                  {item.subLabel}
                </p>
              ) : null}
            </div>

            {isSelected && (
              <span className='text-primary shrink-0 text-xs font-semibold'>
                Selected
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
