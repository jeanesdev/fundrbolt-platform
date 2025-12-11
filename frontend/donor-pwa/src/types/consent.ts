/**
 * TypeScript types for consent management
 */

export type ConsentStatus = 'active' | 'withdrawn' | 'superseded'

export interface ConsentAcceptRequest {
  tos_document_id: string
  privacy_document_id: string
}

export interface ConsentResponse {
  id: string
  user_id: string
  tos_document_id: string
  privacy_document_id: string
  status: ConsentStatus
  accepted_at: string
  created_at: string
  updated_at: string
}

export interface ConsentStatusResponse {
  has_active_consent: boolean
  current_consent: ConsentResponse | null
  requires_update: boolean
  latest_documents: {
    terms_of_service: {
      id: string
      version: string
    }
    privacy_policy: {
      id: string
      version: string
    }
  }
}

export interface ConsentHistoryItem {
  id: string
  tos_document_id: string
  privacy_document_id: string
  status: ConsentStatus
  accepted_at: string
  superseded_at: string | null
}

export interface ConsentHistoryResponse {
  consents: ConsentHistoryItem[]
  total: number
  page: number
  page_size: number
}

export interface DataExportRequest {
  email?: string
}

export interface DataDeletionRequest {
  confirmation: boolean
}
