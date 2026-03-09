/**
 * Public Events API Client
 *
 * Provides functions for accessing public event data (no authentication required).
 */

import apiClient from '@/lib/axios'
import type { AxiosResponse } from 'axios'

// ================================
// Types
// ================================

export interface EventResponse {
  id: string
  npo_id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  event_datetime: string
  location_name: string | null
  location_address: string | null
  venue_name: string | null
  venue_capacity: number | null
  status: 'draft' | 'active' | 'closed'
  primary_color: string | null
  secondary_color: string | null
  logo_url: string | null
  banner_url: string | null
  created_at: string
  updated_at: string
}

export interface EventListResponse {
  items: EventResponse[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface FoodOption {
  id: string
  event_id: string
  name: string
  description: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export type EventMediaUsageTag =
  | 'main_event_page_hero'
  | 'event_layout_map'
  | 'npo_logo'
  | 'event_logo'

export interface EventMedia {
  id: string
  event_id: string
  media_type: 'image' | 'video' | 'flyer'
  usage_tag: EventMediaUsageTag
  file_url: string
  file_name: string
  file_type: string
  mime_type: string
  file_size: number
}

export interface EventLink {
  id: string
  event_id: string
  link_type: 'video' | 'website' | 'social_media'
  url: string
  label: string | null
  platform: string | null
  display_order: number
}

export interface EventDetailResponse extends EventResponse {
  npo_name: string | null
  timezone: string
  venue_address: string | null
  venue_city: string | null
  venue_state: string | null
  venue_zip: string | null
  attire: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  background_color: string | null
  accent_color: string | null
  hero_transition_style: string
  food_options: FoodOption[]
  media: EventMedia[]
  links: EventLink[]
}

// ================================
// API Functions
// ================================

/**
 * Get public event by slug
 */
export async function getEventBySlug(slug: string): Promise<EventDetailResponse> {
  const response: AxiosResponse<EventDetailResponse> = await apiClient.get(
    `/events/public/${slug}`
  )
  return response.data
}

/**
 * List all active public events
 */
export async function listPublicEvents(params?: {
  page?: number
  per_page?: number
}): Promise<EventListResponse> {
  const response: AxiosResponse<EventListResponse> = await apiClient.get(
    '/events/public',
    { params }
  )
  return response.data
}

/**
 * Get event branding information
 */
export async function getEventBranding(slug: string): Promise<{
  primary_color: string | null
  secondary_color: string | null
  logo_url: string | null
  banner_url: string | null
}> {
  const event = await getEventBySlug(slug)
  return {
    primary_color: event.primary_color,
    secondary_color: event.secondary_color,
    logo_url: event.logo_url,
    banner_url: event.banner_url,
  }
}
