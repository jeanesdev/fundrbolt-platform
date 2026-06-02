import { randomUUID } from 'node:crypto'

import { provisionEvent, provisionTicketPackage } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('donor can list ticket packages for the seeded live event', async ({ donorApi, seedRefs }) => {
  const packages = await donorApi.get<Record<string, unknown>>(`/events/${seedRefs.liveEventSlug}/tickets`)

  expect(packages).toBeTruthy()
})

test('promo code validation accepts a valid code', async ({ adminApi, donorApi }) => {
  const event = (await provisionEvent(adminApi)) as Record<string, unknown>
  const eventId = String(event.id)
  const ticketPackage = (await provisionTicketPackage(adminApi, eventId)) as Record<string, unknown>
  const code = `SAVE-${randomUUID().slice(0, 8).toUpperCase()}`

  await adminApi.post(`/events/${eventId}/promo-codes`, {
    code,
    discount_type: 'percentage',
    discount_value: 10,
    applies_to_all_packages: true,
  })

  const validation = await donorApi.post<Record<string, unknown>>(`/events/${eventId}/promo-codes/${code}/validate`, {
    items: [{ package_id: ticketPackage.id, quantity: 1 }],
  })

  expect(validation).toBeTruthy()
})
