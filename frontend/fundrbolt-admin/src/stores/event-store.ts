/**
 * Event Zustand Store
 * Manages event state, media, links, and food options
 */

import eventService, { type NPOBranding } from '@/services/event-service'
import type {
  Event,
  EventCreateRequest,
  EventDetail,
  EventLink,
  EventLinkCreateRequest,
  EventLinkUpdateRequest,
  EventListParams,
  EventUpdateRequest,
  FoodOption,
  FoodOptionCreateRequest,
  FoodOptionUpdateRequest,
  MediaUploadRequest,
} from '@/types/event'
import { create } from 'zustand'

// Helper function to extract error message from unknown error
function getErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'detail' in error.response.data
  ) {
    const detail = error.response.data.detail
    if (typeof detail === 'string') return detail
    if (
      typeof detail === 'object' &&
      detail !== null &&
      'message' in detail &&
      typeof detail.message === 'string'
    )
      return detail.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred'
}

interface EventState {
  // Current event context
  currentEvent: EventDetail | null
  currentEventId: string | null

  // NPO branding for event defaults
  npoBranding: NPOBranding | null
  npoBrandingLoading: boolean

  // Event lists
  events: Event[]
  eventsTotalCount: number
  eventsLoading: boolean
  eventsError: string | null

  // Upload state
  uploadProgress: Record<string, number>
  uploadingFiles: Record<string, boolean>

  // Actions - NPO Branding
  loadNPOBranding: (npoId: string) => Promise<void>

  // Actions - Event Management
  setCurrentEvent: (event: EventDetail | null) => void
  loadEvents: (params?: EventListParams) => Promise<void>
  loadEventById: (eventId: string) => Promise<void>
  loadEventBySlug: (slug: string) => Promise<void>
  createEvent: (data: EventCreateRequest) => Promise<Event>
  updateEvent: (eventId: string, data: EventUpdateRequest) => Promise<Event>
  publishEvent: (eventId: string) => Promise<Event>
  closeEvent: (eventId: string) => Promise<Event>
  deleteEvent: (eventId: string) => Promise<void>

  // Actions - Media Management
  uploadMedia: (eventId: string, file: File) => Promise<void>
  deleteMedia: (eventId: string, mediaId: string) => Promise<void>
  setUploadProgress: (fileId: string, progress: number) => void

  // Actions - Link Management
  createLink: (eventId: string, data: EventLinkCreateRequest) => Promise<EventLink>
  updateLink: (
    eventId: string,
    linkId: string,
    data: EventLinkUpdateRequest
  ) => Promise<EventLink>
  deleteLink: (eventId: string, linkId: string) => Promise<void>

  // Actions - Food Options Management
  createFoodOption: (
    eventId: string,
    data: FoodOptionCreateRequest
  ) => Promise<FoodOption>
  updateFoodOption: (
    eventId: string,
    optionId: string,
    data: FoodOptionUpdateRequest
  ) => Promise<FoodOption>
  deleteFoodOption: (eventId: string, optionId: string) => Promise<void>

  // Selectors
  getEventById: (eventId: string) => Event | undefined
  getPublishedEvents: () => Event[]
  getDraftEvents: () => Event[]
  getActiveEvents: () => Event[]
}

