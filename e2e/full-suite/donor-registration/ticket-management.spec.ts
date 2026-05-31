import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('assigned tickets can be listed from inventory', async ({ page }) => {
  const session = await loginAs('donor')
  const response = await page.request.get(`${API_URL}/tickets/my-inventory`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  const body = (await response.json()) as Record<string, unknown>

  expect(response.ok(), await response.text()).toBeTruthy()
  expect(Number(body.total_tickets ?? 0)).toBeGreaterThanOrEqual(0)
})
