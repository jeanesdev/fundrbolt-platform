/**
 * Report service — PDF download helpers for printable reports.
 */
import apiClient from '@/lib/axios'

export type LabelSize = '2x3' | '2x4' | '3x3' | '3x5'

export interface BidCardRequest {
  item_ids?: string[] | null
  label_size: LabelSize
  include_live?: boolean
  show_image?: boolean
  show_value?: boolean
  show_qr?: boolean
  show_starting_bid?: boolean
  show_min_bid_increment?: boolean
}

const LABEL_SIZE_OPTIONS: {
  value: LabelSize
  label: string
  description: string
}[] = [
    { value: '2x3', label: '2" × 3"', description: 'Small badge / shelf label' },
    {
      value: '2x4',
      label: '2" × 4"',
      description: 'Standard address label (Brady 3456)',
    },
    { value: '3x3', label: '3" × 3"', description: 'Square label' },
    {
      value: '3x5',
      label: '3" × 5"',
      description: 'Index card / large bid card (recommended)',
    },
  ]

export { LABEL_SIZE_OPTIONS }

function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

class ReportService {
  async downloadEventReport(eventId: string): Promise<void> {
    const response = await apiClient.get<Blob>(
      `/admin/events/${eventId}/reports/event-summary`,
      { responseType: 'blob' }
    )
    triggerDownload(response.data, `event-report-${eventId}.pdf`)
  }

  async downloadBidCards(
    eventId: string,
    request: BidCardRequest
  ): Promise<void> {
    const response = await apiClient.post<Blob>(
      `/admin/events/${eventId}/reports/bid-cards`,
      request,
      { responseType: 'blob' }
    )
    const sizeLabel = request.label_size.replace('x', '-by-')
    triggerDownload(response.data, `bid-cards-${sizeLabel}-${eventId}.pdf`)
  }

  async downloadAuctioneerReport(eventId: string): Promise<void> {
    const response = await apiClient.get<Blob>(
      `/admin/events/${eventId}/auctioneer/report`,
      { responseType: 'blob' }
    )
    triggerDownload(response.data, `auctioneer-report-${eventId}.pdf`)
  }

  /** Fetches the auctioneer report and returns the raw Blob without triggering a download. */
  async fetchAuctioneerReportBlob(eventId: string): Promise<Blob> {
    const response = await apiClient.get<Blob>(
      `/admin/events/${eventId}/auctioneer/report`,
      { responseType: 'blob' }
    )
    return response.data
  }
}

export const reportService = new ReportService()
export default reportService
