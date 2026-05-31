import { provisionAuctionItem, provisionEvent } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('admin can provision an auction item', async ({ adminApi }) => {
  const event = (await provisionEvent(adminApi)) as Record<string, unknown>
  const item = (await provisionAuctionItem(adminApi, String(event.id))) as Record<string, unknown>

  expect(item.id).toBeTruthy()
})

test('admin can list auction items for the seeded live event', async ({ adminApi, seedRefs }) => {
  const items = await adminApi.get<Record<string, unknown>>(`/events/${seedRefs.liveEventSlug}/auction-items`)

  expect(items).toBeTruthy()
})
