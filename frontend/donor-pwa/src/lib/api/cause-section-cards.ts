import apiClient from '@/lib/axios'

export type PublicCardType = 'text' | 'slideshow' | 'video' | 'built_in'
export type MediaSource = 'upload' | 'external'
export type SlideVariant = 'image_only' | 'text_over_image' | 'text_only'
export type ColorToken =
  | 'slate-50'
  | 'slate-100'
  | 'slate-200'
  | 'white'
  | 'transparent'

export interface PublicCauseSectionSlideItem {
  id: string
  card_id: string
  display_order: number
  slide_variant: SlideVariant
  media_url: string | null
  media_variants: Record<string, string> | null
  media_source: MediaSource | null
  slide_name: string | null
  alt_text: string | null
  overlay_html: string | null
  created_at: string
  updated_at: string
}

export interface PublicCauseSectionCard {
  id: string
  event_id: string
  card_type: PublicCardType
  built_in_section_key: 'about' | 'sponsors' | 'event_details' | null
  display_order: number
  is_enabled: boolean
  title: string | null
  show_header: boolean
  is_collapsible: boolean
  background_color_token: ColorToken | null
  border_color_token: ColorToken | null
  content_html: string | null
  video_url: string | null
  video_media_source: MediaSource | null
  video_autoplay: boolean | null
  video_muted_by_default: boolean | null
  slides: PublicCauseSectionSlideItem[]
}

export async function getPublishedCausePageCards(
  eventId: string
): Promise<PublicCauseSectionCard[]> {
  const response = await apiClient.get<PublicCauseSectionCard[]>(
    `/events/${eventId}/cause-page/cards`
  )
  return response.data
}
