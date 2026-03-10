/**
 * PreviewContext — Provides a flag to indicate preview mode throughout the component tree.
 *
 * In preview mode:
 * - Bidding and registration actions are disabled
 * - Seating shows a placeholder instead of querying user-specific data
 */
import type { Sponsor } from '@/lib/api/sponsors'
import type { AuctionItemDetail } from '@/types/auction-item'
import type { EventDetail } from '@/types/event'
import { createContext, useContext } from 'react'

export interface PreviewEventData {
  event: EventDetail
  auctionItems: AuctionItemDetail[]
  sponsors: Sponsor[]
}

export interface PreviewContextValue {
  /** Whether the app is currently rendering a preview */
  isPreviewMode: boolean
  /** Seeded preview data used to avoid authenticated donor-only fetches */
  previewData: PreviewEventData | null
}

const PreviewContext = createContext<PreviewContextValue>({
  isPreviewMode: false,
  previewData: null,
})

export const PreviewProvider = PreviewContext.Provider
export const usePreviewMode = () => useContext(PreviewContext)
