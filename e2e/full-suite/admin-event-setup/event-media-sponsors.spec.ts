import { expect, test } from '../../fixtures/base-fixtures'

test('super admin can list sponsors for the seeded live event', async ({ superAdminApi, seedRefs }) => {
  const sponsors = await superAdminApi.get<Record<string, unknown>>(`/events/${seedRefs.liveEventSlug}/sponsors`)

  expect(sponsors).toBeTruthy()
})

test('super admin can list food options for the seeded live event', async ({ superAdminApi, seedRefs }) => {
  const foodOptions = await superAdminApi.get<Record<string, unknown>>(`/events/${seedRefs.liveEventSlug}/food-options`)

  expect(foodOptions).toBeTruthy()
})
