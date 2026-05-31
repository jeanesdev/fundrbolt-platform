import { ADMIN_APP_URL, DONOR_APP_URL } from '../../playwright.config'
import { expect, test } from '../../fixtures/base-fixtures'

test('donor app home page responds successfully', async ({ page }) => {
  const response = await page.goto(DONOR_APP_URL, { waitUntil: 'domcontentloaded' })

  expect(response?.status()).toBeLessThan(400)
})

test('admin app home page responds successfully', async ({ page }) => {
  const response = await page.goto(ADMIN_APP_URL, { waitUntil: 'domcontentloaded' })

  expect(response?.status()).toBeLessThan(400)
})
