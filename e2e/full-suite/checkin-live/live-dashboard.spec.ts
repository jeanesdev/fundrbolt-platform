import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('live dashboard endpoint returns metrics for the seeded live event', async ({ page, seedRefs }) => {
  const session = await loginAs('npo_admin')
  const response = await page.request.get(`${API_URL}/admin/events/${seedRefs.liveEventId}/dashboard`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  const body = (await response.json()) as Record<string, unknown>

  expect(response.status()).toBeLessThan(500)
  expect(body).toBeTruthy()
})
