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

export interface EventDetailResponse extends EventResponse {
  food_options: FoodOption[]
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
