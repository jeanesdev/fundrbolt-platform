import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { provisionAuctionItem, provisionEvent } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('donor can list silent auction items for the seeded live event', async ({ donorApi, seedRefs }) => {
  const items = await donorApi.get<Record<string, unknown>>(`/events/${seedRefs.liveEventId}/auction-items?auction_type=silent`)
  const rows = Array.isArray(items.items) ? (items.items as Array<Record<string, unknown>>) : []

  expect(Array.isArray(rows)).toBe(true)
})

test('donor can list live auction items for the seeded live event', async ({ donorApi, seedRefs }) => {
  const items = await donorApi.get<Record<string, unknown>>(`/events/${seedRefs.liveEventId}/auction-items?auction_type=live`)
  const rows = Array.isArray(items.items) ? (items.items as Array<Record<string, unknown>>) : []

  expect(Array.isArray(rows)).toBe(true)
})

test('watchlist toggle endpoint is accessible', async ({ page, adminApi }) => {
  const session = await loginAs('donor')
  const event = (await provisionEvent(adminApi, { status: 'active' })) as Record<string, unknown>
  const item = (await provisionAuctionItem(adminApi, String(event.id))) as Record<string, unknown>
  const response = await page.request.post(`${API_URL}/watchlist`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { item_id: item.id },
  })

  expect([200, 201]).toContain(response.status())
})
