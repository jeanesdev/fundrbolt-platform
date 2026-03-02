import { useQuery } from '@tanstack/react-query'
import { auctionBidService } from '@/services/auctionBidService'
import type { AuctionBidDashboardResponse } from '@/types/auctionBidImport'

export function useAuctionBidDashboard(eventId: string) {
  return useQuery<AuctionBidDashboardResponse>({
    queryKey: ['auction-bid-dashboard', eventId],
    queryFn: () => auctionBidService.getDashboard(eventId),
    enabled: Boolean(eventId),
    staleTime: 30_000,
  })
}
