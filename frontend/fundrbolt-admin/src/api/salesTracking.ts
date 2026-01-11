/**
 * Sales Tracking API Client
 * Handles ticket sales analytics and reporting
 */

import { apiClient } from '@/lib/api-client';

export interface SalesSummary {
  event_id: string;
  total_packages_sold: number;
  total_tickets_sold: number;
  total_revenue: number;
  packages_sold_out_count: number;
}

export interface PackageSalesSummary {
  package_id: string;
  package_name: string;
  quantity_sold: number;
  total_revenue: number;
  quantity_limit: number | null;
  available_quantity: number | null;
  is_sold_out: boolean;
}

export interface Purchaser {
  purchase_id: string;
  purchaser_name: string;
  purchaser_email: string;
  quantity: number;
  total_price: number;
  payment_status: string;
  purchased_at: string;
  promo_code: string | null;
  discount_amount: number | null;
  assigned_tickets_count: number;
}

export interface PackageSalesDetails extends PackageSalesSummary {
  purchasers: Purchaser[];
  total_count: number;
  page: number;
  per_page: number;
}

export const salesTrackingApi = {
  /**
   * Get event-wide sales summary
   */
  async getEventSalesSummary(eventId: string, sponsorshipsOnly = false): Promise<SalesSummary> {
    const response = await apiClient.get<SalesSummary>(
      `/admin/events/${eventId}/tickets/sales/summary`,
      {
        params: sponsorshipsOnly ? { sponsorships_only: true } : undefined,
      }
    );
    return response.data;
  },

  /**
   * Get detailed sales information for a specific package
   */
  async getPackageSalesDetails(
    eventId: string,
    packageId: string,
    page = 1,
    perPage = 50
  ): Promise<PackageSalesDetails> {
    const response = await apiClient.get<PackageSalesDetails>(
      `/admin/events/${eventId}/tickets/packages/${packageId}/sales`,
      {
        params: { page, per_page: perPage },
      }
    );
    return response.data;
  },

  /**
   * Export sales data as CSV
   * Returns blob URL for download
   */
  async exportSalesCSV(eventId: string): Promise<string> {
    const response = await apiClient.get(`/admin/events/${eventId}/tickets/sales/export`, {
      responseType: 'blob',
    });

    // Create blob URL for download
    const blob = new Blob([response.data], { type: 'text/csv' });
    return URL.createObjectURL(blob);
  },
};
