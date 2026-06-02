import { expect, test } from '../fixtures/base-fixtures'

test('seed donor can list seeded live event auction items', async ({ donorApi, seedRefs }) => {
  const itemList = await donorApi.get<{ items: Array<{ id: string; min_next_bid_amount: string | null }> }>(
    `/events/${seedRefs.liveEventId}/auction-items?auction_type=silent`
  )
  expect(itemList.items.length).toBeGreaterThan(0)
})
