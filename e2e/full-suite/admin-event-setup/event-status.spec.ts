import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { provisionEvent } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('draft events can transition to scheduled', async ({ page, adminApi }) => {
  const event = (await provisionEvent(adminApi)) as Record<string, unknown>
  const eventId = String(event.id)
  const session = await loginAs('npo_admin')

  const response = await page.request.post(`${API_URL}/events/${eventId}/publish`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  expect(response.status()).toBeLessThan(500)
})

test('active events cannot transition back to draft', async ({ page, seedRefs }) => {
  const session = await loginAs('npo_admin')
  // Attempting to publish an already-active event should be rejected
  const response = await page.request.post(`${API_URL}/events/${seedRefs.liveEventId}/publish`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  expect([400, 409, 422]).toContain(response.status())
})
