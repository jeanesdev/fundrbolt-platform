import {
  auctioneerService,
  type CommissionUpsertRequest,
  type EventSettingsUpsertRequest,
} from '@/services/auctioneerService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useAuctioneerDashboard(eventId: string) {
  return useQuery({
    queryKey: ['auctioneer-dashboard', eventId],
    queryFn: () => auctioneerService.getDashboard(eventId),
    enabled: Boolean(eventId),
    refetchInterval: 60_000,
  })
}

export function useAuctioneerCommissions(eventId: string) {
  return useQuery({
    queryKey: ['auctioneer-commissions', eventId],
    queryFn: () => auctioneerService.getCommissions(eventId),
    enabled: Boolean(eventId),
  })
}

export function useUpsertCommission(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      auctionItemId,
      data,
    }: {
      auctionItemId: string
      data: CommissionUpsertRequest
    }) => auctioneerService.upsertCommission(eventId, auctionItemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['auctioneer-commissions', eventId],
      })
      queryClient.invalidateQueries({
        queryKey: ['auctioneer-dashboard', eventId],
      })
      toast.success('Commission saved')
    },
    onError: () => {
      toast.error('Failed to save commission')
    },
  })
}

export function useDeleteCommission(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (auctionItemId: string) =>
      auctioneerService.deleteCommission(eventId, auctionItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['auctioneer-commissions', eventId],
      })
      queryClient.invalidateQueries({
        queryKey: ['auctioneer-dashboard', eventId],
      })
      toast.success('Commission removed')
    },
    onError: () => {
      toast.error('Failed to remove commission')
    },
  })
}

export function useAuctioneerSettings(eventId: string) {
  return useQuery({
    queryKey: ['auctioneer-settings', eventId],
    queryFn: () => auctioneerService.getSettings(eventId),
    enabled: Boolean(eventId),
  })
}

export function useUpsertSettings(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: EventSettingsUpsertRequest) =>
      auctioneerService.upsertSettings(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['auctioneer-settings', eventId],
      })
      queryClient.invalidateQueries({
        queryKey: ['auctioneer-dashboard', eventId],
      })
      toast.success('Settings saved')
    },
    onError: () => {
      toast.error('Failed to save settings')
    },
  })
}

export function useLiveAuction(eventId: string) {
  return useQuery({
    queryKey: ['auctioneer-live-auction', eventId],
    queryFn: () => auctioneerService.getLiveAuction(eventId),
    enabled: Boolean(eventId),
    refetchInterval: 5_000,
  })
}
