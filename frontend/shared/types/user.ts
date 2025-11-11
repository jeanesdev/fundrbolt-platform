/**
 * Shared TypeScript type definitions for User entity
 *
 * These types match the backend API contracts and ensure
 * type safety across frontend applications.
 */

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING_VERIFICATION = 'pending_verification',
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_id: string;
  role_name?: string;
  npo_id: string | null;
  organization_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  status: UserStatus;
  email_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role_id?: string;
  npo_id?: string | null;
  organization_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface UserUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  role_id?: string;
  npo_id?: string | null;
  organization_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  is_active?: boolean;
}

export interface UserPublic {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_name: string;
  npo_id: string | null;
  organization_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  email_verified: boolean;
  is_active: boolean;
  created_at: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  role_id?: string;
  npo_id?: string;
  search?: string;
  is_active?: boolean;
}

export interface UserListResponse {
  items: UserPublic[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
