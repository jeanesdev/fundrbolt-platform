/**
 * Sponsor TypeScript types for frontend application
 */

export enum LogoSize {
  XSMALL = 'xsmall',
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  XLARGE = 'xlarge',
}

export interface Sponsor {
  id: string;
  event_id: string;
  name: string;
  logo_url: string;
  logo_blob_name: string;
  thumbnail_url: string;
  thumbnail_blob_name: string;
  website_url?: string;
  logo_size: LogoSize;
  sponsor_level?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  donation_amount?: number;
  notes?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface SponsorCreateRequest {
  name: string;
  logo_file_name: string;
  logo_file_type: string;
  logo_file_size: number;
  website_url?: string;
  logo_size?: LogoSize;
  sponsor_level?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  donation_amount?: number;
  notes?: string;
}

export interface SponsorUpdateRequest {
  name?: string;
  website_url?: string | null;
  logo_size?: LogoSize;
  sponsor_level?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  donation_amount?: number | null;
  notes?: string | null;
}

export interface SponsorCreateResponse {
  sponsor: Sponsor;
  upload_url: string;
  expires_at: string;
}

export interface LogoUploadRequest {
  file_name: string;
  file_type: string;
  file_size: number;
}

export interface LogoUploadResponse {
  upload_url: string;
  expires_at: string;
}

export interface ReorderSponsorsRequest {
  sponsor_ids: string[];
}
