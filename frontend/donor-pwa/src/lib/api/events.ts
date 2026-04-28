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
  npo_name: string | null
  npo_slug?: string | null
  slug: string
  name: string
  tagline: string | null
  description?: string | null
  event_datetime: string
  timezone: string
  location_name?: string | null
  location_address?: string | null
  venue_name: string | null
  venue_address?: string | null
  venue_city: string | null
  venue_state: string | null
  venue_zip?: string | null
  venue_capacity?: number | null
  status: 'draft' | 'active' | 'closed'
  checkout_open?: boolean
  logo_url: string | null
  primary_color?: string | null
  secondary_color?: string | null
  background_color?: string | null
  accent_color?: string | null
  banner_url?: string | null
  hero_transition_style: string
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

export interface PublicTicketCustomOption {
  id: string
  label: string
  type: 'boolean' | 'multi_select' | 'text_input'
  choices: string[] | null
  is_required: boolean
  display_order: number
}

export interface EventDetailResponse extends EventResponse {
  npo_name: string | null
  npo_slug?: string | null
  timezone: string
  location_name?: string | null
  location_address: string | null
  venue_address: string | null
  venue_city: string | null
  venue_state: string | null
  venue_zip: string | null
  venue_capacity?: number | null
  attire: string | null
  fundraising_goal?: number | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  description: string | null
  primary_color: string | null
  secondary_color: string | null
  background_color: string | null
  accent_color: string | null
  banner_url?: string | null
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
export async function getEventBySlug(
  slug: string
): Promise<EventDetailResponse> {
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
    banner_url: event.banner_url ?? null,
  }
}

// ================================
// Ticket Packages
// ================================

export interface PublicTicketPackage {
  id: string
  name: string
  description: string | null
  price: number
  seats_per_package: number
  quantity_remaining: number | null
  sold_out: boolean
  image_url: string | null
  custom_options: PublicTicketCustomOption[]
}

/**
 * Get publicly visible ticket packages for an event (no auth required).
 */
export async function getTicketPackages(
  slug: string
): Promise<PublicTicketPackage[]> {
  const response = await apiClient.get<
    Array<{
      id: string
      name: string
      description: string | null
      price: string
      seats_per_package: number
      quantity_limit: number | null
      sold_count: number
      is_sponsorship: boolean
      custom_options?: PublicTicketCustomOption[]
    }>
  >(`/events/${slug}/tickets`)

  return response.data.map((pkg) => {
    const qtyRemaining =
      pkg.quantity_limit != null
        ? Math.max(0, pkg.quantity_limit - pkg.sold_count)
        : null
    return {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      price: Math.round(parseFloat(pkg.price) * 100),
      seats_per_package: pkg.seats_per_package,
      quantity_remaining: qtyRemaining,
      sold_out: qtyRemaining !== null && qtyRemaining <= 0,
      image_url: null,
      custom_options: pkg.custom_options ?? [],
    }
  })
}

/**
 * Get event-level (universal) custom options that apply to all registrations.
 */
export async function getEventCustomOptions(
  slug: string
): Promise<PublicTicketCustomOption[]> {
  const response = await apiClient.get<
    Array<{
      id: string
      label: string
      type: 'boolean' | 'multi_select' | 'text_input'
      choices: string[] | null
      is_required: boolean
      display_order: number
    }>
  >(`/events/${slug}/custom-options`)

  return response.data
}
