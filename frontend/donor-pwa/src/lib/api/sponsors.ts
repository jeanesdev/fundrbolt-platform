/**
 * Sponsors API Client
 * Public endpoints for fetching event sponsors
 */

import apiClient from '@/lib/axios'

export interface Sponsor {
  id: string
  event_id: string
  name: string
  logo_url: string
  logo_blob_name: string
  thumbnail_url: string
  thumbnail_blob_name: string
  website_url: string | null
  logo_size: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge'
  sponsor_level: string | null
  display_order: number
  created_at: string
  updated_at: string
}

/**
 * Get all sponsors for an event
 * Public endpoint - no authentication required
 */
export async function getEventSponsors(eventId: string): Promise<Sponsor[]> {
  const response = await apiClient.get<Sponsor[]>(`/events/${eventId}/sponsors`)
  return response.data
}
