import { API_URL } from '../../playwright.config'
import { expect, test } from '../../fixtures/base-fixtures'

test('donor can view an event registration page over the API', async ({ page, seedRefs }) => {
  const response = await page.request.get(`${API_URL}/events/public/${seedRefs.liveEventSlug}`)

  expect(response.status()).toBeLessThan(500)
})

test('authenticated donor can fetch their registrations', async ({ donorApi }) => {
  const registrations = await donorApi.get<Record<string, unknown>>('/registrations')

  expect(registrations).toBeTruthy()
})
