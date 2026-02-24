/// <reference types="node" />

import { expect, test, type Page } from '@playwright/test'

const APP_URL = process.env.SMOKE_APP_URL ?? 'http://localhost:5174'
const API_URL = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:8000/api/v1'
const SMOKE_EMAIL = process.env.SMOKE_EMAIL ?? 'super_admin@test.com'
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD ?? 'SuperAdmin123!'

async function goToSmokeEventPage(page: Page, accessToken: string): Promise<void> {
  await page.goto(`${APP_URL}/home`, { waitUntil: 'domcontentloaded' })

  const auctionItemsHeading = page.getByRole('heading', { name: 'Auction Items' })
  const hasHeadingOnHome = await auctionItemsHeading
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false)

  if (hasHeadingOnHome) {
    return
  }

  const eventsResponse = await page.request.get(`${API_URL}/events?per_page=20`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  expect(eventsResponse.ok(), `Failed /events (${eventsResponse.status()})`).toBeTruthy()
  const events = (await eventsResponse.json()) as {
    items?: Array<{ slug: string; status?: string }>
  }
  const eventItems = events.items ?? []
  const candidateSlugs = [
    ...eventItems.filter((event) => event.status === 'active').map((event) => event.slug),
    ...eventItems.map((event) => event.slug),
  ]

  const uniqueCandidateSlugs = [...new Set(candidateSlugs)].filter(Boolean)
  expect(uniqueCandidateSlugs.length, 'No events available for smoke test').toBeGreaterThan(0)

  for (const slug of uniqueCandidateSlugs) {
    await page.goto(`${APP_URL}/events/${slug}`, { waitUntil: 'domcontentloaded' })

    if ((await page.getByRole('heading', { name: '500' }).count()) > 0) {
      continue
    }

    const hasHeadingOnEvent = await auctionItemsHeading
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false)

    if (hasHeadingOnEvent) {
      return
    }
  }

  throw new Error('Unable to find a healthy event page for smoke test')
}

async function openProfileMenuWithDebugTools(page: Page): Promise<void> {
  const emailTrigger = page.getByRole('button', { name: SMOKE_EMAIL })
  const genericMenuTrigger = page.locator('button[aria-haspopup="menu"]').first()

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await emailTrigger.isVisible().catch(() => false)) {
      await emailTrigger.click()
    } else {
      await expect(genericMenuTrigger).toBeVisible({ timeout: 10000 })
      await genericMenuTrigger.click()
    }
    const debugToolsLabel = page.getByText('Debug Tools')
    if (await debugToolsLabel.isVisible().catch(() => false)) {
      return
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  throw new Error('Debug Tools menu did not appear for super admin user')
}

