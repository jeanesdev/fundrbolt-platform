/**
 * Event types
 * Type definitions for event management, media, links, and food options
 */

// ============================================
// Enums
// ============================================

export type EventStatus = 'draft' | 'active' | 'closed'

export type EventMediaStatus = 'uploaded' | 'scanning' | 'approved' | 'rejected'

export type EventLinkType = 'video' | 'website' | 'social'

// ============================================
// Event Types
// ============================================

export interface Event {
  id: string
  npo_id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  event_datetime: string
  timezone: string
  venue_name: string | null
  venue_address: string | null
  venue_city: string | null
  venue_state: string | null
  venue_zip: string | null
  primary_color: string | null
  secondary_color: string | null
  background_color: string | null
  accent_color: string | null
  status: EventStatus
  version: number
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  npo_name?: string
}

export interface EventDetail extends Event {
  media?: EventMedia[]
  links?: EventLink[]
  food_options?: FoodOption[]
}

export interface EventCreateRequest {
  npo_id: string
  name: string
  slug?: string
  tagline?: string
  description?: string
  event_datetime: string
  timezone: string
  venue_name?: string
  venue_address?: string
  venue_city?: string
  venue_state?: string
  venue_zip?: string
  primary_color?: string
  secondary_color?: string
  background_color?: string
  accent_color?: string
}

export interface EventUpdateRequest {
  name?: string
  slug?: string
  tagline?: string
  description?: string
  event_datetime?: string
  timezone?: string
  venue_name?: string
  venue_address?: string
  venue_city?: string
  venue_state?: string
  venue_zip?: string
  primary_color?: string
  secondary_color?: string
  background_color?: string
  accent_color?: string
  version?: number
}

export interface EventListParams {
  npo_id?: string
  status?: EventStatus
  search?: string
  page?: number
  page_size?: number
}

export interface EventListResponse {
  items: Event[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ============================================
// Event Media Types
// ============================================

export interface EventMedia {
  id: string
  event_id: string
  file_name: string
  file_type: string
  file_size: number
  blob_storage_url: string
  status: EventMediaStatus
  scan_result: string | null
  uploaded_at: string
  scanned_at: string | null
  created_at: string
  updated_at: string
}

export interface MediaUploadRequest {
  file_name: string
  file_type: string
  file_size: number
}

export interface MediaUploadResponse {
  upload_url: string
  media_id: string
  expires_in: number
}

export interface MediaConfirmRequest {
  media_id: string
}

// ============================================
// Event Link Types
// ============================================

export interface EventLink {
  id: string
  event_id: string
  link_type: EventLinkType
  url: string
  title: string | null
  description: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export interface EventLinkCreateRequest {
  link_type: EventLinkType
  url: string
  title?: string
  description?: string
  display_order?: number
}

export interface EventLinkUpdateRequest {
  link_type?: EventLinkType
  url?: string
  title?: string
  description?: string
  display_order?: number
}

// ============================================
// Food Option Types
// ============================================

export interface FoodOption {
  id: string
  event_id: string
  name: string
  description: string | null
  icon: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface FoodOptionCreateRequest {
  name: string
  description?: string
  icon?: string
  is_default?: boolean
}

export interface FoodOptionUpdateRequest {
  name?: string
  description?: string
  icon?: string
  is_default?: boolean
}
