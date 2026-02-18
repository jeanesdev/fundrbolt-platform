import apiClient from '@/lib/axios';
import type {
  AuctionItem,
  AuctionItemCreate,
  AuctionItemDetail,
  AuctionItemListResponse,
  AuctionItemUpdate,
  AuctionType,
  BidResponse,
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

  /**
   * Place a bid on an auction item
   */
  async placeBid(
    eventId: string,
    itemId: string,
    amount: number
  ): Promise<BidResponse> {
    const response = await apiClient.post<BidResponse>(
      `/events/${eventId}/auction-items/${itemId}/bids`,
      { amount }
    );
    return response.data;
  }

  /**
   * Place a max bid on an auction item
   */
  async placeMaxBid(
    eventId: string,
    itemId: string,
    maxAmount: number
  ): Promise<BidResponse> {
    const response = await apiClient.post<BidResponse>(
      `/events/${eventId}/auction-items/${itemId}/bids/max`,
      { max_amount: maxAmount }
    );
    return response.data;
  }

  /**
   * Buy now an auction item
   */
  async buyNow(
    eventId: string,
    itemId: string,
    quantity: number = 1
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(
      `/events/${eventId}/auction-items/${itemId}/buy-now`,
      { quantity }
    );
    return response.data;
  }

  /**
   * Track item view duration
   */
  async trackItemView(
    eventId: string,
    itemId: string,
    durationSeconds: number
  ): Promise<void> {
    await apiClient.post(
      `/events/${eventId}/auction-items/${itemId}/views`,
      { duration_seconds: durationSeconds }
    );
  }
}

export const auctionItemService = new AuctionItemService();
export default auctionItemService;
