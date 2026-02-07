/**
 * Event Dashboard Type Definitions
 * 
 * TypeScript types for event dashboard data structures
 */

export type RevenueSource =
  | 'tickets'
  | 'sponsorships'
  | 'silent_auction'
  | 'live_auction'
  | 'paddle_raise'
  | 'donations'
  | 'fees_other'

export type PacingStatus = 'on_track' | 'off_track'

export type Trajectory = 'linear'

export type ScenarioType = 'base' | 'optimistic' | 'conservative'

export type SegmentType = 'table' | 'guest' | 'registrant' | 'company'

export type FunnelStageType = 'invited' | 'registered' | 'checked_in' | 'donated_bid'

export type AlertStatus = 'active' | 'resolved'

export interface MoneyValue {
  amount: string
  currency: string
}

export interface RevenueSourceSummary {
  source: RevenueSource
  actual: MoneyValue
  projected: MoneyValue
  target: MoneyValue
  variance_amount: MoneyValue
  variance_percent: number
  pacing_percent: number
}

export interface PacingStatusResponse {
  status: PacingStatus
  pacing_percent: number
  trajectory: Trajectory
}

export interface CashflowPoint {
  date: string
  actual: MoneyValue
  projected?: MoneyValue
}

export interface WaterfallStep {
  label: string
  amount: MoneyValue
}

export interface FunnelStage {
  stage: FunnelStageType
  count: number
}

export interface AlertCard {
  source: RevenueSource
  status: AlertStatus
  threshold_percent: number
  consecutive_refreshes: number
  triggered_at: string
  resolved_at?: string
}

export interface DashboardSummary {
  event_id: string
  goal: MoneyValue
  total_actual: MoneyValue
  total_projected: MoneyValue
  variance_amount: MoneyValue
  variance_percent: number
  pacing: PacingStatusResponse
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
  source: RevenueSource
  projected: MoneyValue
}

export interface ProjectionAdjustmentSet {
  event_id: string
  scenario: ScenarioType
  adjustments: ProjectionAdjustment[]
  updated_at: string
  updated_by?: string
}

export interface ProjectionAdjustmentUpdate {
  scenario: ScenarioType
  adjustments: ProjectionAdjustment[]
}
