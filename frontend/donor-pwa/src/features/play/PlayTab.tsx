import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getEventRevenueGenerators,
  purchaseEntry,
} from '@/services/revenueGeneratorService'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { RevenueGeneratorCard } from './RevenueGeneratorCard'

interface Props {
  eventId: string
  brandPrimary?: string
}

export function PlayTab({ eventId, brandPrimary }: Props) {
  const primary = brandPrimary ?? '59, 130, 246'
  const queryClient = useQueryClient()
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const purchaseInFlightRef = useRef<Set<string>>(new Set())
  const [instructionPopup, setInstructionPopup] = useState<{
    title: string
    message: string
  } | null>(null)

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['donor', 'revenue-generators', eventId],
    queryFn: () => getEventRevenueGenerators(eventId),
    enabled: !!eventId,
    refetchInterval: 5_000,
  })

  const handlePurchase = async (itemId: string, quantity = 1) => {
    if (purchasingId) return
    if (purchaseInFlightRef.current.has(itemId)) return
    purchaseInFlightRef.current.add(itemId)
    setPurchasingId(itemId)

    try {
      const purchaseResult = await purchaseEntry(eventId, itemId, quantity)
      const purchasedItem = items.find((item) => item.id === itemId)
      await queryClient.invalidateQueries({
        queryKey: ['donor', 'revenue-generators', eventId],
      })
      const purchasedCount = purchaseResult.purchased_count ?? quantity
      toast.success(
        purchasedCount === 1
          ? 'Entry purchased!'
          : `${purchasedCount} entries purchased!`
      )

      const message = purchaseResult.post_purchase_instructions?.trim()
      if (message) {
        setInstructionPopup({
          title: purchasedItem?.name ?? 'Purchase Instructions',
          message,
        })
      }
    } catch (error) {
      const responseData = axios.isAxiosError(error)
        ? error.response?.data
        : null
      const detail =
        responseData &&
          typeof responseData === 'object' &&
          'detail' in responseData &&
          typeof responseData.detail === 'string'
          ? responseData.detail
          : null

      toast.error(detail ?? 'Failed to purchase entry. Please try again.')
    } finally {
      purchaseInFlightRef.current.delete(itemId)
      setPurchasingId((current) => (current === itemId ? null : current))
    }
  }

  const openItems = items.filter((i) => i.is_open_for_entries)
  const closedItems = items.filter((i) => !i.is_open_for_entries)

  return (
    <div className='mx-auto w-full max-w-lg space-y-4 px-4 py-4 lg:max-w-xl'>
      {isLoading && (
        <div className='flex items-center justify-center py-16'>
          <Loader2
            className='h-8 w-8 animate-spin'
            style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
          />
        </div>
      )}

      {isError && (
        <div
          className='flex items-center gap-3 rounded-2xl border p-4'
          style={{
            borderColor: 'rgba(var(--event-primary, 59, 130, 246), 0.2)',
            backgroundColor: 'rgba(var(--event-primary, 59, 130, 246), 0.06)',
          }}
        >
          <p
            className='text-sm'
            style={{ color: 'var(--event-text-on-background, #374151)' }}
          >
            Unable to load raffle items. Please try again later.
          </p>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className='flex flex-col items-center justify-center py-16 text-center'>
          <p
            className='text-base font-medium'
            style={{ color: 'var(--event-text-on-background, #111827)' }}
          >
            No raffle items yet
          </p>
          <p
            className='mt-1 text-sm'
            style={{ color: 'var(--event-text-on-background, #6B7280)' }}
          >
            Check back soon for exciting prizes!
          </p>
        </div>
      )}

      {openItems.length > 0 && (
        <div className='space-y-3'>
          <h3
            className='text-sm font-semibold tracking-wide uppercase'
            style={{ color: 'var(--event-text-on-background, #6B7280)' }}
          >
            Open for Entries
          </h3>
          {openItems.map((item) => (
            <RevenueGeneratorCard
              key={item.id}
              item={item}
              brandPrimary={primary}
              onPurchase={handlePurchase}
              isPurchasing={purchasingId === item.id}
            />
          ))}
        </div>
      )}

      {closedItems.length > 0 && (
        <div className='space-y-3'>
          <h3
            className='text-sm font-semibold tracking-wide uppercase'
            style={{ color: 'var(--event-text-on-background, #6B7280)' }}
          >
            Closed
          </h3>
          {closedItems.map((item) => (
            <RevenueGeneratorCard
              key={item.id}
              item={item}
              brandPrimary={primary}
            />
          ))}
        </div>
      )}

      <Dialog
        open={instructionPopup !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInstructionPopup(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {instructionPopup?.title
                ? `${instructionPopup.title} Purchased`
                : 'Purchase Complete'}
            </DialogTitle>
          </DialogHeader>
          <p className='text-sm leading-relaxed'>{instructionPopup?.message}</p>
          <DialogFooter>
            <Button onClick={() => setInstructionPopup(null)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
