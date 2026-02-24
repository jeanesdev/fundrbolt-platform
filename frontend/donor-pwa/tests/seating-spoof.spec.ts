/// <reference types="node" />

import { expect, test, type Page } from '@playwright/test'

const APP_URL = process.env.SMOKE_APP_URL ?? 'http://localhost:5174'
const API_URL = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:8000/api/v1'
const SMOKE_EMAIL = process.env.SMOKE_EMAIL ?? 'super_admin@test.com'
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD ?? 'SuperAdmin123!'

const seatingStateMatcher =
  /My Seating|Loading seating information|Seating information is not available yet|Unable to load seating information/i

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
  expect(uniqueCandidateSlugs.length, 'No events available for seating spoof test').toBeGreaterThan(0)

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

  throw new Error('Unable to find a healthy event page for seating spoof test')
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

test(
  'spoofed seating state remains visible across polling transitions',
  async ({ page }: { page: Page }) => {
    test.setTimeout(90_000)

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

    await page.addInitScript(({ refreshToken }: { refreshToken: string }) => {
      localStorage.setItem(
        'cookie-consent',
        JSON.stringify({ essential: true, analytics: true, marketing: true })
      )
      localStorage.setItem('fundrbolt_refresh_token', refreshToken)
      localStorage.setItem('fundrbolt_token_expiry', String(Date.now() + 7 * 24 * 60 * 60 * 1000))
    }, { refreshToken: loginBody.refresh_token })

    await goToSmokeEventPage(page, loginBody.access_token)

    const auctionItemsHeading = page.getByRole('heading', { name: 'Auction Items' })
    await expect(auctionItemsHeading).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('heading', { name: '500' })).toHaveCount(0)

    const seatingState = page.getByText(seatingStateMatcher).first()
    await expect(seatingState).toBeVisible({ timeout: 15000 })

    await openProfileMenuWithDebugTools(page)
    const spoofUserMenu = page.getByRole('menuitem', { name: /^Spoof User/ })
    await expect(spoofUserMenu).toBeVisible({ timeout: 10000 })
    await spoofUserMenu.click()

    const spoofUserOption = page
      .locator('[role="menuitemradio"]')
      .filter({ hasNotText: 'No Spoof User' })
      .first()

    await expect(spoofUserOption).toBeVisible({ timeout: 10000 })
    await spoofUserOption.click()

    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')

    await expect(seatingState).toBeVisible({ timeout: 15000 })

    // wait past seating poll interval (10s) to verify section does not disappear
    await page.waitForTimeout(12_000)
    await expect(seatingState).toBeVisible({ timeout: 15000 })
  }
)
