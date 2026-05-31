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

test('duplicate check-in is rejected', async ({ page }) => {
  const session = await loginAs('checkin_staff')
  const lookup = await page.request.post(`${API_URL}/checkin/lookup`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { email: process.env.SEED_DONOR_EMAIL ?? 'automation+donor@fundrbolt.com' },
  })
  const body = (await lookup.json()) as Record<string, unknown>
  const matches = Array.isArray(body.matches)
    ? (body.matches as Array<Record<string, unknown>>)
    : Array.isArray(body.results)
      ? (body.results as Array<Record<string, unknown>>)
      : []
  test.skip(matches.length === 0, 'No seeded registration available for duplicate check-in assertion')

  const registrationId = String(matches[0]?.registration_id ?? matches[0]?.id ?? '')
  const first = await page.request.patch(`${API_URL}/registrations/${registrationId}/checkin`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { checked_in: true },
  })
  expect(first.status()).toBeLessThan(500)

  const second = await page.request.patch(`${API_URL}/registrations/${registrationId}/checkin`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { checked_in: true },
  })
  expect([400, 409, 422]).toContain(second.status())
})
