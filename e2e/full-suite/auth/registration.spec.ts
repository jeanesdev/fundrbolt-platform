import { randomUUID } from 'node:crypto'

import { API_URL } from '../../playwright.config'
import { expect, test } from '../../fixtures/base-fixtures'

const defaultPassword = process.env.SEED_TEST_PASSWORD ?? 'TestPassword123!'

test('sign up with a unique email returns created', async ({ page }) => {
  const email = `automation+registration-${randomUUID()}@fundrbolt.com`
  const response = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password: defaultPassword,
      first_name: 'Playwright',
      last_name: 'Registration',
    },
  })

  expect([200, 201]).toContain(response.status())
})

test('sign up with a duplicate email is rejected', async ({ page }) => {
  const email = `automation+duplicate-${randomUUID()}@fundrbolt.com`
  await page.request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password: defaultPassword,
      first_name: 'Duplicate',
      last_name: 'Donor',
    },
  })

  const duplicate = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password: defaultPassword,
      first_name: 'Duplicate',
      last_name: 'Donor',
    },
  })

  expect([400, 409]).toContain(duplicate.status())
})

test('registration sends a verification email', async ({ page, mailpit }) => {
  test.skip(!process.env.MAILPIT_API_URL, 'Mailpit not configured')

  const email = `automation+verify-${randomUUID()}@fundrbolt.com`
  const response = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password: defaultPassword,
      first_name: 'Verify',
      last_name: 'Donor',
    },
  })

  expect([200, 201]).toContain(response.status())
  const message = await mailpit.waitForMessage({ to: email, subjectContains: 'Verify' })
  expect(message.Subject).toContain('Verify')
})
