import { useQuery } from '@tanstack/react-query'
import {
  auctionDashboardService,
  type AuctionDashboardParams,
  type AuctionItemsParams,
} from '@/services/auction-dashboard'

export function useAuctionSummary(params: AuctionDashboardParams) {
  return useQuery({
    queryKey: ['auction-dashboard', 'summary', params],
    queryFn: () => auctionDashboardService.getSummary(params),
    refetchInterval: 60_000,
  })
}

export function useAuctionItems(params: AuctionItemsParams) {
  return useQuery({
    queryKey: ['auction-dashboard', 'items', params],
    queryFn: () => auctionDashboardService.getItems(params),
    refetchInterval: 60_000,
  })
}

export function useAuctionCharts(params: AuctionDashboardParams) {
  return useQuery({
    queryKey: ['auction-dashboard', 'charts', params],
    queryFn: () => auctionDashboardService.getCharts(params),
    refetchInterval: 60_000,
  })
}

export function useAuctionItemDetail(itemId: string | null) {
  return useQuery({
    queryKey: ['auction-dashboard', 'item-detail', itemId],
    queryFn: () => auctionDashboardService.getItemDetail(itemId!),
    enabled: Boolean(itemId),
  })
}
