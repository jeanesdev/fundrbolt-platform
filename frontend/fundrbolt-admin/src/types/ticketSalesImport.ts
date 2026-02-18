/**
 * Types for ticket sales import feature
 */

export enum ImportRowStatus {
  CREATED = 'created',
  SKIPPED = 'skipped',
  ERROR = 'error',
}

export enum IssueSeverity {
  ERROR = 'error',
  WARNING = 'warning',
}

export interface PreflightIssue {
  row_number: number
  field_name?: string | null
  severity: IssueSeverity
  message: string
  raw_value?: string | null
}

export interface PreflightResult {
  preflight_id: string
  detected_format: string
  total_rows: number
  valid_rows: number
  error_rows: number
  warning_rows: number
  issues: PreflightIssue[]
  warnings: PreflightIssue[]
  error_report_url?: string | null
}

export interface ImportRowResult {
  row_number: number
  external_sale_id?: string | null
  purchaser_name?: string | null
  status: ImportRowStatus
  message: string
}

export interface ImportResult {
  batch_id: string
  created_rows: number
  skipped_rows: number
  failed_rows: number
  warnings: PreflightIssue[]
}

export interface TicketSaleImportRow {
  ticket_type: string
  purchaser_name: string
  purchaser_email: string
  quantity: number
  total_amount: number
  purchase_date: string
  external_sale_id: string
  purchaser_phone?: string | null
  fee_amount?: number | null
  payment_status?: string | null
  notes?: string | null
}
