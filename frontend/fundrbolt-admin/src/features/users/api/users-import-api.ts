import apiClient from '@/lib/axios'

export type IssueSeverity = 'error' | 'warning'
export type ImportRowStatus =
  | 'created'
  | 'skipped'
  | 'membership_added'
  | 'error'

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
  file_checksum?: string | null
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
  email?: string | null
  full_name?: string | null
  status: ImportRowStatus
  message: string
}

export interface ImportResult {
  batch_id: string
  created_rows: number
  skipped_rows: number
  membership_added_rows: number
  failed_rows: number
  rows: ImportRowResult[]
  warnings: PreflightIssue[]
}

export interface ErrorReportRequest {
  format: 'csv' | 'json'
  rows: ImportRowResult[]
}

export interface ErrorReportResponse {
  format: 'csv' | 'json'
  content_type: string
  filename: string
  content: string
}

export async function preflightUserImport(
  npoId: string,
  file: File,
  signal?: AbortSignal
): Promise<PreflightResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<PreflightResult>(
    '/admin/users/import/preflight',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params: {
        npo_id: npoId,
      },
      signal,
    }
  )

  return response.data
}

export async function commitUserImport(
  npoId: string,
  preflightId: string,
  file: File,
  signal?: AbortSignal
): Promise<ImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('preflight_id', preflightId)
  formData.append('confirm', 'true')

  const response = await apiClient.post<ImportResult>(
    '/admin/users/import/commit',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params: {
        npo_id: npoId,
      },
      signal,
    }
  )

  return response.data
}

export async function buildUserImportErrorReport(
  request: ErrorReportRequest
): Promise<ErrorReportResponse> {
  const response = await apiClient.post<ErrorReportResponse>(
    '/admin/users/import/error-report',
    request
  )
  return response.data
}

export const USER_IMPORT_EXAMPLE_CSV =
  'full_name,email,role,npo_identifier,phone,title,password\n' +
  'Jordan Lee,jordan.lee@example.org,npo_admin,Hope Rising Foundation,555-123-4567,Development Director,\n'

export const USER_IMPORT_EXAMPLE_JSON = `[
  {
    "full_name": "Jordan Lee",
    "email": "jordan.lee@example.org",
    "role": "npo_admin",
    "npo_identifier": "Hope Rising Foundation",
    "phone": "555-123-4567",
    "title": "Development Director",
    "password": ""
  }
]`
