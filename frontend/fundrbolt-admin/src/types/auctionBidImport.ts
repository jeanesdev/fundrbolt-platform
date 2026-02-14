/**
 * Types for auction bid import feature
 */

export enum AuctionBidIssueSeverity {
  ERROR = 'error',
  WARNING = 'warning',
}

export interface AuctionBidImportIssue {
  row_number: number
  field_name?: string | null
  severity: AuctionBidIssueSeverity
  message: string
  raw_value?: string | null
}

export interface AuctionBidPreflightResult {
  import_batch_id: string
  detected_format: string
  total_rows: number
  valid_rows: number
  invalid_rows: number
  warning_rows: number
  row_errors: AuctionBidImportIssue[]
  row_warnings: AuctionBidImportIssue[]
  error_report_url?: string | null
}

export interface AuctionBidImportSummary {
  import_batch_id: string
  created_bids: number
  skipped_bids: number
  started_at: string
  completed_at: string
}

export interface AuctionBidDashboardHighestBid {
  auction_item_code: string
  bid_amount: number
  bidder_email: string
}

export interface AuctionBidDashboardRecentBid {
  auction_item_code: string
  bid_amount: number
  bidder_email: string
  bid_time: string
}

export interface AuctionBidDashboardResponse {
  total_bid_count: number
  total_bid_value: number
  highest_bids: AuctionBidDashboardHighestBid[]
  recent_bids: AuctionBidDashboardRecentBid[]
}

export interface AuctionBidImportConfirmRequest {
  import_batch_id: string
}
