/**
 * Report service — PDF download helpers for printable reports.
 */
import apiClient from '@/lib/axios'

export type LabelSize =
  | '2x3'
  | '2x4'
  | '3x3'
  | '3x5'
  | 'tent-8.5x11'
  | 'tent-8.5x11-long'
  | 'tent-8.5x11-2up'

export interface BidCardRequest {
  item_ids?: string[] | null
  label_size: LabelSize
  include_live?: boolean
  show_image?: boolean
  show_value?: boolean
  show_qr?: boolean
  show_starting_bid?: boolean
  show_min_bid_increment?: boolean
  show_event_logo?: boolean
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
      description: 'Index card / large auction item display card (recommended)',
    },
    {
      value: 'tent-8.5x11',
      label: 'Tent — short fold (landscape)',
      description: 'Folds on the short side · 11"×4.25" faces (1 per sheet)',
    },
    {
      value: 'tent-8.5x11-long',
      label: 'Tent — long fold (portrait)',
      description: 'Folds on the long side · 8.5"×5.5" faces (1 per sheet)',
    },
    {
      value: 'tent-8.5x11-2up',
      label: 'Tent 2-up (landscape)',
      description: 'Two tent cards per sheet — cut along dashed line',
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

  async generateBidCardsBlob(
    eventId: string,
    request: BidCardRequest
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await apiClient.post<Blob>(
      `/admin/events/${eventId}/reports/bid-cards`,
      request,
      { responseType: 'blob', timeout: 300_000 } // 5-minute timeout — image fetch + WeasyPrint
    )
    const sizeLabel = request.label_size.replace('x', '-by-')
    return {
      blob: response.data,
      filename: `auction-item-display-cards-${sizeLabel}-${eventId}.pdf`,
    }
  }

  async downloadBidCards(
    eventId: string,
    request: BidCardRequest
  ): Promise<void> {
    const { blob, filename } = await this.generateBidCardsBlob(eventId, request)
    triggerDownload(blob, filename)
  }

  async downloadAuctioneerReport(eventId: string): Promise<void> {
    const response = await apiClient.get<Blob>(
      `/admin/events/${eventId}/auctioneer/report`,
      { responseType: 'blob', timeout: 300_000 } // PDF generation can exceed default 30s timeout
    )
    triggerDownload(response.data, `auctioneer-report-${eventId}.pdf`)
  }

  /** Fetches the auctioneer report and returns the raw Blob without triggering a download. */
  async fetchAuctioneerReportBlob(eventId: string): Promise<Blob> {
    const response = await apiClient.get<Blob>(
      `/admin/events/${eventId}/auctioneer/report`,
      { responseType: 'blob', timeout: 300_000 } // PDF generation can exceed default 30s timeout
    )
    return response.data
  }

  /** Fetches the event summary report and returns the raw Blob without triggering a download. */
  async fetchEventReportBlob(eventId: string): Promise<Blob> {
    const response = await apiClient.get<Blob>(
      `/admin/events/${eventId}/reports/event-summary`,
      { responseType: 'blob' }
    )
    return response.data
  }
}

export const reportService = new ReportService()
export default reportService
