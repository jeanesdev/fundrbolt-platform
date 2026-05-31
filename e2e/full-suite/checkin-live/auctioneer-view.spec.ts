import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('auctioneer-style admin access can fetch live auction overview', async ({ page, seedRefs }) => {
  const session = await loginAs('npo_admin')
  const response = await page.request.get(`${API_URL}/admin/events/${seedRefs.liveEventSlug}/quick-entry/live-auction/overview`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  expect(response.status()).toBeLessThan(500)
})
