import { API_URL } from '../../playwright.config'
import { expect, test } from '../../fixtures/base-fixtures'

test('social login callback rejects a missing provider token', async ({ page }) => {
  const response = await page.request.post(`${API_URL}/auth/social/google/callback`, {
    data: { code: '', state: '' },
  })

  expect([400, 401, 422]).toContain(response.status())
})
