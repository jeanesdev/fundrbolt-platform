const DEFAULT_ADMIN_PWA_URL = 'http://localhost:5173'

export function getAdminPwaUrl(): string {
  return import.meta.env.VITE_ADMIN_PWA_URL || DEFAULT_ADMIN_PWA_URL
}

export function buildAdminPortalUrl(path: string): string {
  return new URL(path, getAdminPwaUrl()).toString()
}

export function buildAdminPortalSignUpUrl(intent?: 'staff'): string {
  const url = new URL('/sign-up', getAdminPwaUrl())

  if (intent) {
    url.searchParams.set('intent', intent)
  }

  return url.toString()
}

export function buildAdminPortalNpoOnboardingUrl(): string {
  return buildAdminPortalUrl('/register-npo')
}
