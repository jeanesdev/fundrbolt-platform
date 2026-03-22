import apiClient from '@/lib/axios'
import type { AxiosResponse } from 'axios'

export interface PublicNPOResponse {
  id: string
  name: string
  tagline: string | null
  description: string | null
  mission_statement: string | null
  website_url: string | null
  phone: string | null
  email: string
  address: {
    street?: string
    street2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  } | null
  logo_url: string | null
}

export interface PublicNPOListResponse {
  items: PublicNPOResponse[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export async function listPublicNPOs(params?: {
  page?: number
  page_size?: number
  search?: string
}): Promise<PublicNPOListResponse> {
  const response: AxiosResponse<PublicNPOListResponse> = await apiClient.get(
    '/npos/public',
    { params }
  )
  return response.data
}
