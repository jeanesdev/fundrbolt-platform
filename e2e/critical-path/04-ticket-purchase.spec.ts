import { expect, test } from '../fixtures/base-fixtures'

test('seed donor can validate promo pricing for live event tickets', async ({ donorApi, seedRefs }) => {
  const tickets = await donorApi.get<Array<{ id: string }>>(`/events/${seedRefs.liveEventSlug}/tickets`)
  const vipTicket = tickets[0]
  const validation = await donorApi.post<{ promo_code_applied: string | null }>(
    `/events/${seedRefs.liveEventSlug}/tickets/validate-cart`,
    {
      items: [{ package_id: vipTicket.id, quantity: 1 }],
      promo_code: 'SEED10',
    }
  )
  expect(validation.promo_code_applied).toBe('SEED10')
})
