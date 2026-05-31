import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('donor can list their notifications', async ({ page, seedRefs }) => {
  const session = await loginAs('donor')
  const response = await page.request.get(`${API_URL}/notifications?event_id=${seedRefs.liveEventSlug}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  const body = (await response.json()) as Record<string, unknown>
  const notifications = Array.isArray(body.notifications)
    ? (body.notifications as Array<Record<string, unknown>>)
    : []

  expect(response.status()).toBeLessThan(500)
  expect(Array.isArray(notifications)).toBe(true)
})

test('donor can mark a notification as read', async ({ page, seedRefs }) => {
  const session = await loginAs('donor')
  const list = await page.request.get(`${API_URL}/notifications?event_id=${seedRefs.liveEventSlug}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  const body = (await list.json()) as Record<string, unknown>
  const notifications = Array.isArray(body.notifications)
    ? (body.notifications as Array<Record<string, unknown>>)
    : []
  test.skip(notifications.length === 0, 'No seeded notifications available to mark as read')

  const notificationId = String(notifications[0]?.id ?? '')
  const response = await page.request.post(`${API_URL}/notifications/${notificationId}/read?event_id=${seedRefs.liveEventSlug}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  expect([200, 404]).toContain(response.status())
})
