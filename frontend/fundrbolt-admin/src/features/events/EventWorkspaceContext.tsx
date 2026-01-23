import { createContext, useContext } from 'react'
import type { EventDetail, EventLinkCreateRequest, EventUpdateRequest, FoodOptionCreateRequest } from '@/types/event'
import type { NPOBranding } from '@/services/event-service'
import type { AuctionItem } from '@/types/auction-item'

export interface EventWorkspaceContextValue {
  eventId: string
  currentEvent: EventDetail
  npoBranding: NPOBranding | null
  isSubmitting: boolean
  uploadProgress: Record<string, number>
  uploadingFiles: Record<string, boolean>
  auctionItems: AuctionItem[]
  sponsorsCount: number
  handleSubmit: (data: EventUpdateRequest) => Promise<void>
  handleCancel: () => void
  handleDelete: () => Promise<void>
  handleMediaUpload: (file: File) => Promise<void>
  handleMediaDelete: (mediaId: string) => Promise<void>
  handleLinkCreate: (data: EventLinkCreateRequest) => Promise<void>
  handleLinkDelete: (linkId: string) => Promise<void>
  handleFoodOptionCreate: (data: FoodOptionCreateRequest) => Promise<void>
  handleFoodOptionDelete: (optionId: string) => Promise<void>
  updateEvent: (eventId: string, data: EventUpdateRequest) => Promise<unknown>
  loadEventById: (eventId: string) => Promise<void>
  fetchAuctionItems: (eventId: string) => Promise<void>
}

const EventWorkspaceContext = createContext<EventWorkspaceContextValue | null>(null)

export function EventWorkspaceProvider({
  value,
  children,
}: {
  value: EventWorkspaceContextValue
  children: React.ReactNode
}) {
  return <EventWorkspaceContext.Provider value={value}>{children}</EventWorkspaceContext.Provider>
}

export function useEventWorkspace() {
  const context = useContext(EventWorkspaceContext)
  if (!context) {
    throw new Error('useEventWorkspace must be used within an EventWorkspaceProvider')
  }
  return context
}
