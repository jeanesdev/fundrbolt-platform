/**
 * Event types
 * Type definitions for event management, media, links, and food options
 */

// ============================================
// Enums
// ============================================

export type EventStatus = 'draft' | 'active' | 'closed'

export type EventMediaStatus = 'uploaded' | 'scanning' | 'approved' | 'rejected'

export type EventLinkType = 'video' | 'website' | 'social_media'

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
  attire: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  primary_color: string | null
  secondary_color: string | null
  background_color: string | null
  accent_color: string | null
  table_count: number | null
  max_guests_per_table: number | null
  seating_layout_image_url: string | null
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
  sponsors?: Array<{
    id: string
    name: string
    logo_size: string
  }>
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
  attire?: string
  primary_contact_name?: string
  primary_contact_email?: string
  primary_contact_phone?: string
  primary_color?: string
  secondary_color?: string
  background_color?: string
  accent_color?: string
  table_count?: number | null
  max_guests_per_table?: number | null
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
  attire?: string
  primary_contact_name?: string
  primary_contact_email?: string
  primary_contact_phone?: string
  primary_color?: string
  secondary_color?: string
  background_color?: string
  accent_color?: string
  table_count?: number | null
  max_guests_per_table?: number | null
  seating_layout_image_url?: string | null
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

export interface EventStats {
  event_id: string
  media_count: number
  links_count: number
  food_options_count: number
  sponsors_count: number
  auction_items_count: number
  auction_bids_count: number
  registrations_count: number
  active_registrations_count: number
  guest_count: number
  active_guest_count: number
}

// ============================================
// Event Media Types
// ============================================

export interface EventMedia {
  id: string
  event_id: string
  media_type: string
  file_url: string
  file_name: string
  file_type: string
  mime_type: string
  file_size: number
  display_order: number
  status: EventMediaStatus
  created_at: string
  uploaded_by: string
}

export interface MediaUploadRequest {
  file_name: string
  file_type: string
  file_size: number
  media_type: 'image' | 'video' | 'flyer'
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
  label: string | null
  platform: string | null
  display_order: number
  created_at: string
}

export interface EventLinkCreateRequest {
  link_type: EventLinkType
  url: string
  label?: string
  platform?: string
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
