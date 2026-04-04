/**
 * Checklist TypeScript types for the admin PWA
 */

export type ChecklistItemStatus = 'not_complete' | 'in_progress' | 'complete'

export interface ChecklistItem {
  id: string
  event_id: string
  title: string
  due_date: string | null
  status: ChecklistItemStatus
  display_order: number
  due_date_is_template_derived: boolean
  offset_days: number | null
  completed_at: string | null
  is_overdue: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface ChecklistItemCreate {
  title: string
  due_date?: string | null
}

export interface ChecklistItemUpdate {
  title?: string
  due_date?: string | null
}

export interface ChecklistItemStatusUpdate {
  status: ChecklistItemStatus
}

export interface ChecklistResponse {
  items: ChecklistItem[]
  total_count: number
  completed_count: number
  in_progress_count: number
  overdue_count: number
  progress_percentage: number
}

export interface ChecklistTemplate {
  id: string
  npo_id: string | null
  name: string
  is_default: boolean
  is_system_default: boolean
  item_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ChecklistTemplateItem {
  id: string
  title: string
  offset_days: number | null
  display_order: number
}

export interface ChecklistTemplateDetail {
  id: string
  npo_id: string | null
  name: string
  is_default: boolean
  is_system_default: boolean
  items: ChecklistTemplateItem[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ChecklistTemplateUpdate {
  name?: string
}

export interface ApplyTemplateRequest {
  template_id: string
  mode: 'replace' | 'append'
}

export interface SaveAsTemplateRequest {
  name: string
}

export interface ChecklistReorderRequest {
  item_ids: string[]
}
