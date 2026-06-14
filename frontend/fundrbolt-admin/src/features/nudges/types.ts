export type NudgeType =
  | 'watchers_no_bid'
  | 'items_no_bids'
  | 'items_most_bids'
  | 'closing_soon_watchers'
  | 'outbid_still_watching'
  | 'non_participating_attendees'
  | 'revenue_generator_low_participation'
  | 'revenue_generators_not_started'
  | 'goal_progress'
  | 'goal_milestone_approaching'
  | 'pareto_donors'
  | 'checked_in_no_activity'
  | 'paddle_raise_momentum'

export interface NudgeItem {
  nudge_key: string
  nudge_type: NudgeType
  rank: 1 | 2 | 3 | 4 | 5
  title: string
  description: string
  action_url: string | null
  action_label: string | null
  affected_count: number
  metadata: Record<string, unknown>
  is_dismissible: boolean
  notifies_on_appear: boolean
  is_dismissed: boolean
}

export interface NudgesResponse {
  nudges: NudgeItem[]
  total_count: number
  active_count: number
  computed_at: string
}

export interface DismissNudgeRequest {
  action: 'dismissed' | 'actioned'
}

export interface DismissNudgeResponse {
  nudge_key: string
  action: string
  expires_at: string | null
}
