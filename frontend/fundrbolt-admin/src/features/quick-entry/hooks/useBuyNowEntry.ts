import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createBuyNowBid,
  deleteBuyNowBid,
  getBuyNowBids,
  getBuyNowItems,
  getBuyNowSummary,
} from '../api/quickEntryApi'

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const apiMessage =
      (error.response?.data as { detail?: { message?: string } })?.detail
        ?.message ?? error.response?.data?.detail
    if (typeof apiMessage === 'string') return apiMessage
  }
  if (error instanceof Error) return error.message
  return fallback
}

export function useBuyNowEntry(eventId: string) {
  const queryClient = useQueryClient()
  const [selectedItemId, setSelectedItemId] = useState('')
  const [amount, setAmount] = useState('')
  const [bidderNumber, setBidderNumber] = useState('')
  const [submitToken, setSubmitToken] = useState(0)
  const bidderRef = useRef<HTMLInputElement>(null)

  const itemsQuery = useQuery({
    queryKey: ['quick-entry', 'buy-now-items', eventId],
    queryFn: () => getBuyNowItems(eventId),
    enabled: !!eventId,
  })

  const bidsQuery = useQuery({
    queryKey: ['quick-entry', 'buy-now-bids', eventId, selectedItemId],
    queryFn: () => getBuyNowBids(eventId, selectedItemId),
    enabled: !!eventId && !!selectedItemId,
  })

  const summaryQuery = useQuery({
    queryKey: ['quick-entry', 'buy-now-summary', eventId],
    queryFn: () => getBuyNowSummary(eventId),
    enabled: !!eventId,
    refetchInterval: 10_000,
  })

  const selectedItem = (itemsQuery.data ?? []).find(
    (i) => i.id === selectedItemId
  )

  const selectItem = (itemId: string) => {
    setSelectedItemId(itemId)
    const item = (itemsQuery.data ?? []).find(
      (candidate) => candidate.id === itemId
    )
    if (item) {
      setAmount(Math.round(item.buy_now_price).toLocaleString('en-US'))
      return
    }
    setAmount('')
  }

  const submitMutation = useMutation({
    mutationFn: () =>
      createBuyNowBid(eventId, {
        item_id: selectedItemId,
        amount: Number(amount.replace(/,/g, '')),
        bidder_number: Number(bidderNumber),
      }),
    onSuccess: (data) => {
      toast.success(
        `Buy-it-now recorded: Bidder ${data.bidder_number} — $${data.amount.toLocaleString('en-US')}`
      )
      setBidderNumber('')
      setSubmitToken((t) => t + 1)
      queryClient.invalidateQueries({
        queryKey: ['quick-entry', 'buy-now-bids'],
      })
      queryClient.invalidateQueries({
        queryKey: ['quick-entry', 'buy-now-summary'],
      })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to record buy-it-now bid'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (bidId: string) => deleteBuyNowBid(eventId, bidId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['quick-entry', 'buy-now-bids'],
      })
      queryClient.invalidateQueries({
        queryKey: ['quick-entry', 'buy-now-summary'],
      })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to delete bid'))
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
    selectedItemId,
    setSelectedItemId: selectItem,
    amount,
    setAmount,
    bidderNumber,
    setBidderNumber,
    bidderRef,
    handleBidderKeyDown,
    items: itemsQuery.data ?? [],
    isLoadingItems: itemsQuery.isLoading,
    isItemsError: itemsQuery.isError,
    recentBids: bidsQuery.data ?? [],
    selectedItem,
    summary: summaryQuery.data,
    isSubmitting: submitMutation.isPending,
    submitBid: () => submitMutation.mutate(),
    isDeleting: deleteMutation.isPending,
    deleteBid: (id: string) => deleteMutation.mutate(id),
  }
}