export const useEventStore = create<EventState>((set, get) => ({
  // Initial state
  currentEvent: null,
  currentEventId: null,
  npoBranding: null,
  npoBrandingLoading: false,
  events: [],
  eventsTotalCount: 0,
  eventsLoading: false,
  eventsError: null,
  uploadProgress: {},
  uploadingFiles: {},

  // NPO Branding Actions
  loadNPOBranding: async (npoId) => {
    set({ npoBrandingLoading: true })
    try {
      const npoDetail = await eventService.npo.getNPOById(npoId)
      set({
        npoBranding: npoDetail.branding ?? null,
        npoBrandingLoading: false,
      })
    } catch (_error) {
      // Silent failure - branding is optional
      set({ npoBrandingLoading: false })
    }
  },

  // Event Management Actions
  setCurrentEvent: (event) => {
    set({ currentEvent: event, currentEventId: event?.id ?? null })
  },

  loadEvents: async (params) => {
    set({ eventsLoading: true, eventsError: null })
    try {
      const response = await eventService.listEvents(params)
      set({
        events: response.items,
        eventsTotalCount: response.total,
        eventsLoading: false,
      })
    } catch (error) {
      set({
        eventsError: getErrorMessage(error),
        eventsLoading: false,
      })
      throw error
    }
  },

  loadEventById: async (eventId) => {
    set({ eventsLoading: true, eventsError: null })
    try {
      const event = await eventService.getEvent(eventId)
      set({
        currentEvent: event,
        currentEventId: eventId,
        eventsLoading: false,
      })
    } catch (error) {
      set({
        eventsError: getErrorMessage(error),
        eventsLoading: false,
      })
      throw error
    }
  },

  loadEventBySlug: async (slug) => {
    set({ eventsLoading: true, eventsError: null })
    try {
      const event = await eventService.getEventBySlug(slug)
      set({
        currentEvent: event,
        currentEventId: event.id,
        eventsLoading: false,
      })
    } catch (error) {
      set({
        eventsError: getErrorMessage(error),
        eventsLoading: false,
      })
      throw error
    }
  },

  createEvent: async (data) => {
    set({ eventsLoading: true, eventsError: null })
    try {
      const event = await eventService.createEvent(data)
      set((state) => ({
        events: [event, ...state.events],
        eventsTotalCount: state.eventsTotalCount + 1,
        eventsLoading: false,
      }))
      return event
    } catch (error) {
      set({
        eventsError: getErrorMessage(error),
        eventsLoading: false,
      })
      throw error
    }
  },

  updateEvent: async (eventId, data) => {
    set({ eventsLoading: true, eventsError: null })
    try {
      const event = await eventService.updateEvent(eventId, data)
      set((state) => ({
        events: state.events.map((e) => (e.id === eventId ? event : e)),
        currentEvent:
          state.currentEventId === eventId
            ? { ...state.currentEvent!, ...event }
            : state.currentEvent,
        eventsLoading: false,
      }))
      return event
    } catch (error) {
      set({
        eventsError: getErrorMessage(error),
        eventsLoading: false,
      })
      throw error
    }
  },

  publishEvent: async (eventId) => {
    set({ eventsLoading: true, eventsError: null })
    try {
      const event = await eventService.publishEvent(eventId)
      set((state) => ({
        events: state.events.map((e) => (e.id === eventId ? event : e)),
        currentEvent:
          state.currentEventId === eventId
            ? { ...state.currentEvent!, ...event }
            : state.currentEvent,
        eventsLoading: false,
      }))
      return event
    } catch (error) {
      set({
        eventsError: getErrorMessage(error),
        eventsLoading: false,
      })
      throw error
    }
  },

  closeEvent: async (eventId) => {
    set({ eventsLoading: true, eventsError: null })
    try {
      const event = await eventService.closeEvent(eventId)
      set((state) => ({
        events: state.events.map((e) => (e.id === eventId ? event : e)),
        currentEvent:
          state.currentEventId === eventId
            ? { ...state.currentEvent!, ...event }
            : state.currentEvent,
        eventsLoading: false,
      }))
      return event
    } catch (error) {
      set({
        eventsError: getErrorMessage(error),
        eventsLoading: false,
      })
      throw error
    }
  },

  deleteEvent: async (eventId) => {
    set({ eventsLoading: true, eventsError: null })
    try {
      await eventService.deleteEvent(eventId)
      set((state) => ({
        events: state.events.filter((e) => e.id !== eventId),
        eventsTotalCount: state.eventsTotalCount - 1,
        currentEvent: state.currentEventId === eventId ? null : state.currentEvent,
        currentEventId: state.currentEventId === eventId ? null : state.currentEventId,
        eventsLoading: false,
      }))
    } catch (error) {
      set({
        eventsError: getErrorMessage(error),
        eventsLoading: false,
      })
      throw error
    }
  },

  // Media Management Actions
  uploadMedia: async (eventId, file) => {
    const fileId = `${file.name}-${Date.now()}`
    set((state) => ({
      uploadingFiles: { ...state.uploadingFiles, [fileId]: true },
      uploadProgress: { ...state.uploadProgress, [fileId]: 0 },
    }))

    try {
      // Determine media type based on file type
      let media_type: 'image' | 'video' | 'flyer' = 'image'
      if (file.type.startsWith('video/')) {
        media_type = 'video'
      } else if (file.type === 'application/pdf') {
        media_type = 'flyer'
      }

      // Step 1: Request upload URL
      const uploadData: MediaUploadRequest = {
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        media_type,
      }
      const { upload_url, media_id } = await eventService.media.requestUploadUrl(
        eventId,
        uploadData
      )

      // Step 2: Upload file to Azure Blob Storage
      set((state) => ({
        uploadProgress: { ...state.uploadProgress, [fileId]: 50 },
      }))
      await eventService.media.uploadFile(upload_url, file)

      // Step 3: Confirm upload
      set((state) => ({
        uploadProgress: { ...state.uploadProgress, [fileId]: 90 },
      }))
      const media = await eventService.media.confirmUpload(eventId, { media_id })

      // Step 4: Update current event with new media
      set((state) => ({
        currentEvent: state.currentEvent
          ? {
            ...state.currentEvent,
            media: [...(state.currentEvent.media || []).filter(Boolean), media],
          }
          : null,
        uploadProgress: { ...state.uploadProgress, [fileId]: 100 },
        uploadingFiles: { ...state.uploadingFiles, [fileId]: false },
      }))
    } catch (error) {
      set((state) => ({
        uploadingFiles: { ...state.uploadingFiles, [fileId]: false },
        eventsError: getErrorMessage(error),
      }))
      throw error
    }
  },

  deleteMedia: async (eventId, mediaId) => {
    try {
      await eventService.media.deleteMedia(eventId, mediaId)
      set((state) => ({
        currentEvent: state.currentEvent
          ? {
            ...state.currentEvent,
            media: state.currentEvent.media?.filter((m) => m.id !== mediaId),
          }
          : null,
      }))
    } catch (error) {
      set({ eventsError: getErrorMessage(error) })
      throw error
    }
  },

  setUploadProgress: (fileId, progress) => {
    set((state) => ({
      uploadProgress: { ...state.uploadProgress, [fileId]: progress },
    }))
  },

  // Link Management Actions
  createLink: async (eventId, data) => {
    try {
      const link = await eventService.links.createLink(eventId, data)
      set((state) => ({
        currentEvent: state.currentEvent
          ? {
            ...state.currentEvent,
            links: [...(state.currentEvent.links || []), link],
          }
          : null,
      }))
      return link
    } catch (error) {
      set({ eventsError: getErrorMessage(error) })
      throw error
    }
  },

  updateLink: async (eventId, linkId, data) => {
    try {
      const link = await eventService.links.updateLink(eventId, linkId, data)
      set((state) => ({
        currentEvent: state.currentEvent
          ? {
            ...state.currentEvent,
            links: state.currentEvent.links?.map((l) => (l.id === linkId ? link : l)),
          }
          : null,
      }))
      return link
    } catch (error) {
      set({ eventsError: getErrorMessage(error) })
      throw error
    }
  },

  deleteLink: async (eventId, linkId) => {
    try {
      await eventService.links.deleteLink(eventId, linkId)
      set((state) => ({
        currentEvent: state.currentEvent
          ? {
            ...state.currentEvent,
            links: state.currentEvent.links?.filter((l) => l.id !== linkId),
          }
          : null,
      }))
    } catch (error) {
      set({ eventsError: getErrorMessage(error) })
      throw error
    }
  },

  // Food Options Management Actions
  createFoodOption: async (eventId, data) => {
    try {
      const foodOption = await eventService.foodOptions.createFoodOption(eventId, data)
      set((state) => ({
        currentEvent: state.currentEvent
          ? {
            ...state.currentEvent,
            food_options: [...(state.currentEvent.food_options || []), foodOption],
          }
          : null,
      }))
      return foodOption
    } catch (error) {
      set({ eventsError: getErrorMessage(error) })
      throw error
    }
  },

  updateFoodOption: async (eventId, optionId, data) => {
    try {
      const foodOption = await eventService.foodOptions.updateFoodOption(
        eventId,
        optionId,
        data
      )
      set((state) => ({
        currentEvent: state.currentEvent
          ? {
            ...state.currentEvent,
            food_options: state.currentEvent.food_options?.map((f) =>
              f.id === optionId ? foodOption : f
            ),
          }
          : null,
      }))
      return foodOption
    } catch (error) {
      set({ eventsError: getErrorMessage(error) })
      throw error
    }
  },

  deleteFoodOption: async (eventId, optionId) => {
    try {
      await eventService.foodOptions.deleteFoodOption(eventId, optionId)
      set((state) => ({
        currentEvent: state.currentEvent
          ? {
            ...state.currentEvent,
            food_options: state.currentEvent.food_options?.filter(
              (f) => f.id !== optionId
            ),
          }
          : null,
      }))
    } catch (error) {
      set({ eventsError: getErrorMessage(error) })
      throw error
    }
  },

  // Selectors
  getEventById: (eventId) => {
    return get().events.find((e) => e.id === eventId)
  },

  getPublishedEvents: () => {
    return get().events.filter((e) => e.status === 'active' || e.status === 'closed')
  },

  getDraftEvents: () => {
    return get().events.filter((e) => e.status === 'draft')
  },

  getActiveEvents: () => {
    return get().events.filter((e) => e.status === 'active')
  },
}))

export default useEventStore
