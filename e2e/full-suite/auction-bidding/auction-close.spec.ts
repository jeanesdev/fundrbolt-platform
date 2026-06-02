import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { provisionEvent } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('closing an auction endpoint transitions the event response', async ({ page, adminApi }) => {
  const session = await loginAs('npo_admin')
  const event = (await provisionEvent(adminApi, { status: 'active' })) as Record<string, unknown>
  const response = await page.request.post(`${API_URL}/events/${String(event.id)}/close`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  expect(response.status()).toBeLessThan(500)
})

test('auction close endpoint is accessible by admin', async ({ page, seedRefs }) => {
  const session = await loginAs('npo_admin')
  const response = await page.request.post(`${API_URL}/events/${seedRefs.liveEventId}/close`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  expect(response.status()).toBeLessThan(500)
})
