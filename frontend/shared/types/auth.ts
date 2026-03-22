/**
 * Shared TypeScript type definitions for Authentication
 *
 * These types match the backend API contracts and ensure
 * type safety across frontend applications.
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role_name: string;
    npo_id: string | null;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface RegisterResponse {
  message: string;
  user_id: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

export interface EmailVerifyRequest {
  token: string;
}

export interface EmailVerifyResponse {
  message: string;
}

export interface EmailResendRequest {
  email: string;
}

export type SocialAuthProvider = 'apple' | 'google' | 'facebook' | 'microsoft';

export interface SocialAuthProviderItem {
  provider: SocialAuthProvider;
  enabled: boolean;
  display_name: string;
}

export interface SocialAuthProvidersResponse {
  providers: SocialAuthProviderItem[];
}

export interface SocialAuthStartRequest {
  app_context: 'donor_pwa' | 'admin_pwa';
  redirect_uri: string;
}

export interface SocialAuthStartResponse {
  attempt_id: string;
  authorization_url: string;
  state: string;
}

export interface SocialAuthCallbackRequest {
  code: string;
  state: string;
  attempt_id?: string;
}

export interface SocialAuthPendingResponse {
  status: 'pending_verification';
  reason: 'link_confirmation_required' | 'email_verification_required' | 'admin_step_up_required' | 'needs_registration';
  attempt_id: string;
  message?: string;
  prefill_email?: string;
  prefill_name?: string;
}

export interface SocialAuthSuccessResponse {
  status: 'authenticated';
  app_context: 'donor_pwa' | 'admin_pwa';
  user_id: string;
  access_token: string;
  refresh_token: string;
  is_new_account?: boolean;
}

export type SocialAuthCallbackResponse = SocialAuthPendingResponse | SocialAuthSuccessResponse;

export interface AuthError {
  detail: string;
  error_code?: string;
}

export interface AuthState {
  user: LoginResponse['user'] | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
