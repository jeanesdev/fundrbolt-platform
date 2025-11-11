/**
 * Event API service
 * Handles all event-related API calls including CRUD, media, links, and food options
 */

import apiClient from '@/lib/axios'
import type {
  Event,
  EventCreateRequest,
  EventDetail,
  EventLink,
  EventLinkCreateRequest,
  EventLinkUpdateRequest,
  EventListParams,
  EventListResponse,
  EventMedia,
  EventUpdateRequest,
  FoodOption,
  FoodOptionCreateRequest,
  FoodOptionUpdateRequest,
  MediaConfirmRequest,
  MediaUploadRequest,
  MediaUploadResponse,
} from '@/types/event'

// ============================================
// Event Management
// ============================================

export const eventApi = {
  /**
   * Fetch list of events with optional filters
   */
  async listEvents(params?: EventListParams): Promise<EventListResponse> {
    const response = await apiClient.get<EventListResponse>('/events', { params })
    return response.data
  },

  /**
   * Fetch single event by ID
   */
  async getEvent(eventId: string): Promise<EventDetail> {
    const response = await apiClient.get<EventDetail>(`/events/${eventId}`)
    return response.data
  },

  /**
   * Fetch event by slug (public endpoint)
   */
  async getEventBySlug(slug: string): Promise<EventDetail> {
    const response = await apiClient.get<EventDetail>(`/events/public/${slug}`)
    return response.data
  },

  /**
   * Create a new event
   */
  async createEvent(data: EventCreateRequest): Promise<Event> {
    const response = await apiClient.post<Event>('/events', data)
    return response.data
  },

  /**
   * Update event details
   */
  async updateEvent(eventId: string, data: EventUpdateRequest): Promise<Event> {
    const response = await apiClient.patch<Event>(`/events/${eventId}`, data)
    return response.data
  },

  /**
   * Publish event (draft → active)
   */
  async publishEvent(eventId: string): Promise<Event> {
    const response = await apiClient.post<Event>(`/events/${eventId}/publish`)
    return response.data
  },

  /**
   * Close event (active → closed)
   */
  async closeEvent(eventId: string): Promise<Event> {
    const response = await apiClient.post<Event>(`/events/${eventId}/close`)
    return response.data
  },

  /**
   * Delete event (soft delete)
   */
  async deleteEvent(eventId: string): Promise<void> {
    await apiClient.delete(`/events/${eventId}`)
  },
}

// ============================================
// Event Media Management
// ============================================

export const mediaApi = {
  /**
   * Request pre-signed upload URL for media
   */
  async requestUploadUrl(
    eventId: string,
    data: MediaUploadRequest
  ): Promise<MediaUploadResponse> {
    const response = await apiClient.post<MediaUploadResponse>(
      `/events/${eventId}/media/upload-url`,
      data
    )
    return response.data
  },

  /**
   * Confirm media upload completion
   */
  async confirmUpload(eventId: string, data: MediaConfirmRequest): Promise<EventMedia> {
    const response = await apiClient.post<{ media: EventMedia }>(
      `/events/${eventId}/media/${data.media_id}/confirm`,
      data
    )
    return response.data.media
  },

  /**
   * Delete media file
   */
  async deleteMedia(eventId: string, mediaId: string): Promise<void> {
    await apiClient.delete(`/events/${eventId}/media/${mediaId}`)
  },

  /**
   * Upload file to Azure Blob Storage using pre-signed URL
   */
  async uploadFile(uploadUrl: string, file: File): Promise<void> {
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'x-ms-blob-type': 'BlockBlob',
      },
      body: file,
    })
  },
}

// ============================================
// Event Links Management
// ============================================

export const linkApi = {
  /**
   * Add link to event
   */
  async createLink(
    eventId: string,
    data: EventLinkCreateRequest
  ): Promise<EventLink> {
    const response = await apiClient.post<EventLink>(
      `/events/${eventId}/links`,
      data
    )
    return response.data
  },

  /**
   * Update event link
   */
  async updateLink(
    eventId: string,
    linkId: string,
    data: EventLinkUpdateRequest
  ): Promise<EventLink> {
    const response = await apiClient.patch<EventLink>(
      `/events/${eventId}/links/${linkId}`,
      data
    )
    return response.data
  },

  /**
   * Delete event link
   */
  async deleteLink(eventId: string, linkId: string): Promise<void> {
    await apiClient.delete(`/events/${eventId}/links/${linkId}`)
  },
}

// ============================================
// Food Options Management
// ============================================

export const foodOptionApi = {
  /**
   * Add food option to event
   */
  async createFoodOption(
    eventId: string,
    data: FoodOptionCreateRequest
  ): Promise<FoodOption> {
    const response = await apiClient.post<FoodOption>(
      `/events/${eventId}/food-options`,
      data
    )
    return response.data
  },

  /**
   * Update food option
   */
  async updateFoodOption(
    eventId: string,
    optionId: string,
    data: FoodOptionUpdateRequest
  ): Promise<FoodOption> {
    const response = await apiClient.patch<FoodOption>(
      `/events/${eventId}/food-options/${optionId}`,
      data
    )
    return response.data
  },

  /**
   * Delete food option
   */
  async deleteFoodOption(eventId: string, optionId: string): Promise<void> {
    await apiClient.delete(`/events/${eventId}/food-options/${optionId}`)
  },
}

// ============================================
// NPO Branding (for event defaults)
// ============================================

export interface NPOBranding {
  id: string
  npo_id: string
  primary_color: string | null
  secondary_color: string | null
  background_color: string | null
  accent_color: string | null
  logo_url: string | null
  social_media_links: Record<string, string> | null
  custom_css_properties: Record<string, string> | null
  created_at: string
  updated_at: string
}

export interface NPODetail {
  id: string
  name: string
  branding?: NPOBranding
}

export const npoApi = {
  /**
   * Get NPO details including branding
   */
  async getNPOById(npoId: string): Promise<NPODetail> {
    const response = await apiClient.get<NPODetail>(`/npos/${npoId}`)
    return response.data
  },
}

// Default export combining all APIs
export default {
  ...eventApi,
  media: mediaApi,
  links: linkApi,
  npo: npoApi,
  foodOptions: foodOptionApi,
}
