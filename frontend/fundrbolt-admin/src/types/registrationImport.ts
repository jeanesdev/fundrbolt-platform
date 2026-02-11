/**
 * Registration bulk import types
 */

export enum ImportRowStatus {
  CREATED = 'created',
  SKIPPED = 'skipped',
  ERROR = 'error',
}

export enum ValidationIssueSeverity {
  ERROR = 'error',
  WARNING = 'warning',
}

export interface ValidationIssue {
  row_number: number
  severity: ValidationIssueSeverity
  field_name?: string | null
  message: string
}

export interface ImportRowResult {
  row_number: number
  external_id?: string | null
  registrant_name?: string | null
  registrant_email?: string | null
  status: ImportRowStatus
  message: string
  issues: ValidationIssue[]
}

export interface RegistrationImportReport {
  total_rows: number
  valid_rows: number
  error_rows: number
  warning_rows: number
  created_count: number
  skipped_count: number
  failed_count: number
  rows: ImportRowResult[]
  error_report_url?: string | null
  file_type?: string | null
}

// Example file format structures for documentation
export interface RegistrationImportRowExample {
  event_id?: string
  registrant_name: string
  registrant_email: string
  registration_date: string  // YYYY-MM-DD
  quantity: number
  external_registration_id: string
  registrant_phone?: string
  notes?: string
  bidder_number?: number
  table_number?: number
  guest_count?: number
  guest_of_email?: string
  ticket_purchase_id?: string
  ticket_purchaser_email?: string
  ticket_purchase_date?: string
}
