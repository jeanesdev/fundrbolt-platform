import apiClient from '@/lib/axios';
import type {
  AuctionItem,
  AuctionItemCreate,
  AuctionItemDetail,
  AuctionItemListResponse,
  AuctionItemUpdate,
  AuctionType,
  ItemStatus,
} from '@/types/auction-item';

/**
 * Auction Item Service
 * Handles all auction item-related API calls
 */
class AuctionItemService {
  /**
   * List auction items for an event with optional filters
   */
  async listAuctionItems(
    eventId: string,
    params?: {
      auctionType?: AuctionType;
      status?: ItemStatus;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<AuctionItemListResponse> {
    const response = await apiClient.get<AuctionItemListResponse>(
      `/events/${eventId}/auction-items`,
      { params }
    );
    return response.data;
  }

  /**
   * Get a single auction item by ID with full details
   */
  async getAuctionItem(
    eventId: string,
    itemId: string
  ): Promise<AuctionItemDetail> {
    const response = await apiClient.get<AuctionItemDetail>(
      `/events/${eventId}/auction-items/${itemId}`
    );
    return response.data;
  }

  /**
   * Create a new auction item
   * Bid number is auto-assigned (100-999)
   */
  async createAuctionItem(
    eventId: string,
    data: AuctionItemCreate
  ): Promise<AuctionItem> {
    const response = await apiClient.post<AuctionItem>(
      `/events/${eventId}/auction-items`,
      data
    );
    return response.data;
  }

  /**
   * Update an existing auction item
   */
  async updateAuctionItem(
    eventId: string,
    itemId: string,
    data: AuctionItemUpdate
  ): Promise<AuctionItem> {
    const response = await apiClient.patch<AuctionItem>(
      `/events/${eventId}/auction-items/${itemId}`,
      data
    );
    return response.data;
  }

  /**
   * Delete an auction item
   * Soft delete for published items, hard delete for drafts
   */
  async deleteAuctionItem(eventId: string, itemId: string): Promise<void> {
    await apiClient.delete(`/events/${eventId}/auction-items/${itemId}`);
  }
}

export const auctionItemService = new AuctionItemService();
export default auctionItemService;
