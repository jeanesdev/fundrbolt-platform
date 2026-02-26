import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'

import { assignWinner, deleteLiveBid, getLiveAuctionSummary } from '../api/quickEntryApi'

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

export function useLiveAuctionControls(eventId: string, selectedItemId: string) {
  const queryClient = useQueryClient()

  const summaryQuery = useQuery({
    queryKey: ['quick-entry', 'live-summary', eventId, selectedItemId],
    queryFn: () => getLiveAuctionSummary(eventId, selectedItemId),
    enabled: !!eventId && !!selectedItemId,
  })

  const deleteMutation = useMutation({
    mutationFn: (bidId: string) => deleteLiveBid(eventId, bidId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-entry'] })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to delete bid'))
    },
  })

  const winnerMutation = useMutation({
    mutationFn: () => assignWinner(eventId, selectedItemId),
    onSuccess: (data) => {
      toast.success(
        `Winner assigned: Bidder ${data.winner_bidder_number} at $${data.winning_amount.toLocaleString('en-US')}`
      )
      queryClient.invalidateQueries({ queryKey: ['quick-entry'] })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to assign winner'))
    },
  })

  return {
    summary: summaryQuery.data,
    isLoadingSummary: summaryQuery.isLoading,
    isDeleting: deleteMutation.isPending,
    isAssigningWinner: winnerMutation.isPending,
    deleteBid: (bidId: string) => deleteMutation.mutate(bidId),
    assignWinner: () => winnerMutation.mutate(),
  }
}
