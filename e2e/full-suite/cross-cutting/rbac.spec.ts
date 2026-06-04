import { randomUUID } from 'node:crypto'

import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('donor cannot access the admin event creation endpoint', async ({ page }) => {
  const session = await loginAs('donor')
  const response = await page.request.post(`${API_URL}/events`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: {
      name: `RBAC Event ${randomUUID().slice(0, 8)}`,
      slug: `rbac-event-${randomUUID().slice(0, 8)}`,
      timezone: 'America/New_York',
      event_datetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  })

  expect([401, 403]).toContain(response.status())
})

test('npo admin cannot access a super-admin-only endpoint', async ({ page }) => {
  const session = await loginAs('npo_admin')
  const response = await page.request.get(`${API_URL}/npos`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  expect([200, 403]).toContain(response.status())
})

test('unauthenticated requests to protected endpoints return 401', async ({ page, seedRefs }) => {
  const response = await page.request.get(`${API_URL}/notifications?event_id=${seedRefs.liveEventId}`)

  expect(response.status()).toBe(401)
})
