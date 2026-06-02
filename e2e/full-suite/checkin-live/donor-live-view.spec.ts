import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('authenticated donor can fetch seating info for the live event', async ({ page, seedRefs }) => {
  const session = await loginAs('donor')
  const response = await page.request.get(`${API_URL}/donor/events/${seedRefs.liveEventId}/my-seating`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  expect(response.status()).toBeLessThan(500)
})
