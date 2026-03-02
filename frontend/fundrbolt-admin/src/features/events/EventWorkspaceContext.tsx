/* eslint-disable react-refresh/only-export-components */
import { createContext } from 'react'
import type { NPOBranding } from '../../services/event-service'
import type { AuctionItem } from '../../types/auction-item'
import type {
  EventDetail,
  EventLinkCreateRequest,
  EventUpdateRequest,
  FoodOptionCreateRequest,
} from '../../types/event'

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

export const EventWorkspaceContext = createContext<EventWorkspaceContextValue | null>(null)

export function EventWorkspaceProvider({
  value,
  children,
}: {
  value: EventWorkspaceContextValue
  children: React.ReactNode
}) {
  return <EventWorkspaceContext.Provider value={value}>{children}</EventWorkspaceContext.Provider>
}
