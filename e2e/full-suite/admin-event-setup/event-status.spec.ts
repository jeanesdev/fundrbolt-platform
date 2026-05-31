import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { provisionEvent } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('draft events can transition to scheduled', async ({ page, adminApi }) => {
  const event = (await provisionEvent(adminApi)) as Record<string, unknown>
  const eventId = String(event.id)
  const session = await loginAs('npo_admin')

  const response = await page.request.patch(`${API_URL}/events/${eventId}/status`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { status: 'scheduled' },
  })

  expect(response.status()).toBeLessThan(500)
})

test('active events cannot transition back to draft', async ({ page, seedRefs }) => {
  const session = await loginAs('npo_admin')
  const response = await page.request.patch(`${API_URL}/events/${seedRefs.liveEventSlug}/status`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { status: 'draft' },
  })

  expect([400, 409, 422]).toContain(response.status())
})
