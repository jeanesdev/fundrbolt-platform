/**
 * SearchService
 * Client-side service for cross-resource search with role-based filtering
 *
 * T071: API call logic for search
 */

import apiClient from '@/lib/axios'
import type { NPOContextOption } from '@/stores/npo-context-store'

// Search request
export interface SearchRequest {
  query: string
  resource_types?: ('users' | 'npos' | 'events')[]
  npo_id?: string | null
  limit?: number
}

// Search result types
export interface UserSearchResult {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  npo_id: string | null
  organization_name: string | null
  created_at: string
}

export interface NPOSearchResult {
  id: string
  name: string
  ein: string | null
  status: string
  tagline: string | null
  logo_url: string | null
  created_at: string
}

export interface EventSearchResult {
  id: string
  name: string
  npo_id: string
  npo_name: string
  event_type: string
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

// Search response
export interface SearchResponse {
  query: string
  users: UserSearchResult[]
  npos: NPOSearchResult[]
  events: EventSearchResult[]
  total_results: number
}

/**
 * Search across Users, NPOs, and Events
 * @param request Search request parameters
 * @returns Search results grouped by resource type
 */
export async function search(request: SearchRequest): Promise<SearchResponse> {
  const response = await apiClient.post<SearchResponse>('/api/v1/search', request)
  return response.data
}

/**
 * Hook-friendly search function
 */
export const searchService = {
  search,
}

export default searchService
