/**
 * Event Dashboard API Client
 * 
 * Provides API client methods for event dashboard endpoints
 */

import { apiClient } from '@/lib/api-client'
import type {
  DashboardSummary,
  SegmentBreakdownResponse,
  ProjectionAdjustmentSet,
  ProjectionAdjustmentUpdate,
  SegmentType,
  ScenarioType,
} from '@/types/event-dashboard'

export interface GetDashboardParams {
  eventId: string
  startDate?: string
  endDate?: string
  sources?: string[]
  scenario?: ScenarioType
}

export interface GetSegmentsParams {
  eventId: string
  segmentType: SegmentType
  startDate?: string
  endDate?: string
  limit?: number
  sort?: 'total_amount' | 'contribution_share'
}

export interface GetProjectionsParams {
  eventId: string
  scenario?: ScenarioType
}

export interface UpdateProjectionsParams {
  eventId: string
  update: ProjectionAdjustmentUpdate
}

/**
 * Get event dashboard summary with all metrics
 */
export async function getDashboardSummary(params: GetDashboardParams): Promise<DashboardSummary> {
  const queryParams = new URLSearchParams()
  
  if (params.startDate) queryParams.append('start_date', params.startDate)
  if (params.endDate) queryParams.append('end_date', params.endDate)
  if (params.sources && params.sources.length > 0) {
    queryParams.append('sources', params.sources.join(','))
  }
  if (params.scenario) queryParams.append('scenario', params.scenario)

  const response = await apiClient.get(
    `/admin/events/${params.eventId}/dashboard?${queryParams.toString()}`
  )
  
  return response.data
}

/**
 * Get segment breakdown by type
 */
export async function getSegmentBreakdown(params: GetSegmentsParams): Promise<SegmentBreakdownResponse> {
  const queryParams = new URLSearchParams()
  
  queryParams.append('segment_type', params.segmentType)
  if (params.startDate) queryParams.append('start_date', params.startDate)
  if (params.endDate) queryParams.append('end_date', params.endDate)
  if (params.limit) queryParams.append('limit', params.limit.toString())
  if (params.sort) queryParams.append('sort', params.sort)

  const response = await apiClient.get(
    `/admin/events/${params.eventId}/dashboard/segments?${queryParams.toString()}`
  )
  
  return response.data
}

/**
 * Get projection adjustments for an event
 */
export async function getProjectionAdjustments(params: GetProjectionsParams): Promise<ProjectionAdjustmentSet> {
  const queryParams = new URLSearchParams()
  
  if (params.scenario) queryParams.append('scenario', params.scenario)

  const response = await apiClient.get(
    `/admin/events/${params.eventId}/dashboard/projections?${queryParams.toString()}`
  )
  
  return response.data
}

/**
 * Update projection adjustments for an event
 */
export async function updateProjectionAdjustments(params: UpdateProjectionsParams): Promise<ProjectionAdjustmentSet> {
  const response = await apiClient.post(
    `/admin/events/${params.eventId}/dashboard/projections`,
    params.update
  )
  
  return response.data
}
