import apiClient from '@/lib/axios';
import type {
  Sponsor,
  SponsorCreateRequest,
  SponsorCreateResponse,
  SponsorUpdateRequest,
  LogoUploadRequest,
  LogoUploadResponse,
  ReorderSponsorsRequest,
} from '@/types/sponsor';

/**
 * Sponsor Service
 * Handles all sponsor-related API calls
 */
class SponsorService {
  /**
   * List all sponsors for an event (ordered by display_order + logo_size)
   */
  async listSponsors(eventId: string): Promise<Sponsor[]> {
    const response = await apiClient.get<Sponsor[]>(
      `/events/${eventId}/sponsors`
    );
    return response.data;
  }

  /**
   * Get a single sponsor by ID
   */
  async getSponsor(eventId: string, sponsorId: string): Promise<Sponsor> {
    const response = await apiClient.get<Sponsor>(
      `/events/${eventId}/sponsors/${sponsorId}`
    );
    return response.data;
  }

  /**
   * Create a new sponsor
   * Returns sponsor + upload_url for two-step logo upload
   */
  async createSponsor(
    eventId: string,
    data: SponsorCreateRequest
  ): Promise<SponsorCreateResponse> {
    const response = await apiClient.post<SponsorCreateResponse>(
      `/events/${eventId}/sponsors`,
      data
    );
    return response.data;
  }

  /**
   * Update an existing sponsor
   */
  async updateSponsor(
    eventId: string,
    sponsorId: string,
    data: SponsorUpdateRequest
  ): Promise<Sponsor> {
    const response = await apiClient.patch<Sponsor>(
      `/events/${eventId}/sponsors/${sponsorId}`,
      data
    );
    return response.data;
  }

  /**
   * Delete a sponsor (cascade deletes logo blobs)
   */
  async deleteSponsor(eventId: string, sponsorId: string): Promise<void> {
    await apiClient.delete(`/events/${eventId}/sponsors/${sponsorId}`);
  }

  /**
   * Request a pre-signed upload URL for sponsor logo
   */
  async requestLogoUploadUrl(
    eventId: string,
    sponsorId: string,
    request: LogoUploadRequest
  ): Promise<LogoUploadResponse> {
    const response = await apiClient.post<LogoUploadResponse>(
      `/events/${eventId}/sponsors/${sponsorId}/logo/upload-url`,
      request
    );
    return response.data;
  }

  /**
   * Confirm logo upload (generates thumbnail + updates URLs)
   */
  async confirmLogoUpload(
    eventId: string,
    sponsorId: string,
    blobName: string
  ): Promise<Sponsor> {
    const response = await apiClient.post<Sponsor>(
      `/events/${eventId}/sponsors/${sponsorId}/logo/confirm`,
      { blob_name: blobName }
    );
    return response.data;
  }

  /**
   * Reorder sponsors (drag-and-drop)
   */
  async reorderSponsors(
    eventId: string,
    request: ReorderSponsorsRequest
  ): Promise<Sponsor[]> {
    const response = await apiClient.patch<Sponsor[]>(
      `/events/${eventId}/sponsors/reorder`,
      request
    );
    return response.data;
  }

  /**
   * Upload logo to Azure Blob Storage (direct upload via SAS URL)
   * @param uploadUrl - Pre-signed SAS URL from requestLogoUploadUrl
   * @param file - Logo file to upload
   */
  async uploadLogoToBlob(uploadUrl: string, file: File): Promise<void> {
    // Direct PUT request to Azure Blob Storage (bypass apiClient)
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Logo upload failed: ${response.status} - ${errorText}`);
    }
  }

  /**
   * Complete logo upload workflow (request URL → upload → confirm)
   * Combines three steps into a single method for convenience
   */
  async uploadLogo(
    eventId: string,
    sponsorId: string,
    file: File
  ): Promise<Sponsor> {
    // Step 1: Request upload URL
    const uploadResponse = await this.requestLogoUploadUrl(
      eventId,
      sponsorId,
      {
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      }
    );

    // Step 2: Upload file to Azure Blob Storage
    await this.uploadLogoToBlob(uploadResponse.upload_url, file);

    // Step 3: Confirm upload (generates thumbnail)
    return await this.confirmLogoUpload(
      eventId,
      sponsorId,
      uploadResponse.blob_name
    );
  }
}

export default new SponsorService();
