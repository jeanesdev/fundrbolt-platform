/**
 * Service for ticket sales import API calls
 */

import apiClient from '@/lib/axios'
import type { ImportResult, PreflightResult } from '@/types/ticketSalesImport'

export interface ImportConfirmRequest {
  preflight_id: string
  confirm: boolean
}

/**
 * Run preflight validation on a ticket sales import file
 */
export async function preflightTicketSalesImport(
  eventId: string,
  file: File,
  signal?: AbortSignal
): Promise<PreflightResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<PreflightResult>(
    `/admin/events/${eventId}/ticket-sales/import/preflight`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal,
    }
  )

  return response.data
}

/**
 * Commit ticket sales import after successful preflight
 */
export async function commitTicketSalesImport(
  eventId: string,
  preflightId: string,
  file: File,
  signal?: AbortSignal
): Promise<ImportResult> {
  const formData = new FormData()
  formData.append('file', file)

  // Send request with preflight_id and confirm in request body
  const response = await apiClient.post<ImportResult>(
    `/admin/events/${eventId}/ticket-sales/import`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params: {
        preflight_id: preflightId,
        confirm: true,
      },
      signal,
    }
  )

  return response.data
}

/**
 * Example CSV format for ticket sales import
 */
export const EXAMPLE_CSV = `event_id,ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id,promo_code,discount_amount,fee_amount,payment_status,notes
EVT-2026-001,VIP Table,Jordan Lee,jordan.lee@example.org,2,500.00,2026-02-01,EXT-100045,VIP20,100.00,15.00,Paid,Sponsor package
EVT-2026-001,General Admission,Alex Smith,alex.smith@example.com,1,50.00,2026-02-02,EXT-100046,,0.00,2.00,Paid,`

/**
 * Example JSON format for ticket sales import
 */
export const EXAMPLE_JSON = `[
  {
    "event_id": "EVT-2026-001",
    "ticket_type": "VIP Table",
    "purchaser_name": "Jordan Lee",
    "purchaser_email": "jordan.lee@example.org",
    "quantity": 2,
    "total_amount": 500.00,
    "purchase_date": "2026-02-01",
    "external_sale_id": "EXT-100045",
    "promo_code": "VIP20",
    "discount_amount": 100.00,
    "fee_amount": 15.00,
    "payment_status": "Paid",
    "notes": "Sponsor package"
  },
  {
    "event_id": "EVT-2026-001",
    "ticket_type": "General Admission",
    "purchaser_name": "Alex Smith",
    "purchaser_email": "alex.smith@example.com",
    "quantity": 1,
    "total_amount": 50.00,
    "purchase_date": "2026-02-02",
    "external_sale_id": "EXT-100046",
    "promo_code": "",
    "discount_amount": 0.00,
    "fee_amount": 2.00,
    "payment_status": "Paid"
  }
]`
