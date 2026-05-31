import type { Page } from '@playwright/test'

import { API_URL } from '../playwright.config'
import { ApiClient, createApiClient } from './api-client'

type SeedRole = 'super_admin' | 'npo_admin' | 'npo_staff' | 'checkin_staff' | 'donor'

type LoginResponse = {
  access_token: string
  refresh_token: string
  user: Record<string, unknown>
}

const DEFAULT_PASSWORD = process.env.SEED_TEST_PASSWORD ?? 'TestPassword123!'

const roleEmails: Record<SeedRole, string> = {
  super_admin: process.env.SEED_SUPER_ADMIN_EMAIL ?? 'automation+super_admin@fundrbolt.com',
  npo_admin: process.env.SEED_NPO_ADMIN_EMAIL ?? 'automation+npo_admin@fundrbolt.com',
  npo_staff: process.env.SEED_NPO_STAFF_EMAIL ?? 'automation+npo_staff@fundrbolt.com',
  checkin_staff: process.env.SEED_CHECKIN_STAFF_EMAIL ?? 'automation+checkin_staff@fundrbolt.com',
  donor: process.env.SEED_DONOR_EMAIL ?? 'automation+donor@fundrbolt.com',
}

export async function loginAs(role: SeedRole): Promise<{
  apiClient: ApiClient
  accessToken: string
  refreshToken: string
  user: Record<string, unknown>
}> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: roleEmails[role], password: DEFAULT_PASSWORD }),
  })

  if (!response.ok) {
    throw new Error(`Unable to log in as ${role}: ${response.status} ${await response.text()}`)
  }

  const body = (await response.json()) as LoginResponse
  return {
    apiClient: createApiClient(API_URL, body.access_token),
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    user: body.user,
  }
}

export async function storeSeedAuth(page: Page, role: SeedRole, app: 'admin' | 'donor' = 'donor'): Promise<void> {
  const session = await loginAs(role)
  await page.addInitScript(
    ({ accessToken, refreshToken, user, appName }) => {
      localStorage.setItem('fundrbolt_refresh_token', refreshToken)
      localStorage.setItem('fundrbolt_token_expiry', String(Date.now() + 7 * 24 * 60 * 60 * 1000))
      localStorage.setItem('cookie-consent', JSON.stringify({ essential: true, analytics: true, marketing: true }))
      localStorage.setItem(
        'fundrbolt-auth-storage',
        JSON.stringify({
          state: {
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            appName,
          },
          version: 0,
        })
      )
    },
    {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
      appName: app,
    }
  )
}
