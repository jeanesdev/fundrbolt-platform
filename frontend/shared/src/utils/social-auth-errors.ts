/**
 * Normalizes social auth error responses into user-friendly messages.
 */

export type SocialAuthErrorCode =
  | 'provider_not_configured'
  | 'provider_not_enabled'
  | 'admin_not_provisioned'
  | 'link_confirmation_required'
  | 'email_verification_required'
  | 'admin_step_up_required'
  | 'invalid_state'
  | 'expired_attempt'
  | 'provider_error'
  | 'unknown';

const ERROR_MESSAGES: Record<SocialAuthErrorCode, string> = {
  provider_not_configured: 'This sign-in method is not available. Please use email and password.',
  provider_not_enabled: 'This sign-in method is temporarily disabled. Please try another option.',
  admin_not_provisioned: 'Your account has not been provisioned for admin access. Please contact your organization administrator.',
  link_confirmation_required: 'An account with this email already exists. Please sign in with your password to link your social account.',
  email_verification_required: 'Please verify your email address. Check your inbox for a verification link.',
  admin_step_up_required: 'Additional identity verification is required. Please enter your password.',
  invalid_state: 'The sign-in session has expired. Please try again.',
  expired_attempt: 'The sign-in attempt has expired. Please start over.',
  provider_error: 'The sign-in provider encountered an error. Please try again.',
  unknown: 'Social sign-in failed. Please try again or use email and password.',
};

export function normalizeSocialAuthError(error: unknown): {
  code: SocialAuthErrorCode;
  message: string;
} {
  const detail = (error as { response?: { data?: { detail?: string } } })
    ?.response?.data?.detail;

  if (typeof detail === 'string') {
    if (detail.includes('not configured')) return { code: 'provider_not_configured', message: ERROR_MESSAGES.provider_not_configured };
    if (detail.includes('not enabled')) return { code: 'provider_not_enabled', message: ERROR_MESSAGES.provider_not_enabled };
    if (detail.includes('not provisioned') || detail.includes('No pre-provisioned')) return { code: 'admin_not_provisioned', message: ERROR_MESSAGES.admin_not_provisioned };
    if (detail.includes('Invalid state') || detail.includes('invalid state')) return { code: 'invalid_state', message: ERROR_MESSAGES.invalid_state };
    if (detail.includes('expired') || detail.includes('Expired')) return { code: 'expired_attempt', message: ERROR_MESSAGES.expired_attempt };
  }

  return { code: 'unknown', message: ERROR_MESSAGES.unknown };
}

export function getSocialAuthErrorMessage(code: SocialAuthErrorCode): string {
  return ERROR_MESSAGES[code];
}
