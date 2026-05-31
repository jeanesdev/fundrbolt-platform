import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

const donorEmail = process.env.SEED_DONOR_EMAIL ?? 'automation+donor@fundrbolt.com'
const defaultPassword = process.env.SEED_TEST_PASSWORD ?? 'TestPassword123!'

test('sign in with valid credentials returns tokens', async ({ page }) => {
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { email: donorEmail, password: defaultPassword },
  })
  const body = (await response.json()) as Record<string, unknown>

  expect(response.ok(), await response.text()).toBeTruthy()
  expect(body.access_token).toBeTruthy()
  expect(body.refresh_token).toBeTruthy()
})

test('sign in with wrong password is rejected', async ({ page }) => {
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { email: donorEmail, password: `${defaultPassword}-wrong` },
  })

  expect([400, 401]).toContain(response.status())
})

test('sign out invalidates the refresh session', async ({ page }) => {
  const session = await loginAs('donor')
  const headers = { Authorization: `Bearer ${session.accessToken}` }

  const logout = await page.request.post(`${API_URL}/auth/logout`, {
    headers,
    data: { refresh_token: session.refreshToken },
  })
  expect([200, 204]).toContain(logout.status())

  const refresh = await page.request.post(`${API_URL}/auth/refresh`, {
    data: { refresh_token: session.refreshToken },
  })
  expect([400, 401]).toContain(refresh.status())
})
