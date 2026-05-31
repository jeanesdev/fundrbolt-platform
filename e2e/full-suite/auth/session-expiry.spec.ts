import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('expired refresh token is rejected', async ({ page }) => {
  const response = await page.request.post(`${API_URL}/auth/refresh`, {
    data: { refresh_token: 'expired-refresh-token' },
  })

  expect([400, 401]).toContain(response.status())
})

test('valid refresh token extends the session', async ({ page }) => {
  const session = await loginAs('donor')
  const response = await page.request.post(`${API_URL}/auth/refresh`, {
    data: { refresh_token: session.refreshToken },
  })
  const body = (await response.json()) as Record<string, unknown>

  expect(response.ok(), await response.text()).toBeTruthy()
  expect(body.access_token).toBeTruthy()
})
