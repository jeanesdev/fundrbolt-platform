import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { createLiveBid, getQuickEntryStatus } from '../api/quickEntryApi'

function getApiErrorMessage(error: AxiosError): string | null {
  const response = error.response?.data as
    | { detail?: string | { message?: string; detail?: string } }
    | undefined
  const detail = response?.detail
  if (typeof detail === 'string') {
    return detail
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string') {
      return detail.message
    }
    if (typeof detail.detail === 'string') {
      return detail.detail
    }
  }
  return null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

export function useQuickEntryStatus(eventId: string) {
  return useQuery({
    queryKey: ['quick-entry', 'status', eventId],
    queryFn: () => getQuickEntryStatus(eventId),
    enabled: !!eventId,
  })
}

export function useLiveBidEntry(eventId: string, selectedItemId: string) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [bidderNumber, setBidderNumber] = useState('')
  const [submitToken, setSubmitToken] = useState(0)

  const parsedAmount = useMemo(
    () => Number.parseInt(amount.replace(/,/g, ''), 10),
    [amount]
  )
  const parsedBidder = useMemo(() => Number.parseInt(bidderNumber, 10), [bidderNumber])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isUuid(eventId)) {
        throw new Error('Event context is still loading. Please try again.')
      }
      if (!selectedItemId) {
        throw new Error('Select a live auction item first')
      }
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Enter a valid amount')
      }
      if (!Number.isFinite(parsedBidder) || parsedBidder <= 0) {
        throw new Error('Enter a valid bidder number')
      }

      return createLiveBid(eventId, {
        item_id: selectedItemId,
        amount: parsedAmount,
        bidder_number: parsedBidder,
      })
    },
    onSuccess: () => {
      setAmount('')
      setBidderNumber('')
      setSubmitToken((current) => current + 1)
      queryClient.invalidateQueries({ queryKey: ['quick-entry'] })
    },
    onError: (error) => {
      let message = 'Failed to submit bid'
      if (error instanceof AxiosError) {
        message = getApiErrorMessage(error) ?? message
      } else if (error instanceof Error) {
        message = error.message
      }
      toast.error(message)
    },
  })

  return {
    amount,
    bidderNumber,
    setAmount,
    setBidderNumber,
    submitBid: () => mutation.mutate(),
    isSubmitting: mutation.isPending,
    submitToken,
  }
}
