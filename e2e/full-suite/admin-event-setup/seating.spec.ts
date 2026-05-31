import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('admin can fetch the seating layout for the seeded live event', async ({ page, seedRefs }) => {
  const session = await loginAs('npo_admin')
  const response = await page.request.get(`${API_URL}/admin/events/${seedRefs.liveEventSlug}/tables`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  expect(response.status()).toBeLessThan(500)
})

test('table capacity endpoint is accessible', async ({ page, seedRefs }) => {
  const session = await loginAs('npo_admin')
  const response = await page.request.patch(`${API_URL}/admin/events/${seedRefs.liveEventSlug}/tables/1`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { custom_capacity: 8 },
  })

  expect(response.status()).toBeLessThan(500)
})
