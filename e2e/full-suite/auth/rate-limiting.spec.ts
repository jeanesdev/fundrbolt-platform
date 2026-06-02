import { randomUUID } from 'node:crypto'

import { API_URL } from '../../playwright.config'
import { expect, test } from '../../fixtures/base-fixtures'

test('six failed login attempts trigger rate limiting', async ({ page }) => {
  test.skip(!!process.env.CI, 'Rate limiting disabled in CI E2E jobs; covered by backend integration tests')
  const email = `automation+ratelimit-${randomUUID()}@fundrbolt.com`
  const statuses: number[] = []

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await page.request.post(`${API_URL}/auth/login`, {
      data: { email, password: 'incorrect-password' },
    })
    statuses.push(response.status())
  }

  expect(statuses.slice(0, 5).every((status) => [400, 401].includes(status))).toBe(true)
  expect(statuses[5]).toBe(429)
})
