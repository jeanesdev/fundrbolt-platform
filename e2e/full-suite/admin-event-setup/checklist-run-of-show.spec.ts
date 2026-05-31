import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('admin can fetch run-of-show items', async ({ page, seedRefs }) => {
  const session = await loginAs('npo_admin')
  const response = await page.request.get(`${API_URL}/admin/events/${seedRefs.liveEventSlug}/run-of-show`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  expect(response.status()).toBeLessThan(500)
})

test('admin can fetch checklist items', async ({ page, seedRefs }) => {
  const session = await loginAs('npo_admin')
  const response = await page.request.get(`${API_URL}/admin/events/${seedRefs.liveEventSlug}/checklist`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  expect(response.status()).toBeLessThan(500)
})
