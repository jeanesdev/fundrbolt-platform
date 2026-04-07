import { useQuery } from '@tanstack/react-query'
import {
  donorDashboardService,
  type LeaderboardParams,
  type PaginatedScopedParams,
  type ScopedParams,
} from '@/services/donor-dashboard'

export function useDonorLeaderboard(params: LeaderboardParams) {
  return useQuery({
    queryKey: ['donor-dashboard', 'leaderboard', params],
    queryFn: () => donorDashboardService.getLeaderboard(params),
    refetchInterval: 60_000,
  })
}

export function useDonorProfile(userId: string | null, params: ScopedParams) {
  return useQuery({
    queryKey: ['donor-dashboard', 'profile', userId, params],
    queryFn: () => donorDashboardService.getDonorProfile(userId!, params),
    enabled: Boolean(userId),
  })
}

export function useOutbidLeaders(params: PaginatedScopedParams) {
  return useQuery({
    queryKey: ['donor-dashboard', 'outbid-leaders', params],
    queryFn: () => donorDashboardService.getOutbidLeaders(params),
    refetchInterval: 60_000,
  })
}

export function useBidWars(params: PaginatedScopedParams) {
  return useQuery({
    queryKey: ['donor-dashboard', 'bid-wars', params],
    queryFn: () => donorDashboardService.getBidWars(params),
    refetchInterval: 60_000,
  })
}

export function useCategoryBreakdown(params: ScopedParams) {
  return useQuery({
    queryKey: ['donor-dashboard', 'category-breakdown', params],
    queryFn: () => donorDashboardService.getCategoryBreakdown(params),
    refetchInterval: 60_000,
  })
}
