import { expect, test } from '../fixtures/base-fixtures'

test('donor can validate a scoped registration cart', async ({ donorApi, seedRefs }) => {
  const tickets = await donorApi.get<Array<{ id: string }>>(`/events/${seedRefs.futureEventSlug}/tickets`)
  expect(tickets.length).toBeGreaterThan(0)
  const firstTicket = tickets[0]
  const validation = await donorApi.post<{ total: string; items: Array<{ package_id: string }> }>(
    `/events/${seedRefs.futureEventSlug}/tickets/validate-cart`,
    {
      items: [{ package_id: firstTicket.id, quantity: 1 }],
    }
  )
  expect(validation.items[0]?.package_id).toBe(firstTicket.id)
})
