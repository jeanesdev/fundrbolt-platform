import type {
  AuctionBidDashboardResponse,
  AuctionBidImportConfirmRequest,
  AuctionBidImportSummary,
  AuctionBidPreflightResult,
} from '@/types/auctionBidImport'
import apiClient from '@/lib/axios'

/**
 * Auction Bid Import Service
 */
class AuctionBidService {
  async getDashboard(eventId: string): Promise<AuctionBidDashboardResponse> {
    const response = await apiClient.get<AuctionBidDashboardResponse>(
      `/admin/events/${eventId}/auction-bids/dashboard`
    )
    return response.data
  }

  async preflightImport(
    eventId: string,
    file: File,
    signal?: AbortSignal
  ): Promise<AuctionBidPreflightResult> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<AuctionBidPreflightResult>(
      `/admin/events/${eventId}/auction-bids/import/preflight`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal,
      }
    )
    return response.data
  }

  async confirmImport(
    eventId: string,
    payload: AuctionBidImportConfirmRequest,
    file: File,
    signal?: AbortSignal
  ): Promise<AuctionBidImportSummary> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('import_batch_id', payload.import_batch_id)
    const response = await apiClient.post<AuctionBidImportSummary>(
      `/admin/events/${eventId}/auction-bids/import/confirm`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal,
      }
    )
    return response.data
  }
}

export const auctionBidService = new AuctionBidService()
export default auctionBidService
