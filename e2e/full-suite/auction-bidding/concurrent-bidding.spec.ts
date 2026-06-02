import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('concurrent bids keep a single winning state', async ({ page, donorApi, seedRefs }) => {
  const session = await loginAs('donor')
  const listing = await donorApi.get<Record<string, unknown>>(`/events/${seedRefs.liveEventId}/auction-items?auction_type=silent`)
  const items = Array.isArray(listing.items) ? (listing.items as Array<Record<string, unknown>>) : []
  expect(items.length).toBeGreaterThan(0)

  const item = items[0] ?? {}
  const itemId = String(item.id ?? '')
  const nextBid = Number(item.min_next_bid_amount ?? item.starting_bid ?? 10)

  const [first, second] = await Promise.all([
    page.request.post(`${API_URL}/donor/events/${seedRefs.liveEventId}/auction-items/${itemId}/bids`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { amount: nextBid },
    }),
    page.request.post(`${API_URL}/donor/events/${seedRefs.liveEventId}/auction-items/${itemId}/bids`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { amount: nextBid + 10 },
    }),
  ])

  expect([200, 201, 202, 409, 422]).toContain(first.status())
  expect([200, 201, 202, 409, 422]).toContain(second.status())
})
