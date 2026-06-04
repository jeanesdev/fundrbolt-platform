import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('quick bid with a valid paddle and table is accessible', async ({ page, seedRefs }) => {
  const session = await loginAs('npo_admin')
  const response = await page.request.post(`${API_URL}/admin/events/${seedRefs.liveEventId}/quick-entry/live-auction/bids`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { bidder_number: 101, amount: 100 },
  })

  expect(response.status()).toBeLessThan(500)
})

test('quick bid with an unassigned paddle returns an error', async ({ page, seedRefs }) => {
  const session = await loginAs('npo_admin')
  const response = await page.request.post(`${API_URL}/admin/events/${seedRefs.liveEventId}/quick-entry/live-auction/bids`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { bidder_number: 999999, amount: 100 },
  })

  expect([400, 404, 409, 422]).toContain(response.status())
})
