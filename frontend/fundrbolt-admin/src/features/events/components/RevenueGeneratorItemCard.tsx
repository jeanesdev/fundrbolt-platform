/**
 * RevenueGeneratorItemCard
 * Display card for a single Revenue Generator item, styled like AuctionItemCard
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { RGItemForm } from '@/features/revenue-generators/RGItemForm'
import revenueGeneratorService, {
  type RGItem,
} from '@/services/revenueGeneratorService'
import {
  DollarSign,
  MoreVertical,
  Pencil,
  Ticket,
  Trash2,
  Trophy,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface RevenueGeneratorItemCardProps {
  item: RGItem
  eventId: string
  onRefresh: () => void
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    amount
  )

export function RevenueGeneratorItemCard({
  item,
  eventId,
  onRefresh,
}: RevenueGeneratorItemCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleToggleVisible = async () => {
    try {
      await revenueGeneratorService.updateItem(eventId, item.id, {
        is_visible: !item.is_visible,
      })
      onRefresh()
    } catch {
      toast.error('Failed to update visibility')
    }
  }

  const handleToggleOpen = async () => {
    try {
      await revenueGeneratorService.updateItem(eventId, item.id, {
        is_open_for_entries: !item.is_open_for_entries,
      })
      onRefresh()
    } catch {
      toast.error('Failed to update open status')
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await revenueGeneratorService.deleteItem(eventId, item.id)
      onRefresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card className='flex flex-col'>
        {item.image_url && (
          <div className='overflow-hidden rounded-t-lg'>
            <img
              src={item.image_url}
              alt={item.name}
              className='h-40 w-full object-cover'
            />
          </div>
        )}
        <CardHeader>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex-1'>
              <CardTitle className='line-clamp-1 text-lg'>
                {item.name}
              </CardTitle>
              <CardDescription className='mt-1 flex items-center gap-1'>
                <Ticket className='h-3 w-3' />
                {formatCurrency(Number(item.price_per_entry))} / entry
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='h-8 w-8'>
                  <MoreVertical className='h-4 w-4' />
                  <span className='sr-only'>Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className='mr-2 h-4 w-4' />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={deleting}
                  className='text-destructive focus:text-destructive'
                >
                  <Trash2 className='mr-2 h-4 w-4' />
                  {deleting ? 'Deleting…' : 'Delete'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className='flex-1'>
          <p className='text-muted-foreground line-clamp-3 text-sm'>
            {item.description || 'No description provided'}
          </p>

          {item.current_winner_name && (
            <div className='mt-3 flex items-center gap-1 text-sm font-medium'>
              <Trophy className='h-4 w-4 text-yellow-500' />
              <span>{item.current_winner_name}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className='flex flex-col items-start gap-3'>
          {/* Stats */}
          <div className='grid w-full grid-cols-2 gap-2 text-sm'>
            <div>
              <span className='text-muted-foreground'>Entries:</span>{' '}
              <span className='font-semibold'>{item.total_entries}</span>
            </div>
            <div>
              <span className='text-muted-foreground'>Raised:</span>{' '}
              <span className='font-semibold'>
                {formatCurrency(Number(item.total_revenue))}
              </span>
            </div>
            <div>
              <span className='text-muted-foreground'>Qty:</span>{' '}
              <span className='font-semibold'>
                {item.max_entries != null ? item.max_entries : 'Unlimited'}
              </span>
            </div>
            <div>
              <span className='text-muted-foreground'>Per Person:</span>{' '}
              <span className='font-semibold'>
                {item.max_entries_per_person != null
                  ? item.max_entries_per_person
                  : 'Unlimited'}
              </span>
            </div>
          </div>

          {/* Status badges + toggles */}
          <div className='flex w-full flex-wrap items-center justify-between gap-2'>
            <div className='flex flex-wrap gap-2'>
              <Badge variant='outline' className='flex items-center gap-1'>
                <DollarSign className='h-3 w-3' />
                Revenue Generator
              </Badge>
              {item.current_winner_name && (
                <Badge variant='default'>🏆 Winner drawn</Badge>
              )}
            </div>
            <div className='flex items-center gap-3 text-xs'>
              <div className='flex cursor-pointer items-center gap-1'>
                <span className='text-muted-foreground'>Visible</span>
                <Switch
                  checked={item.is_visible}
                  onCheckedChange={handleToggleVisible}
                  className='scale-75'
                />
              </div>
              <div className='flex cursor-pointer items-center gap-1'>
                <span className='text-muted-foreground'>Open</span>
                <Switch
                  checked={item.is_open_for_entries}
                  onCheckedChange={handleToggleOpen}
                  className='scale-75'
                />
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>

      <RGItemForm
        eventId={eventId}
        item={item}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false)
          onRefresh()
        }}
      />
    </>
  )
}
