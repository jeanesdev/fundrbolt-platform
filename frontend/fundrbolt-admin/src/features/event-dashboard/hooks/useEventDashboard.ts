/**
 * Event Dashboard React Query Hooks
 * 
 * Provides hooks for fetching and mutating event dashboard data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getDashboardSummary,
  getSegmentBreakdown,
  getProjectionAdjustments,
  updateProjectionAdjustments,
  type GetDashboardParams,
  type GetSegmentsParams,
  type GetProjectionsParams,
  type UpdateProjectionsParams,
} from '@/services/event-dashboard'
import type { DashboardSummary, SegmentBreakdownResponse, ProjectionAdjustmentSet } from '@/types/event-dashboard'

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (eventId: string) => [...dashboardKeys.all, 'summary', eventId] as const,
  summaryWithParams: (params: GetDashboardParams) => [...dashboardKeys.summary(params.eventId), params] as const,
  segments: (eventId: string, segmentType: string) => [...dashboardKeys.all, 'segments', eventId, segmentType] as const,
  projections: (eventId: string, scenario?: string) => [...dashboardKeys.all, 'projections', eventId, scenario] as const,
}

/**
 * Hook to fetch event dashboard summary
 * 
 * Includes auto-refresh every 60 seconds as per spec
 */
export function useEventDashboard(params: GetDashboardParams, enabled = true) {
  return useQuery<DashboardSummary>({
    queryKey: dashboardKeys.summaryWithParams(params),
    queryFn: () => getDashboardSummary(params),
    enabled,
    refetchInterval: 60000, // Auto-refresh every 60 seconds
    refetchIntervalInBackground: true,
    staleTime: 30000, // Consider data stale after 30 seconds
  })
}

/**
 * Hook to fetch segment breakdown
 */
export function useSegmentBreakdown(params: GetSegmentsParams, enabled = true) {
  return useQuery<SegmentBreakdownResponse>({
    queryKey: [...dashboardKeys.segments(params.eventId, params.segmentType), params],
    queryFn: () => getSegmentBreakdown(params),
    enabled,
    staleTime: 30000,
  })
}

/**
 * Hook to fetch projection adjustments
 */
export function useProjectionAdjustments(params: GetProjectionsParams, enabled = true) {
  return useQuery<ProjectionAdjustmentSet>({
    queryKey: dashboardKeys.projections(params.eventId, params.scenario),
    queryFn: () => getProjectionAdjustments(params),
    enabled,
    staleTime: 60000, // Projections change less frequently
  })
}

/**
 * Hook to update projection adjustments
 */
export function useUpdateProjections() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: UpdateProjectionsParams) => updateProjectionAdjustments(params),
    onSuccess: (data, variables) => {
      // Invalidate and refetch dashboard summary to show updated projections
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.summary(variables.eventId),
      })
      
      // Update the projections cache
      queryClient.setQueryData(
        dashboardKeys.projections(variables.eventId, variables.update.scenario),
        data
      )
    },
  })
}

/**
 * Hook to manually refresh dashboard data
 */
export function useRefreshDashboard() {
  const queryClient = useQueryClient()

  return (eventId: string) => {
    // Invalidate all dashboard queries for this event
    queryClient.invalidateQueries({
      queryKey: dashboardKeys.summary(eventId),
    })
    queryClient.invalidateQueries({
      queryKey: [...dashboardKeys.all, 'segments', eventId],
    })
  }
}
