import { randomUUID } from 'node:crypto'

import { API_URL, DONOR_APP_URL } from '../playwright.config'
import { expect, test } from '../fixtures/base-fixtures'

test('donor signup sends a verification email', async ({ page, mailpit }) => {
  const email = `automation+signup-${randomUUID()}@fundrbolt.com`
  const response = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password: process.env.SEED_TEST_PASSWORD ?? 'TestPassword123!',
      first_name: 'Signup',
      last_name: 'Donor',
    },
  })

  expect(response.ok(), await response.text()).toBeTruthy()
  await page.goto(`${DONOR_APP_URL}/sign-in`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/sign-in/)
  const message = await mailpit.waitForMessage({ to: email, subjectContains: 'Verify' })
  expect(message.Subject).toContain('Verify')
})
