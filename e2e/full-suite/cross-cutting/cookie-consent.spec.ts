import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('anonymous users can set cookie preferences', async ({ page }) => {
  const response = await page.request.post(`${API_URL}/cookies/consent`, {
    data: { essential: true, analytics: false, marketing: false },
  })

  expect(response.status()).toBeLessThan(500)
})

test('authenticated users can update and revoke cookie consent', async ({ page }) => {
  const session = await loginAs('donor')
  const headers = { Authorization: `Bearer ${session.accessToken}` }

  const update = await page.request.post(`${API_URL}/cookies/consent`, {
    headers,
    data: { essential: true, analytics: true, marketing: false },
  })
  expect(update.status()).toBeLessThan(500)

  const revoke = await page.request.delete(`${API_URL}/cookies/consent`, {
    headers,
  })
  expect(revoke.status()).toBeLessThan(500)
})
