import { useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createPaddleDonation,
  getPaddleDonations,
  getPaddleRaiseSummary,
  getQuickEntryDonationLabels,
} from '../api/quickEntryApi'

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as
      | { detail?: string | { message?: string; detail?: string } }
      | undefined
    const detail = payload?.detail
    const apiMessage =
      typeof detail === 'string'
        ? detail
        : typeof detail?.message === 'string'
          ? detail.message
          : typeof detail?.detail === 'string'
            ? detail.detail
            : undefined
    if (typeof apiMessage === 'string') {
      return apiMessage
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
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
  const parsedBidder = useMemo(
    () => Number.parseInt(bidderNumber, 10),
    [bidderNumber]
  )

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

  const donationsQuery = useQuery({
    queryKey: ['quick-entry', 'paddle-donations', eventId],
    queryFn: () => getPaddleDonations(eventId),
    enabled: !!eventId,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isUuid(eventId)) {
        throw new Error('Event context is still loading. Please try again.')
      }
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
      toast.success('Donation submitted')
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
    labelsError: labelsQuery.error,
    isLoadingLabels: labelsQuery.isLoading,
    summary: summaryQuery.data,
    recentDonations: donationsQuery.data?.items ?? [],
    isSubmitting: mutation.isPending,
    setAmount,
    setBidderNumber,
    setCustomLabel,
    setSelectedLabelIds,
    submitDonation: () => mutation.mutate(),
    submitToken,
  }
}
