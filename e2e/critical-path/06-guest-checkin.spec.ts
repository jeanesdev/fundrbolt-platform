import { loginAs } from '../helpers/auth'
import { expect, test } from '../fixtures/base-fixtures'

test('check-in staff can fetch seeded live-event lookup suggestions', async ({ seedRefs }) => {
  const { apiClient } = await loginAs('checkin_staff')
  const lookup = await apiClient.post<{ total: number }>('/checkin/lookup', {
    email: process.env.SEED_DONOR_EMAIL ?? 'automation+donor@fundrbolt.com',
  })
  expect(lookup.total).toBeGreaterThanOrEqual(1)
  expect(seedRefs.liveEventSlug).toBe('seed-live-event')
})
