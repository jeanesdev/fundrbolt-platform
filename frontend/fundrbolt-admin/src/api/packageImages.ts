/**
 * Package Image Upload API Client
 * Handles image upload/delete operations for ticket packages
 */

import apiClient from '@/lib/axios';
import type { TicketPackageRead } from '@/types/ticket-management';

export const packageImagesApi = {
  /**
   * Upload image for a ticket package
   * Returns updated TicketPackageRead with image_url
   */
  async uploadImage(
    eventId: string,
    packageId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<TicketPackageRead> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post(
      `/admin/events/${eventId}/packages/${packageId}/image`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: { total?: number; loaded: number }) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        },
      }
    );

    return response.data as TicketPackageRead;
  },

  /**
   * Delete image for a ticket package
   * Returns updated TicketPackageRead with image_url cleared
   */
  async deleteImage(eventId: string, packageId: string): Promise<TicketPackageRead> {
    const response = await apiClient.delete(
      `/admin/events/${eventId}/packages/${packageId}/image`
    );
    return response.data as TicketPackageRead;
  },
};
