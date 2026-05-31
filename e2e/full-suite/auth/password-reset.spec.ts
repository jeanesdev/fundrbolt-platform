import { randomUUID } from 'node:crypto'

import { API_URL } from '../../playwright.config'
import { expect, test } from '../../fixtures/base-fixtures'

const donorEmail = process.env.SEED_DONOR_EMAIL ?? 'automation+donor@fundrbolt.com'
const defaultPassword = process.env.SEED_TEST_PASSWORD ?? 'TestPassword123!'

test('password reset request for a known email returns success', async ({ page }) => {
  const response = await page.request.post(`${API_URL}/auth/password/reset/request`, {
    data: { email: donorEmail },
  })

  expect(response.ok(), await response.text()).toBeTruthy()
})

test('password reset request for an unknown email still returns success', async ({ page }) => {
  const response = await page.request.post(`${API_URL}/auth/password/reset/request`, {
    data: { email: `automation+unknown-${randomUUID()}@fundrbolt.com` },
  })

  expect(response.ok(), await response.text()).toBeTruthy()
})

test('confirming reset with a valid token changes the password', async ({ page, mailpit }) => {
  test.skip(!process.env.MAILPIT_API_URL, 'Mailpit not configured')

  const email = `automation+reset-${randomUUID()}@fundrbolt.com`
  const newPassword = `${defaultPassword}#reset`

  const register = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password: defaultPassword,
      first_name: 'Reset',
      last_name: 'Target',
    },
  })
  expect([200, 201]).toContain(register.status())

  const requestReset = await page.request.post(`${API_URL}/auth/password/reset/request`, {
    data: { email },
  })
  expect(requestReset.ok(), await requestReset.text()).toBeTruthy()

  const message = await mailpit.waitForMessage({ to: email, subjectContains: 'Reset' })
  const resetLink = mailpit.extractLink(message, /https?:\/\/[^\s"'>]+/)
  const token = new URL(resetLink).searchParams.get('token')
  expect(token).toBeTruthy()
  if (!token) {
    return
  }

  const confirm = await page.request.post(`${API_URL}/auth/password/reset/confirm`, {
    data: { token, new_password: newPassword },
  })
  expect(confirm.ok(), await confirm.text()).toBeTruthy()

  const login = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password: newPassword },
  })
  expect(login.ok(), await login.text()).toBeTruthy()
})
