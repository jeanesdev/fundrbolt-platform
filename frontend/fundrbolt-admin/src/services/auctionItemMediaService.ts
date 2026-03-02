import apiClient from '@/lib/axios';
import type {
  AuctionItemMedia,
  MediaListResponse,
  MediaReorderRequest,
  MediaUploadConfirmRequest,
  MediaUploadRequest,
  MediaUploadResponse,
} from '@/types/auction-item';

/**
 * Auction Item Media Service
 * Handles media upload, management, and reordering for auction items
 */
class AuctionItemMediaService {
  /**
   * Step 1: Generate a pre-signed SAS URL for uploading media to Azure Blob Storage
   */
  async generateUploadUrl(
    eventId: string,
    itemId: string,
    request: MediaUploadRequest
  ): Promise<MediaUploadResponse> {
    const response = await apiClient.post<MediaUploadResponse>(
      `/events/${eventId}/auction-items/${itemId}/media/upload-url`,
      request
    );
    return response.data;
  }

  /**
   * Step 2: Upload file directly to Azure Blob Storage using the SAS URL
   * This bypasses the backend API for efficient large file uploads
   */
  async uploadToBlob(uploadUrl: string, file: File): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }
  }

  /**
   * Step 3: Confirm the upload and save metadata to database
   * For images, this triggers thumbnail generation
   */
  async confirmUpload(
    eventId: string,
    itemId: string,
    request: MediaUploadConfirmRequest
  ): Promise<AuctionItemMedia> {
    const response = await apiClient.post<AuctionItemMedia>(
      `/events/${eventId}/auction-items/${itemId}/media/confirm`,
      request
    );
    return response.data;
  }

  /**
   * Complete upload workflow: generate URL → upload to blob → confirm
   */
  async uploadMedia(
    eventId: string,
    itemId: string,
    file: File,
    mediaType: 'image' | 'video',
    videoUrl?: string
  ): Promise<AuctionItemMedia> {
    // Step 1: Generate upload URL
    const uploadResponse = await this.generateUploadUrl(eventId, itemId, {
      file_name: file.name,
      content_type: file.type,
      file_size: file.size,
      media_type: mediaType,
    });

    // Step 2: Upload to Azure Blob Storage
    await this.uploadToBlob(uploadResponse.upload_url, file);

    // Step 3: Confirm upload
    return await this.confirmUpload(eventId, itemId, {
      blob_name: uploadResponse.blob_name,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type,
      media_type: mediaType,
      video_url: videoUrl || null,
    });
  }

  /**
   * List all media for an auction item, ordered by display_order
   */
  async listMedia(eventId: string, itemId: string): Promise<MediaListResponse> {
    const response = await apiClient.get<MediaListResponse>(
      `/events/${eventId}/auction-items/${itemId}/media`
    );
    return response.data;
  }

  /**
   * Reorder media items (drag-and-drop)
   */
  async reorderMedia(
    eventId: string,
    itemId: string,
    request: MediaReorderRequest
  ): Promise<MediaListResponse> {
    const response = await apiClient.patch<MediaListResponse>(
      `/events/${eventId}/auction-items/${itemId}/media/reorder`,
      request
    );
    return response.data;
  }

  /**
   * Delete a media item
   */
  async deleteMedia(
    eventId: string,
    itemId: string,
    mediaId: string
  ): Promise<void> {
    await apiClient.delete(
      `/events/${eventId}/auction-items/${itemId}/media/${mediaId}`
    );
  }
}

export const auctionItemMediaService = new AuctionItemMediaService();
export default auctionItemMediaService;
