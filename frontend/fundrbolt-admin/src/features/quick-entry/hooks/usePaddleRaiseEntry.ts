import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  createPaddleDonation,
  getPaddleRaiseSummary,
  getQuickEntryDonationLabels,
} from '../api/quickEntryApi'

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const apiMessage =
      (error.response?.data as { detail?: { message?: string } })?.detail?.message ??
      error.response?.data?.detail
    if (typeof apiMessage === 'string') {
      return apiMessage
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

export function usePaddleRaiseEntry(eventId: string) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [bidderNumber, setBidderNumber] = useState('')
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [customLabel, setCustomLabel] = useState('')
  const [submitToken, setSubmitToken] = useState(0)

  const parsedAmount = useMemo(
    () => Number.parseInt(amount.replace(/,/g, ''), 10),
    [amount]
  )
  const parsedBidder = useMemo(() => Number.parseInt(bidderNumber, 10), [bidderNumber])

  const labelsQuery = useQuery({
    queryKey: ['quick-entry', 'labels', eventId],
    queryFn: () => getQuickEntryDonationLabels(eventId),
    enabled: !!eventId,
  })

  const summaryQuery = useQuery({
    queryKey: ['quick-entry', 'paddle-summary', eventId],
    queryFn: () => getPaddleRaiseSummary(eventId),
    enabled: !!eventId,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Enter a valid amount')
      }
      if (!Number.isFinite(parsedBidder) || parsedBidder <= 0) {
        throw new Error('Enter a valid bidder number')
      }

      return createPaddleDonation(eventId, {
        amount: parsedAmount,
        bidder_number: parsedBidder,
        label_ids: selectedLabelIds,
        custom_label: customLabel.trim() || undefined,
      })
    },
    onSuccess: () => {
      setBidderNumber('')
      setSubmitToken((current) => current + 1)
      queryClient.invalidateQueries({ queryKey: ['quick-entry'] })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to submit donation'))
      setSubmitToken((current) => current + 1)
    },
  })

  return {
    amount,
    bidderNumber,
    selectedLabelIds,
    customLabel,
    labels: labelsQuery.data?.items ?? [],
    summary: summaryQuery.data,
    isSubmitting: mutation.isPending,
    setAmount,
    setBidderNumber,
    setCustomLabel,
    setSelectedLabelIds,
    submitDonation: () => mutation.mutate(),
    submitToken,
  }
}