test('event page smoke: key sections load with no runtime errors', async ({ page }) => {
  test.setTimeout(90_000)

  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const requestFailures: string[] = []
  const serverErrors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      const isKnownDialogWarning = text.includes('`DialogContent` requires a `DialogTitle`')
      const isKnownStatic404 = text.includes('Failed to load resource: the server responded with a status of 404')
      if (!isKnownDialogWarning && !isKnownStatic404) {
        consoleErrors.push(text)
      }
    }
  })

  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText ?? 'unknown'
    const url = request.url()
    const isAborted = errorText === 'net::ERR_ABORTED'
    const isKnownBenignAbort =
      isAborted &&
      (url.includes('/node_modules/.vite/deps/') ||
        url.includes('fonts.gstatic.com') ||
        url.endsWith('/auth/refresh'))

    if (!isKnownBenignAbort) {
      requestFailures.push(`${request.method()} ${url} :: ${errorText}`)
    }
  })

  page.on('response', (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })

  const loginResponse = await page.request.post(`${API_URL}/auth/login`, {
    data: {
      email: SMOKE_EMAIL,
      password: SMOKE_PASSWORD,
    },
  })
  expect(loginResponse.ok(), `Failed auth/login (${loginResponse.status()})`).toBeTruthy()
  const loginBody = (await loginResponse.json()) as {
    access_token: string
    refresh_token: string
  }

  await page.addInitScript(({ refreshToken }) => {
    localStorage.setItem(
      'cookie-consent',
      JSON.stringify({ essential: true, analytics: true, marketing: true })
    )
    localStorage.setItem('fundrbolt_refresh_token', refreshToken)
    localStorage.setItem(
      'fundrbolt_token_expiry',
      String(Date.now() + 7 * 24 * 60 * 60 * 1000)
    )
  }, { refreshToken: loginBody.refresh_token })

  await goToSmokeEventPage(page, loginBody.access_token)

  const auctionItemsHeading = page.getByRole('heading', { name: 'Auction Items' })
  await expect(auctionItemsHeading).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('heading', { name: '500' })).toHaveCount(0)
  await expect(page.getByText('Failed to load auction items')).toHaveCount(0)
  await expect(page.getByText('Unable to load seating information. Please try again later.')).toHaveCount(0)

  // Open profile debug tools and set spoof time to event start
  await openProfileMenuWithDebugTools(page)
  const spoofTimeMenu = page.getByRole('menuitem', { name: /Spoof Time|Update Spoof Time/ })
  await expect(spoofTimeMenu).toBeVisible({ timeout: 10000 })
  await spoofTimeMenu.click()
  const eventStartButton = page.getByRole('button', { name: 'Event Start' })
  await expect(eventStartButton).toBeVisible({ timeout: 10000 })
  await expect(eventStartButton).toBeEnabled()
  await eventStartButton.click()

  // Spoof first available user by name
  const spoofUserMenu = page.getByRole('menuitem', { name: /^Spoof User/ })
  await expect(spoofUserMenu).toBeVisible({ timeout: 10000 })
  await spoofUserMenu.click()
  const spoofUserOption = page
    .locator('[role="menuitemradio"]')
    .filter({ hasNotText: 'No Spoof User' })
    .first()
  await expect(spoofUserOption).toBeVisible({ timeout: 10000 })
  const spoofUserLabel = (await spoofUserOption.textContent())?.trim() || ''
  await spoofUserOption.click()
  const spoofTriggerText = await page.getByRole('menuitem', { name: /Spoof User:/ }).textContent()
  expect(spoofTriggerText).toBeTruthy()
  expect(spoofTriggerText).not.toBe('Spoof User')
  expect(spoofTriggerText).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)
  const spoofUserName = spoofUserLabel.split(' (')[0]?.trim()
  if (spoofUserName) expect(spoofTriggerText).toContain(spoofUserName)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  await expect(page.getByRole('button', { name: 'Event Details' }).first()).toHaveAttribute('aria-expanded', 'false')

  await expect(
    page.getByText(/My Seating|Loading seating information|Seating information is not available yet|Unable to load seating information/i).first()
  ).toBeVisible({ timeout: 10000 })

  // Verify live auction cards do not show app bid buttons
  await page.getByRole('button', { name: 'Live' }).click()
  const firstLiveCard = page
    .locator("div.group.flex.flex-col.overflow-hidden.rounded-lg")
    .filter({ hasText: 'live' })
    .first()
  await expect(firstLiveCard).toBeVisible({ timeout: 15000 })
  await expect(firstLiveCard.getByRole('button', { name: /Place Bid|Bid Now/i })).toHaveCount(0)
  await expect(firstLiveCard.getByText('Live auction coming up!')).toBeVisible()

  // Verify search + type filter work together
  await page.getByLabel('Search auction items').fill('zzzz-no-match-1234')
  await expect(page.getByText('No auction items available yet')).toBeVisible({ timeout: 10000 })
  await page.getByLabel('Search auction items').fill('')
  await expect(firstLiveCard).toBeVisible({ timeout: 15000 })

  const firstAuctionItem = page.locator("text=/Item #\\d+/").first()
  await expect(firstAuctionItem).toBeVisible({ timeout: 20000 })
  const firstAuctionCard = firstAuctionItem.locator(
    "xpath=ancestor::div[contains(@class,'group') and contains(@class,'overflow-hidden')][1]"
  )
  await firstAuctionCard.click()

  await expect(page.getByText('Donated by')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('dialog').getByText('Live auction coming up!')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Place Bid' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Buy Now/i })).toHaveCount(0)
  await expect(page.getByText('Auction item not found')).toHaveCount(0)
  await expect(page.getByText('Unable to load auction item details')).toHaveCount(0)

  // Verify silent item bid modal does not show NaN
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Silent' }).click()
  const firstSilentCard = page
    .locator("div.group.flex.flex-col.overflow-hidden.rounded-lg")
    .filter({ hasText: 'silent' })
    .first()
  await expect(firstSilentCard).toBeVisible({ timeout: 15000 })
  await firstSilentCard.click()
  const silentItemDialog = page.getByRole('dialog').first()
  await expect(silentItemDialog).toBeVisible({ timeout: 10000 })
  await expect(
    silentItemDialog
      .getByText(/Slide to Place Bid|Slide to Set Max Bid/i)
      .first()
  ).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/\$NaN/)).toHaveCount(0)

  const pageTitle = await page.title()
  expect(pageTitle.length).toBeGreaterThan(0)

  expect(pageErrors, `Unhandled page errors:\n${pageErrors.join('\n')}`).toEqual([])
  expect(consoleErrors, `Console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(requestFailures, `Network request failures:\n${requestFailures.join('\n')}`).toEqual([])
  expect(serverErrors, `HTTP 5xx responses:\n${serverErrors.join('\n')}`).toEqual([])
})
