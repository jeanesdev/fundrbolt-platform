import apiClient from '@/lib/axios'

export type CardType = 'text' | 'slideshow' | 'video' | 'built_in'
export type MediaSource = 'upload' | 'external'
export type SlideVariant = 'image_only' | 'text_over_image' | 'text_only'
export type RevisionAction = 'draft_saved' | 'published' | 'reverted'
export type ColorToken =
  | 'slate-50'
  | 'slate-100'
  | 'slate-200'
  | 'white'
  | 'transparent'

export interface CausePageConfig {
  id: string
  event_id: string
  draft_version: number
  published_version: number
  last_published_at: string | null
  last_published_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface SlideItem {
  id: string
  card_id: string
  display_order: number
  slide_variant: SlideVariant
  media_url: string | null
  media_source: MediaSource | null
  alt_text: string | null
  overlay_html: string | null
  created_at: string
  updated_at: string
}

export interface CauseSectionCard {
  id: string
  event_id: string
  draft_version: number
  card_type: CardType
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
  slides: SlideItem[]
  created_at: string
  updated_at: string
}

export interface CreateCardRequest {
  draft_version: number
  card_type: Exclude<CardType, 'built_in'>
  is_enabled?: boolean
  title?: string | null
  show_header?: boolean
  is_collapsible?: boolean
  background_color_token?: ColorToken | null
  border_color_token?: ColorToken | null
  content_html?: string | null
  video_url?: string | null
  video_media_source?: MediaSource | null
  video_autoplay?: boolean | null
  video_muted_by_default?: boolean | null
}

export interface UpdateCardRequest {
  draft_version: number
  is_enabled?: boolean
  title?: string | null
  show_header?: boolean
  is_collapsible?: boolean
  background_color_token?: ColorToken | null
  border_color_token?: ColorToken | null
  content_html?: string | null
  video_url?: string | null
  video_media_source?: MediaSource | null
  video_autoplay?: boolean | null
  video_muted_by_default?: boolean | null
}

export interface ReorderRequest {
  draft_version: number
  card_ids: string[]
}

export interface CreateSlideRequest {
  draft_version: number
  slide_variant: SlideVariant
  media_url?: string | null
  media_source?: MediaSource | null
  alt_text?: string | null
  overlay_html?: string | null
}

export interface UpdateSlideRequest {
  draft_version: number
  slide_variant?: SlideVariant
  media_url?: string | null
  media_source?: MediaSource | null
  alt_text?: string | null
  overlay_html?: string | null
}

export interface SlideReorderRequest {
  draft_version: number
  slide_ids: string[]
}

export interface PublishRequest {
  draft_version: number
}

export interface CauseSectionRevision {
  id: string
  event_id: string
  changed_by_user_id: string
  action: RevisionAction
  draft_version: number
  changed_at: string
  change_summary: Record<string, unknown> | null
}

export interface ConflictResponse {
  code: string
  message: string
  current_draft_version: number
  requested_draft_version: number
  published_version: number
  latest_revision_action: RevisionAction | null
  latest_revision_changed_at: string | null
  latest_change_summary: Record<string, unknown> | null
}

export async function getCausePageConfig(
  eventId: string
): Promise<CausePageConfig> {
  const response = await apiClient.get<CausePageConfig>(
    `/admin/events/${eventId}/cause-page/config`
  )
  return response.data
}

export async function getCausePageCards(
  eventId: string
): Promise<CauseSectionCard[]> {
  const response = await apiClient.get<CauseSectionCard[]>(
    `/admin/events/${eventId}/cause-page/cards`
  )
  return response.data
}

export async function createCausePageCard(
  eventId: string,
  payload: CreateCardRequest
): Promise<CauseSectionCard> {
  const response = await apiClient.post<CauseSectionCard>(
    `/admin/events/${eventId}/cause-page/cards`,
    payload
  )
  return response.data
}

export async function updateCausePageCard(
  eventId: string,
  cardId: string,
  payload: UpdateCardRequest
): Promise<CauseSectionCard> {
  const response = await apiClient.patch<CauseSectionCard>(
    `/admin/events/${eventId}/cause-page/cards/${cardId}`,
    payload
  )
  return response.data
}

export async function deleteCausePageCard(
  eventId: string,
  cardId: string,
  payload: PublishRequest
): Promise<void> {
  await apiClient.delete(
    `/admin/events/${eventId}/cause-page/cards/${cardId}`,
    {
      data: payload,
    }
  )
}

export async function reorderCausePageCards(
  eventId: string,
  payload: ReorderRequest
): Promise<CauseSectionCard[]> {
  const response = await apiClient.patch<CauseSectionCard[]>(
    `/admin/events/${eventId}/cause-page/cards/reorder`,
    payload
  )
  return response.data
}

export async function publishCausePage(
  eventId: string,
  payload: PublishRequest
): Promise<CausePageConfig> {
  const response = await apiClient.post<CausePageConfig>(
    `/admin/events/${eventId}/cause-page/publish`,
    payload
  )
  return response.data
}

export async function getCausePageRevisions(
  eventId: string
): Promise<CauseSectionRevision[]> {
  const response = await apiClient.get<CauseSectionRevision[]>(
    `/admin/events/${eventId}/cause-page/revisions`
  )
  return response.data
}

export async function getCardSlides(
  eventId: string,
  cardId: string
): Promise<SlideItem[]> {
  const response = await apiClient.get<SlideItem[]>(
    `/admin/events/${eventId}/cause-page/cards/${cardId}/slides`
  )
  return response.data
}

export async function createCardSlide(
  eventId: string,
  cardId: string,
  payload: CreateSlideRequest
): Promise<SlideItem> {
  const response = await apiClient.post<SlideItem>(
    `/admin/events/${eventId}/cause-page/cards/${cardId}/slides`,
    payload
  )
  return response.data
}

export async function updateCardSlide(
  eventId: string,
  cardId: string,
  slideId: string,
  payload: UpdateSlideRequest
): Promise<SlideItem> {
  const response = await apiClient.patch<SlideItem>(
    `/admin/events/${eventId}/cause-page/cards/${cardId}/slides/${slideId}`,
    payload
  )
  return response.data
}

export async function deleteCardSlide(
  eventId: string,
  cardId: string,
  slideId: string,
  payload: PublishRequest
): Promise<void> {
  await apiClient.delete(
    `/admin/events/${eventId}/cause-page/cards/${cardId}/slides/${slideId}`,
    { data: payload }
  )
}

export async function reorderCardSlides(
  eventId: string,
  cardId: string,
  payload: SlideReorderRequest
): Promise<SlideItem[]> {
  const response = await apiClient.patch<SlideItem[]>(
    `/admin/events/${eventId}/cause-page/cards/${cardId}/slides/reorder`,
    payload
  )
  return response.data
}
