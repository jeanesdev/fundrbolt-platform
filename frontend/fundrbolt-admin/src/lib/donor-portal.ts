const DEFAULT_DONOR_PWA_URL = 'http://localhost:5174'

export function getDonorPwaUrl(): string {
  return import.meta.env.VITE_DONOR_PWA_URL || DEFAULT_DONOR_PWA_URL
}

function buildDonorPortalUrl(path: string, email?: string): string {
  const url = new URL(path, getDonorPwaUrl())

  if (email) {
    url.searchParams.set('email', email)
  }

  return url.toString()
}

export function buildDonorPortalSignInUrl(email?: string): string {
  return buildDonorPortalUrl('/sign-in', email)
}

export function buildDonorPortalSignUpUrl(email?: string): string {
  return buildDonorPortalUrl('/sign-up', email)
}
