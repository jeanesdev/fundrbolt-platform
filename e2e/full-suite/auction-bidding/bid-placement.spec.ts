import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('bid at or above the minimum is accepted', async ({ page, donorApi, seedRefs }) => {
  const session = await loginAs('donor')
  const listing = await donorApi.get<Record<string, unknown>>(`/events/${seedRefs.liveEventId}/auction-items?auction_type=silent`)
  const items = Array.isArray(listing.items) ? (listing.items as Array<Record<string, unknown>>) : []
  expect(items.length).toBeGreaterThan(0)

  const itemId = String(items[0]?.id ?? '')
  const minimum = Number(items[0]?.min_next_bid_amount ?? items[0]?.starting_bid ?? 1)
  const response = await page.request.post(`${API_URL}/auction/bids`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { event_id: seedRefs.liveEventId, auction_item_id: itemId, bid_amount: minimum, bid_type: 'regular' },
  })

  expect([200, 201, 202]).toContain(response.status())
})

test('bid below the minimum is rejected', async ({ page, donorApi, seedRefs }) => {
  const session = await loginAs('donor')
  const listing = await donorApi.get<Record<string, unknown>>(`/events/${seedRefs.liveEventId}/auction-items?auction_type=silent`)
  const items = Array.isArray(listing.items) ? (listing.items as Array<Record<string, unknown>>) : []
  expect(items.length).toBeGreaterThan(0)

  const itemId = String(items[0]?.id ?? '')
  const response = await page.request.post(`${API_URL}/auction/bids`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { event_id: seedRefs.liveEventId, auction_item_id: itemId, bid_amount: 0.01, bid_type: 'regular' },
  })

  expect([400, 409, 422]).toContain(response.status())
})
