import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createSilentBid,
  getSilentAuctionBids,
  getSilentAuctionItems,
} from '../api/quickEntryApi'

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const apiMessage = (
      error.response?.data as { detail?: string | { message?: string } }
    )?.detail
    if (typeof apiMessage === 'string') return apiMessage
    if (apiMessage && typeof apiMessage === 'object' && 'message' in apiMessage)
      return apiMessage.message ?? fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

export function useSilentBidEntry(eventId: string) {
  const queryClient = useQueryClient()
  const [selectedItemId, setSelectedItemId] = useState('')
  const [amount, setAmount] = useState('')
  const [bidderNumber, setBidderNumber] = useState('')
  const [submitToken, setSubmitToken] = useState(0)
  const bidderRef = useRef<HTMLInputElement>(null)

  const itemsQuery = useQuery({
    queryKey: ['quick-entry', 'silent-items', eventId],
    queryFn: () => getSilentAuctionItems(eventId),
    enabled: !!eventId,
  })

  const bidsQuery = useQuery({
    queryKey: ['quick-entry', 'silent-bids', eventId, selectedItemId],
    queryFn: () => getSilentAuctionBids(eventId, selectedItemId),
    enabled: !!eventId && !!selectedItemId,
  })

  const selectedItem = (itemsQuery.data ?? []).find(
    (i) => i.id === selectedItemId
  )

  const selectItem = (itemId: string) => {
    setSelectedItemId(itemId)
    const item = (itemsQuery.data ?? []).find((c) => c.id === itemId)
    if (item) {
      // Pre-fill with min next bid
      const minBid = item.min_next_bid_amount ?? item.starting_bid
      setAmount(Math.round(minBid).toLocaleString('en-US'))
      return
    }
    setAmount('')
  }

  const submitMutation = useMutation({
    mutationFn: () =>
      createSilentBid(eventId, {
        item_id: selectedItemId,
        amount: Number(amount.replace(/,/g, '')),
        bidder_number: Number(bidderNumber),
      }),
    onSuccess: (data) => {
      toast.success(
        `Silent bid placed: Bidder ${data.bidder_number} — $${data.amount.toLocaleString('en-US')}`
      )
      setBidderNumber('')
      // Refresh the min bid for next entry
      const currentAmount = Number(amount.replace(/,/g, ''))
      const item = (itemsQuery.data ?? []).find((c) => c.id === selectedItemId)
      if (item) {
        const nextMin = currentAmount + (item.bid_increment ?? 0)
        setAmount(Math.round(nextMin).toLocaleString('en-US'))
      }
      setSubmitToken((t) => t + 1)
      queryClient.invalidateQueries({
        queryKey: ['quick-entry', 'silent-bids'],
      })
      queryClient.invalidateQueries({
        queryKey: ['quick-entry', 'silent-items'],
      })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to place silent bid'))
    },
  })

  // Re-focus bidder number after each successful submit
  useEffect(() => {
    if (submitToken > 0) {
      bidderRef.current?.focus()
      bidderRef.current?.select()
    }
  }, [submitToken])

  const handleBidderKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitMutation.mutate()
    }
  }

  return {
    items: itemsQuery.data ?? [],
    isLoadingItems: itemsQuery.isLoading,
    isItemsError: itemsQuery.isError,
    selectedItemId,
    selectedItem,
    setSelectedItemId: selectItem,
    amount,
    bidderNumber,
    bidderRef,
    recentBids: bidsQuery.data ?? [],
    isSubmitting: submitMutation.isPending,
    setAmount,
    setBidderNumber,
    handleBidderKeyDown,
    submitBid: () => submitMutation.mutate(),
    submitToken,
  }
}
