import type {
  ApplyTemplateRequest,
  ApplyTemplateResponse,
  RosNotification,
  RosNotificationCreate,
  RunOfShowItem,
  RunOfShowItemCreate,
  RunOfShowItemUpdate,
  RunOfShowReorderRequest,
  RunOfShowResponse,
  RunOfShowTemplate,
  SaveAsTemplateRequest,
} from '@/types/run-of-show'
import apiClient from '@/lib/axios'

const BASE = (eventId: string) => `/admin/events/${eventId}/run-of-show`
const AUCTIONEER_BASE = (eventId: string) =>
  `/auctioneer/events/${eventId}/run-of-show`

export const getRunOfShow = async (
  eventId: string
): Promise<RunOfShowResponse> => {
  const { data } = await apiClient.get<RunOfShowResponse>(BASE(eventId))
  return data
}

export const createRosItem = async (
  eventId: string,
  payload: RunOfShowItemCreate
): Promise<RunOfShowItem> => {
  const { data } = await apiClient.post<RunOfShowItem>(BASE(eventId), payload)
  return data
}

export const updateRosItem = async (
  eventId: string,
  itemId: string,
  payload: RunOfShowItemUpdate
): Promise<RunOfShowItem> => {
  const { data } = await apiClient.patch<RunOfShowItem>(
    `${BASE(eventId)}/${itemId}`,
    payload
  )
  return data
}

export const deleteRosItem = async (
  eventId: string,
  itemId: string
): Promise<void> => {
  await apiClient.delete(`${BASE(eventId)}/${itemId}`)
}

export const reorderRosItems = async (
  eventId: string,
  payload: RunOfShowReorderRequest
): Promise<RunOfShowResponse> => {
  const { data } = await apiClient.patch<RunOfShowResponse>(
    `${BASE(eventId)}/reorder`,
    payload
  )
  return data
}

export const markRosItemComplete = async (
  eventId: string,
  itemId: string
): Promise<RunOfShowItem> => {
  const { data } = await apiClient.post<RunOfShowItem>(
    `${BASE(eventId)}/${itemId}/complete`
  )
  return data
}

export const markRosItemIncomplete = async (
  eventId: string,
  itemId: string
): Promise<RunOfShowItem> => {
  const { data } = await apiClient.post<RunOfShowItem>(
    `${BASE(eventId)}/${itemId}/incomplete`
  )
  return data
}

export const listRosTemplates = async (
  npoId: string
): Promise<RunOfShowTemplate[]> => {
  const { data } = await apiClient.get<RunOfShowTemplate[]>(
    `/admin/npos/${npoId}/run-of-show-templates`
  )
  return data
}

export const saveAsRosTemplate = async (
  eventId: string,
  payload: SaveAsTemplateRequest
): Promise<RunOfShowTemplate> => {
  const { data } = await apiClient.post<RunOfShowTemplate>(
    `${BASE(eventId)}/save-as-template`,
    payload
  )
  return data
}

export const applyRosTemplate = async (
  eventId: string,
  payload: ApplyTemplateRequest
): Promise<ApplyTemplateResponse> => {
  const { data } = await apiClient.post<ApplyTemplateResponse>(
    `${BASE(eventId)}/apply-template`,
    payload
  )
  return data
}

export const listRosNotifications = async (
  eventId: string,
  itemId: string
): Promise<RosNotification[]> => {
  const { data } = await apiClient.get<RosNotification[]>(
    `${BASE(eventId)}/${itemId}/notifications`
  )
  return data
}

export const createRosNotification = async (
  eventId: string,
  itemId: string,
  payload: RosNotificationCreate
): Promise<RosNotification> => {
  const { data } = await apiClient.post<RosNotification>(
    `${BASE(eventId)}/${itemId}/notifications`,
    payload
  )
  return data
}

export const deleteRosNotification = async (
  eventId: string,
  itemId: string,
  notificationId: string
): Promise<void> => {
  await apiClient.delete(
    `${BASE(eventId)}/${itemId}/notifications/${notificationId}`
  )
}

// Auctioneer-facing endpoints

export const getAuctioneerRunOfShow = async (
  eventId: string
): Promise<RunOfShowResponse> => {
  const { data } = await apiClient.get<RunOfShowResponse>(
    AUCTIONEER_BASE(eventId)
  )
  return data
}

export const auctioneerMarkComplete = async (
  eventId: string,
  itemId: string
): Promise<RunOfShowItem> => {
  const { data } = await apiClient.post<RunOfShowItem>(
    `${AUCTIONEER_BASE(eventId)}/complete/${itemId}`
  )
  return data
}

export const auctioneerMarkIncomplete = async (
  eventId: string,
  itemId: string
): Promise<RunOfShowItem> => {
  const { data } = await apiClient.post<RunOfShowItem>(
    `${AUCTIONEER_BASE(eventId)}/incomplete/${itemId}`
  )
  return data
}
