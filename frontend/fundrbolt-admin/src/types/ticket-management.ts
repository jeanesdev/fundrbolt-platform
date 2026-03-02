/**
 * Ticket Management Type Definitions
 * Types for ticket packages, custom options, and promo codes
 */

// Enums
export enum DiscountType {
  PERCENTAGE = "percentage",
  FIXED_AMOUNT = "fixed_amount",
}

// Promo Code Types
export interface PromoCodeBase {
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  max_uses: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

export type PromoCodeCreate = PromoCodeBase;

export type PromoCodeUpdate = Partial<PromoCodeBase>;

export interface PromoCodeRead extends PromoCodeBase {
  id: string;
  event_id: string;
  created_by: string;
  used_count: number;
  created_at: string;
  updated_at: string;
  version: number;
}

// Validation Response
export interface PromoCodeValidationResponse {
  valid: boolean;
  message: string;
  promo_code?: PromoCodeRead;
  discount_amount?: number;
}

// Ticket Package Types
export interface TicketPackageBase {
  name: string;
  description: string | null;
  price: string; // decimal as string
  seats_per_package: number;
  quantity_limit: number | null;
  is_enabled: boolean;
  is_sponsorship: boolean;
}

export type TicketPackageCreate = TicketPackageBase;

export type TicketPackageUpdate = Partial<Omit<TicketPackageBase, 'is_enabled'>> & {
  is_enabled?: boolean;
  version?: number;
};

export interface TicketPackageRead extends TicketPackageBase {
  id: string;
  event_id: string;
  sold_count: number;
  display_order: number;
  image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
  is_sold_out: boolean;
  available_quantity: number | null;
}
