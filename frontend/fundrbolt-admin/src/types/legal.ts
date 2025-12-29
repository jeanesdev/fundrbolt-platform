/**
 * TypeScript types for legal documents
 */

export type LegalDocumentType = 'terms_of_service' | 'privacy_policy'

export type LegalDocumentStatus = 'draft' | 'published' | 'archived'

export interface LegalDocument {
  id: string
  document_type: LegalDocumentType
  version: string
  content: string
  status: LegalDocumentStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface LegalDocumentPublic {
  id: string
  document_type: LegalDocumentType
  version: string
  content: string
  published_at: string
}

export interface LegalDocumentCreate {
  document_type: LegalDocumentType
  version: string
  content: string
}

export interface LegalDocumentUpdate {
  version?: string
  content?: string
}
