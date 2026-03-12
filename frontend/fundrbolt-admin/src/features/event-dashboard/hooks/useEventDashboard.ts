import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  eventDashboardService,
  type ProjectionAdjustmentUpdate,
  type ScenarioType,
  type SegmentType,
} from '@/services/event-dashboard'

export function useEventDashboard(eventId: string, scenario: ScenarioType) {
  return useQuery({
    queryKey: ['event-dashboard', eventId, scenario],
    queryFn: () => eventDashboardService.getDashboard(eventId, scenario),
    enabled: Boolean(eventId),
    refetchInterval: 60_000,
  })
}

export function useEventDashboardProjections(
  eventId: string,
  scenario: ScenarioType
) {
  return useQuery({
    queryKey: ['event-dashboard-projections', eventId, scenario],
    queryFn: () => eventDashboardService.getProjections(eventId, scenario),
    enabled: Boolean(eventId),
  })
}

export function useUpdateEventDashboardProjections(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ProjectionAdjustmentUpdate) =>
      eventDashboardService.updateProjections(eventId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['event-dashboard', eventId, variables.scenario],
      })
      void queryClient.invalidateQueries({
        queryKey: ['event-dashboard-projections', eventId, variables.scenario],
      })
    },
  })
}

export function useEventDashboardSegments(
  eventId: string,
  segmentType: SegmentType,
  sort: 'total_amount' | 'contribution_share' = 'total_amount'
) {
  return useQuery({
    queryKey: ['event-dashboard-segments', eventId, segmentType, sort],
    queryFn: () =>
      eventDashboardService.getSegments(eventId, segmentType, 20, sort),
    enabled: Boolean(eventId),
  })
}
