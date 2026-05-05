export interface RunOfShowItem {
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
  notifications: RosNotification[]
  created_by: string
  created_at: string
  updated_at: string
}

export interface RunOfShowResponse {
  items: RunOfShowItem[]
  total_count: number
  completed_count: number
  next_item: RunOfShowItem | null
  event_start_time: string | null
}

export interface RunOfShowItemCreate {
  title: string
  description?: string | null
  scheduled_time: string
  donor_visible?: boolean
  auctioneer_visible?: boolean
  display_order?: number | null
}

export interface RunOfShowItemUpdate {
  title?: string
  description?: string | null
  scheduled_time?: string
  donor_visible?: boolean
  auctioneer_visible?: boolean
  display_order?: number | null
}

export interface RunOfShowReorderRequest {
  item_ids: string[]
}

export interface RunOfShowTemplate {
  id: string
  npo_id: string | null
  name: string
  is_system_default: boolean
  item_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RunOfShowTemplateItem {
  id: string
  title: string
  description: string | null
  offset_minutes: number
  donor_visible_default: boolean
  auctioneer_visible_default: boolean
  display_order: number
}

export interface RunOfShowTemplateDetail {
  id: string
  npo_id: string | null
  name: string
  is_system_default: boolean
  items: RunOfShowTemplateItem[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SaveAsTemplateRequest {
  name: string
}

export interface ApplyTemplateRequest {
  template_id: string
  confirm_replace?: boolean
}

export interface ApplyTemplateResponse {
  replaced: boolean
  items_created: number
}

export interface RosNotification {
  id: string
  ros_item_id: string
  message_body: string
  recipient_type: 'donors' | 'auctioneer' | 'all_attendees'
  minutes_before: number
  scheduled_at: string
  delivery_status: 'pending' | 'delivered' | 'failed' | 'cancelled'
  celery_task_id: string | null
  delivered_at: string | null
  failure_reason: string | null
  created_at: string
  updated_at: string
}

export interface RosNotificationCreate {
  message_body: string
  recipient_type: 'donors' | 'auctioneer' | 'all_attendees'
  minutes_before?: number
}
