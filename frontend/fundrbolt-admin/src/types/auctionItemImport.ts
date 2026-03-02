/**
 * Auction Item bulk import types
 */

export enum ImportRowStatus {
  CREATED = 'created',
  UPDATED = 'updated',
  SKIPPED = 'skipped',
  ERROR = 'error',
}

export enum ImportImageStatus {
  OK = 'ok',
  MISSING = 'missing',
  INVALID = 'invalid',
}

export interface ImportRowResult {
  row_number: number;
  external_id?: string | null;
  title?: string | null;
  status: ImportRowStatus;
  message: string;
  image_status?: ImportImageStatus | null;
  image_count?: number | null;
}

export interface ImportReport {
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  warnings_count?: number;
  rows: ImportRowResult[];
  error_report_url?: string | null;
}
