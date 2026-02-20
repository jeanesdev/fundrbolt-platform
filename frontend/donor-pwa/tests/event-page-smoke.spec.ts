/// <reference types="node" />

import { expect, test } from '@playwright/test'

const APP_URL = process.env.SMOKE_APP_URL ?? 'http://localhost:5174'
const API_URL = process.env.SMOKE_API_URL ?? 'http://localhost:8000/api/v1'
const SMOKE_EMAIL = process.env.SMOKE_EMAIL ?? 'super_admin@test.com'
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD ?? 'SuperAdmin123!'

test('event page smoke: key sections load with no runtime errors', async ({ page, request }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const requestFailures: string[] = []
  const serverErrors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`)
  })

  page.on('response', (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })

  const loginApi = await request.post(`${API_URL}/auth/login`, {
    data: {
      email: SMOKE_EMAIL,
      password: SMOKE_PASSWORD,
    },
  })

  expect(loginApi.ok(), `API login failed: ${loginApi.status()} ${await loginApi.text()}`).toBeTruthy()

  const eventsApi = await request.get(`${API_URL}/events?per_page=20`, {
    headers: {
      Authorization: `Bearer ${(await loginApi.json()).access_token}`,
    },
  })

  expect(eventsApi.ok(), `Events fetch failed: ${eventsApi.status()} ${await eventsApi.text()}`).toBeTruthy()
  const eventsData = await eventsApi.json()
  const activeEvent = (eventsData.items ?? []).find((event: { status?: string }) => event.status === 'active')

  expect(activeEvent, 'No active event found for smoke test').toBeTruthy()
  const eventSlug = activeEvent.slug as string

  await page.goto(`${APP_URL}/sign-in`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(SMOKE_EMAIL)
  await page.getByLabel('Password').fill(SMOKE_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await page.waitForURL('**/home', { timeout: 15000 })

  await page.goto(`${APP_URL}/events/${eventSlug}`, { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'Auction Items' })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('Failed to load auction items')).toHaveCount(0)
  await expect(page.getByText('Unable to load seating information. Please try again later.')).toHaveCount(0)

  const pageTitle = await page.title()
  expect(pageTitle.length).toBeGreaterThan(0)

  expect(pageErrors, `Unhandled page errors:\n${pageErrors.join('\n')}`).toEqual([])
  expect(consoleErrors, `Console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(requestFailures, `Network request failures:\n${requestFailures.join('\n')}`).toEqual([])
  expect(serverErrors, `HTTP 5xx responses:\n${serverErrors.join('\n')}`).toEqual([])
})
