/**
 * DonorCheckoutItemEditor — T045
 *
 * Side panel (Sheet) that lets admins view and manage a single donor's
 * checkout items: reprice, remove, and add manual items. Shows receipt
 * actions if checkout is complete.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  type AddCheckoutItemRequest,
  addCheckoutItem,
  getDonorCheckoutSession,
  removeCheckoutItem,
  repriceCheckoutItem,
} from '@/lib/api/checkout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { CheckoutReceiptActions } from './CheckoutReceiptActions'
import { CheckoutReceiptInlineView } from './CheckoutReceiptInlineView'

interface DonorCheckoutItemEditorProps {
  eventId: string
  userId: string
  donorInfo?: {
    first_name?: string | null
    last_name?: string | null
    email?: string | null
  }
  onClose: () => void
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function parseDollars(value: string): number | null {
  const parsed = parseFloat(value)
  if (isNaN(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function ItemRow({
  eventId,
  userId,
  item,
  onChanged,
}: {
  eventId: string
  userId: string
  item: {
    id: string
    name: string
    description: string | null
    original_amount_cents: number
    adjusted_amount_cents: number | null
    source_type: string
    is_removed: boolean
  }
  onChanged: () => void
}) {
  const [repriceValue, setRepriceValue] = useState(
    String(
      (
        (item.adjusted_amount_cents ?? item.original_amount_cents) / 100
      ).toFixed(2)
    )
  )
  const [repriceMode, setRepriceMode] = useState(false)

  const repriceMutation = useMutation({
    mutationFn: (amountCents: number) =>
      repriceCheckoutItem(eventId, userId, item.id, amountCents),
    onSuccess: () => {
      toast.success('Price updated')
      setRepriceMode(false)
      onChanged()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to reprice item')
    },
  })

  const removeMutation = useMutation({
    mutationFn: () => removeCheckoutItem(eventId, userId, item.id),
    onSuccess: () => {
      toast.success('Item removed')
      onChanged()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to remove item')
    },
  })

  const effectiveAmount =
    item.adjusted_amount_cents ?? item.original_amount_cents

  return (
    <div
      className={`rounded-md border p-3 ${item.is_removed ? 'opacity-50' : ''}`}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-sm font-medium'>{item.name}</p>
          {item.description && (
            <p className='text-muted-foreground truncate text-xs'>
              {item.description}
            </p>
          )}
          <div className='mt-1 flex items-center gap-2'>
            <span className='text-sm'>{formatCents(effectiveAmount)}</span>
            {item.adjusted_amount_cents !== null &&
              item.adjusted_amount_cents !== item.original_amount_cents && (
                <span className='text-muted-foreground text-xs line-through'>
                  {formatCents(item.original_amount_cents)}
                </span>
              )}
            <Badge variant='outline' className='text-xs capitalize'>
              {item.source_type.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>

        {!item.is_removed && (
          <div className='flex shrink-0 items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7'
              onClick={() => setRepriceMode((v) => !v)}
              title='Adjust price'
            >
              <Minus className='h-3.5 w-3.5' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='text-destructive hover:text-destructive h-7 w-7'
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
              title='Remove item'
            >
              {removeMutation.isPending ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Trash2 className='h-3.5 w-3.5' />
              )}
            </Button>
          </div>
        )}
      </div>

      {repriceMode && !item.is_removed && (
        <div className='mt-2 flex items-center gap-2'>
          <div className='relative flex-1'>
            <span className='text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2 text-sm'>
              $
            </span>
            <Input
              type='number'
              min='0'
              step='0.01'
              value={repriceValue}
              onChange={(e) => setRepriceValue(e.target.value)}
              className='h-8 pl-6 text-sm'
            />
          </div>
          <Button
            size='sm'
            className='h-8'
            disabled={repriceMutation.isPending}
            onClick={() => {
              const cents = parseDollars(repriceValue)
              if (cents === null) {
                toast.error('Invalid amount')
                return
              }
              repriceMutation.mutate(cents)
            }}
          >
            {repriceMutation.isPending ? (
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
            ) : (
              'Save'
            )}
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='h-8'
            onClick={() => setRepriceMode(false)}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

function AddItemForm({
  eventId,
  userId,
  onAdded,
}: {
  eventId: string
  userId: string
  onAdded: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [expanded, setExpanded] = useState(false)

  const addMutation = useMutation({
    mutationFn: (payload: AddCheckoutItemRequest) =>
      addCheckoutItem(eventId, userId, payload),
    onSuccess: () => {
      toast.success('Item added')
      setName('')
      setDescription('')
      setAmount('')
      setExpanded(false)
      onAdded()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to add item')
    },
  })

  if (!expanded) {
    return (
      <Button
        variant='outline'
        size='sm'
        className='w-full'
        onClick={() => setExpanded(true)}
      >
        <Plus className='mr-1.5 h-3.5 w-3.5' />
        Add Item
      </Button>
    )
  }

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <p className='text-sm font-medium'>Add Manual Item</p>
      <div className='space-y-2'>
        <Label className='text-xs'>Name *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Item name'
          className='h-8 text-sm'
        />
      </div>
      <div className='space-y-2'>
        <Label className='text-xs'>Description (optional)</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='Optional description'
          className='min-h-[60px] text-sm'
        />
      </div>
      <div className='space-y-2'>
        <Label className='text-xs'>Amount ($) *</Label>
        <div className='relative'>
          <span className='text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2 text-sm'>
            $
          </span>
          <Input
            type='number'
            min='0'
            step='0.01'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder='0.00'
            className='h-8 pl-6 text-sm'
          />
        </div>
      </div>
      <div className='flex gap-2'>
        <Button
          size='sm'
          className='h-8'
          disabled={addMutation.isPending || !name.trim() || !amount}
          onClick={() => {
            const cents = parseDollars(amount)
            if (cents === null) {
              toast.error('Invalid amount')
              return
            }
            addMutation.mutate({
              name: name.trim(),
              description: description.trim() || null,
              amount_cents: cents,
              source_type: 'manual',
            })
          }}
        >
          {addMutation.isPending ? (
            <Loader2 className='h-3.5 w-3.5 animate-spin' />
          ) : (
            'Add'
          )}
        </Button>
        <Button
          variant='ghost'
          size='sm'
          className='h-8'
          onClick={() => setExpanded(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function DonorCheckoutItemEditor({
  eventId,
  userId,
  donorInfo,
  onClose,
}: DonorCheckoutItemEditorProps) {
  const queryClient = useQueryClient()

  const { data: session, isLoading } = useQuery({
    queryKey: ['checkout-donor-session', eventId, userId],
    queryFn: () => getDonorCheckoutSession(eventId, userId),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['checkout-donor-session', eventId, userId],
    })
    void queryClient.invalidateQueries({
      queryKey: ['checkout-donors', eventId],
    })
  }

  const activeItems = session?.items.filter((i) => !i.is_removed) ?? []
  const removedItems = session?.items.filter((i) => i.is_removed) ?? []

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side='right' className='w-full overflow-y-auto sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>
            {donorInfo?.first_name || donorInfo?.last_name
              ? `${donorInfo.first_name ?? ''} ${donorInfo.last_name ?? ''}`.trim()
              : 'Donor Checkout'}
          </SheetTitle>
          <SheetDescription>
            {donorInfo?.email ?? 'Manage checkout items for this donor'}
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
          </div>
        )}

        {session && (
          <div className='flex flex-col gap-4 px-4 pb-4'>
            {/* Status + totals */}
            <div className='flex items-center justify-between'>
              <StatusBadge status={session.status} />
              <div className='text-right text-sm'>
                <p className='text-muted-foreground text-xs'>
                  Subtotal: {formatCents(session.subtotal_cents)}
                </p>
                {session.processing_fee_cents > 0 && (
                  <p className='text-muted-foreground text-xs'>
                    Fee: {formatCents(session.processing_fee_cents)}
                  </p>
                )}
                <p className='font-medium'>
                  Total: {formatCents(session.total_cents)}
                </p>
              </div>
            </div>

            {/* Receipt actions */}
            {session.status === 'complete' && (
              <CheckoutReceiptActions
                eventId={eventId}
                userId={userId}
                hasReceipt={true}
              />
            )}

            {/* Inline receipt — shown when checkout is complete */}
            {session.status === 'complete' && (
              <CheckoutReceiptInlineView session={session} />
            )}

            {/* Active items */}
            <div className='space-y-2'>
              <p className='text-sm font-medium'>
                Items ({activeItems.length})
              </p>
              {activeItems.length === 0 && (
                <p className='text-muted-foreground py-4 text-center text-sm'>
                  No items yet
                </p>
              )}
              {activeItems.map((item) => (
                <ItemRow
                  key={item.id}
                  eventId={eventId}
                  userId={userId}
                  item={item}
                  onChanged={invalidate}
                />
              ))}
            </div>

            {/* Add item */}
            <AddItemForm
              eventId={eventId}
              userId={userId}
              onAdded={invalidate}
            />

            {/* Removed items */}
            {removedItems.length > 0 && (
              <div className='space-y-2'>
                <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                  Removed Items
                </p>
                {removedItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    eventId={eventId}
                    userId={userId}
                    item={item}
                    onChanged={invalidate}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'complete') {
    return (
      <Badge className='bg-green-100 text-green-700 hover:bg-green-100'>
        Complete
      </Badge>
    )
  }
  if (status === 'in_progress') {
    return (
      <Badge className='bg-yellow-100 text-yellow-700 hover:bg-yellow-100'>
        In Progress
      </Badge>
    )
  }
  return <Badge variant='secondary'>Not Started</Badge>
}
