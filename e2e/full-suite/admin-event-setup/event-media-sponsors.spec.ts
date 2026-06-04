import { expect, test } from '../../fixtures/base-fixtures'

test('super admin can list sponsors for the seeded live event', async ({ superAdminApi, seedRefs }) => {
  const sponsors = await superAdminApi.get<Record<string, unknown>>(`/events/${seedRefs.liveEventId}/sponsors`)

  expect(sponsors).toBeTruthy()
})

test('super admin can list food options for the seeded live event', async ({ superAdminApi, seedRefs }) => {
  const event = await superAdminApi.get<Record<string, unknown>>(`/events/${seedRefs.liveEventId}`)

  expect((event as Record<string, unknown>).food_options).toBeDefined()
})
