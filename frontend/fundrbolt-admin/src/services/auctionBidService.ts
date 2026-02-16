import apiClient from '@/lib/axios'
import type {
  AuctionBidDashboardResponse,
  AuctionBidImportConfirmRequest,
  AuctionBidImportSummary,
  AuctionBidPreflightResult,
} from '@/types/auctionBidImport'

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
    try {
      logDebug('[auction-bids-import] preflight request', {
        eventId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      })
      const response = await apiClient.post<AuctionBidPreflightResult>(
        `/admin/events/${eventId}/auction-bids/import/preflight`,
        formData,
        {
          signal,
        }
      )
      logDebug('[auction-bids-import] preflight response', {
        eventId,
        status: response.status,
      })
      return response.data
    } catch (error) {
      logError('[auction-bids-import] preflight request failed', {
        eventId,
        error,
      })
      throw error
    }
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
    try {
      logDebug('[auction-bids-import] confirm request', {
        eventId,
        importBatchId: payload.import_batch_id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      })
      const response = await apiClient.post<AuctionBidImportSummary>(
        `/admin/events/${eventId}/auction-bids/import/confirm`,
        formData,
        {
          signal,
        }
      )
      logDebug('[auction-bids-import] confirm response', {
        eventId,
        importBatchId: payload.import_batch_id,
        status: response.status,
      })
      return response.data
    } catch (error) {
      logError('[auction-bids-import] confirm request failed', {
        eventId,
        importBatchId: payload.import_batch_id,
        error,
      })
      throw error
    }
  }
}

const logDebug = (message: string, payload?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console.debug(message, payload)
}

const logError = (message: string, payload?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console.error(message, payload)
}

export const auctionBidService = new AuctionBidService()
export default auctionBidService
