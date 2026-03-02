import apiClient from '@/lib/axios'

export type ScenarioType = 'base' | 'optimistic' | 'conservative'
export type SegmentType = 'table' | 'guest' | 'registrant' | 'company'

export interface MoneyValue {
  amount: number
  currency: string
}

export interface RevenueSourceSummary {
  source: string
  actual: MoneyValue
  projected: MoneyValue
  target: MoneyValue
  variance_amount: MoneyValue
  variance_percent: number
  pacing_percent: number
}

export interface PacingStatus {
  status: 'on_track' | 'off_track'
  pacing_percent: number
  trajectory: 'linear'
}

export interface CashflowPoint {
  date: string
  actual: MoneyValue
  projected: MoneyValue
}

export interface WaterfallStep {
  label: string
  amount: MoneyValue
}

export interface FunnelStage {
  stage: 'invited' | 'registered' | 'checked_in' | 'donated_bid'
  count: number
}

export interface AlertCard {
  source: string
  status: 'active' | 'resolved'
  threshold_percent: number
  consecutive_refreshes: number
  triggered_at?: string | null
}

export interface DashboardSummary {
  event_id: string
  goal: MoneyValue
  total_actual: MoneyValue
  total_projected: MoneyValue
  variance_amount: MoneyValue
  variance_percent: number
  pacing: PacingStatus
  sources: RevenueSourceSummary[]
  waterfall: WaterfallStep[]
  cashflow: CashflowPoint[]
  funnel: FunnelStage[]
  alerts: AlertCard[]
  last_refreshed_at: string
}

export interface SegmentBreakdownItem {
  segment_id: string
  segment_label: string
  total_amount: MoneyValue
  contribution_share: number
  guest_count: number
}

export interface SegmentBreakdownResponse {
  segment_type: SegmentType
  items: SegmentBreakdownItem[]
}

export interface ProjectionAdjustment {
  source: string
  projected: MoneyValue
}

export interface ProjectionAdjustmentSet {
  event_id: string
  scenario: ScenarioType
  adjustments: ProjectionAdjustment[]
  updated_at: string
  updated_by: string
}

export interface ProjectionAdjustmentUpdate {
  scenario: ScenarioType
  adjustments: ProjectionAdjustment[]
}

class EventDashboardService {
  async getDashboard(eventId: string, scenario: ScenarioType = 'base') {
    const response = await apiClient.get<DashboardSummary>(
      `/admin/events/${eventId}/dashboard`,
      {
        params: { scenario },
      }
    )
    return response.data
  }

  async getProjections(eventId: string, scenario: ScenarioType = 'base') {
    const response = await apiClient.get<ProjectionAdjustmentSet>(
      `/admin/events/${eventId}/dashboard/projections`,
      {
        params: { scenario },
      }
    )
    return response.data
  }

  async updateProjections(eventId: string, payload: ProjectionAdjustmentUpdate) {
    const response = await apiClient.post<ProjectionAdjustmentSet>(
      `/admin/events/${eventId}/dashboard/projections`,
      payload
    )
    return response.data
  }

  async getSegments(
    eventId: string,
    segmentType: SegmentType,
    limit = 20,
    sort: 'total_amount' | 'contribution_share' = 'total_amount'
  ) {
    const response = await apiClient.get<SegmentBreakdownResponse>(
      `/admin/events/${eventId}/dashboard/segments`,
      {
        params: {
          segment_type: segmentType,
          limit,
          sort,
        },
      }
    )
    return response.data
  }
}

export const eventDashboardService = new EventDashboardService()
