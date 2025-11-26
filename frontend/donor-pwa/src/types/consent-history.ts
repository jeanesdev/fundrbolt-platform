/**
 * TypeScript types for consent history and data rights
 * Matches backend schemas in backend/app/schemas/consent.py
 */

/**
 * Single consent record from history
 */
export interface ConsentRecord {
  id: string
  user_id: string
  tos_document_id: string
  privacy_document_id: string
  status: 'active' | 'withdrawn' | 'superseded'
  ip_address: string
  user_agent: string | null
  withdrawn_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Paginated consent history response
 */
export interface ConsentHistoryResponse {
  consents: ConsentRecord[]
  total: number
  page: number
  per_page: number
}

/**
 * Request to export user data (GDPR)
 */
export interface DataExportRequest {
  email?: string // Optional email override
}

/**
 * Request to delete user data (GDPR)
 */
export interface DataDeletionRequest {
  confirmation: boolean // Must be true
}

/**
 * Generic message response
 */
export interface MessageResponse {
  message: string
}
