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
