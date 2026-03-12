/**
 * TicketPackageCard — displays a ticket package with quantity controls.
 */
import { Award, Minus, Plus, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TicketPackageCardProps {
  id: string
  name: string
  description: string | null
  price: number
  seatsPerPackage: number
  quantityRemaining: number | null
  isSoldOut: boolean
  isSponsorship: boolean
  currentQuantity: number
  onQuantityChange: (quantity: number) => void
  maxQuantity?: number
  disabled?: boolean
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function TicketPackageCard({
  name,
  description,
  price,
  seatsPerPackage,
  quantityRemaining,
  isSoldOut,
  isSponsorship,
  currentQuantity,
  onQuantityChange,
  maxQuantity,
  disabled,
}: TicketPackageCardProps) {
  const effectiveMax =
    maxQuantity ?? (quantityRemaining !== null ? quantityRemaining : Infinity)

  const canIncrement = !isSoldOut && !disabled && currentQuantity < effectiveMax
  const canDecrement = currentQuantity > 0

  return (
    <Card className={`relative ${isSoldOut ? 'opacity-60' : ''}`}>
      {isSoldOut && (
        <div className='bg-background/60 absolute inset-0 z-10 flex items-center justify-center rounded-lg'>
          <Badge variant='destructive' className='px-3 py-1 text-sm'>
            Sold Out
          </Badge>
        </div>
      )}

      <CardHeader className='pb-2'>
        <div className='flex items-start justify-between gap-2'>
          <CardTitle className='text-lg'>{name}</CardTitle>
          <span className='shrink-0 text-lg font-bold'>
            {fmtCurrency(price)}
          </span>
        </div>
        {description && (
          <p className='text-muted-foreground text-sm'>{description}</p>
        )}
      </CardHeader>

      <CardContent className='space-y-3'>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='secondary'>
            <Users className='mr-1 h-3 w-3' />
            {seatsPerPackage} {seatsPerPackage === 1 ? 'seat' : 'seats'}
          </Badge>
          {isSponsorship && (
            <Badge className='bg-amber-500 text-white hover:bg-amber-600'>
              <Award className='mr-1 h-3 w-3' />
              Includes Sponsorship
            </Badge>
          )}
          {quantityRemaining !== null && !isSoldOut && (
            <Badge variant='outline'>{quantityRemaining} remaining</Badge>
          )}
        </div>

        <div className='flex items-center gap-3'>
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              disabled={!canDecrement}
              onClick={() => onQuantityChange(currentQuantity - 1)}
              aria-label='Decrease quantity'
            >
              <Minus className='h-4 w-4' />
            </Button>
            <span className='w-10 text-center text-sm font-medium tabular-nums'>
              {currentQuantity}
            </span>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              disabled={!canIncrement}
              onClick={() => onQuantityChange(currentQuantity + 1)}
              aria-label='Increase quantity'
            >
              <Plus className='h-4 w-4' />
            </Button>
          </div>

          <Button
            size='sm'
            disabled={isSoldOut || disabled || currentQuantity <= 0}
            className='ml-auto'
            onClick={() => {
              /* quantity already tracked — this is a visual confirm */
            }}
          >
            {currentQuantity > 0 ? 'In Cart' : 'Add to Cart'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
