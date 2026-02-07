import apiClient from '@/lib/axios';
import type {
  AdminEngagementResponse,
  BuyNowAvailabilityUpdate,
  ItemPromotionUpdate,
} from '@/types/auction-engagement';
import type { AuctionItem } from '@/types/auction-item';

/**
 * Auction Item Engagement Service
 * Handles engagement data, promotions, and buy-now availability
 */
class AuctionEngagementService {
  /**
   * Get engagement data for an auction item
   */
  async getEngagement(
    eventId: string,
    itemId: string
  ): Promise<AdminEngagementResponse> {
    const response = await apiClient.get<AdminEngagementResponse>(
      `/admin/auction/items/${itemId}/engagement`,
      { params: { event_id: eventId } }
    );
    return response.data;
  }

  /**
   * Update promotion badge and notice for an auction item
   */
  async updatePromotion(
    eventId: string,
    itemId: string,
    data: ItemPromotionUpdate
  ): Promise<AuctionItem> {
    const response = await apiClient.patch<AuctionItem>(
      `/admin/auction/items/${itemId}/promotion`,
      data,
      { params: { event_id: eventId } }
    );
    return response.data;
  }

  /**
   * Update buy-now availability for an auction item
   */
  async updateBuyNowAvailability(
    eventId: string,
    itemId: string,
    data: BuyNowAvailabilityUpdate
  ): Promise<AuctionItem> {
    const response = await apiClient.patch<AuctionItem>(
      `/admin/auction/items/${itemId}/buy-now`,
      data,
      { params: { event_id: eventId } }
    );
    return response.data;
  }
}

export const auctionEngagementService = new AuctionEngagementService();
export default auctionEngagementService;
