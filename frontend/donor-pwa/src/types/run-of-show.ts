export interface DonorRunOfShowItem {
  id: string
  event_id: string
  title: string
  description: string | null
  scheduled_time: string // ISO datetime
  donor_visible: boolean
  auctioneer_visible: boolean
  is_complete: boolean
  completed_at: string | null
  display_order: number
  has_notification: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface DonorRunOfShowResponse {
  items: DonorRunOfShowItem[]
  total_count: number
  completed_count: number
  next_item: DonorRunOfShowItem | null
  event_start_time: string | null
}
