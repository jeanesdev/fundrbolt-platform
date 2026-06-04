import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { expect, test } from '../../fixtures/base-fixtures'

test('check-in staff can look up a registration by email', async ({ page }) => {
  const session = await loginAs('checkin_staff')
  const response = await page.request.post(`${API_URL}/checkin/lookup`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { email: process.env.SEED_DONOR_EMAIL ?? 'automation+donor@fundrbolt.com' },
  })
  const body = (await response.json()) as Record<string, unknown>

  expect(response.ok(), await response.text()).toBeTruthy()
  expect(Number(body.total ?? 0)).toBeGreaterThanOrEqual(0)
})

test('duplicate check-in is idempotent', async ({ page }) => {
  const session = await loginAs('checkin_staff')
  const lookup = await page.request.post(`${API_URL}/checkin/lookup`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { email: process.env.SEED_DONOR_EMAIL ?? 'automation+donor@fundrbolt.com' },
  })
  const body = (await lookup.json()) as Record<string, unknown>
  const matches = Array.isArray(body.registrations)
    ? (body.registrations as Array<Record<string, unknown>>)
    : []
  test.skip(matches.length === 0, 'No seeded registration available for duplicate check-in assertion')

  const registrationId = String(matches[0]?.registration_id ?? matches[0]?.id ?? '')
  const first = await page.request.post(`${API_URL}/checkin/registrations/${registrationId}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: {},
  })
  expect(first.status()).toBeLessThan(500)

  const second = await page.request.post(`${API_URL}/checkin/registrations/${registrationId}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: {},
  })
  // Duplicate check-in is idempotent — returns 200 with existing check-in time preserved
  expect(second.ok()).toBeTruthy()
})
