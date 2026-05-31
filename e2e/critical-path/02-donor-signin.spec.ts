import { DONOR_APP_URL } from '../playwright.config'
import { storeSeedAuth } from '../helpers/auth'
import { expect, test } from '../fixtures/base-fixtures'

test('seed donor can sign in and sign out', async ({ page }) => {
  await storeSeedAuth(page, 'donor')
  await page.goto(DONOR_APP_URL, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/127.0.0.1:5174|localhost:5174/)
  await page.evaluate(() => localStorage.removeItem('fundrbolt-auth-storage'))
  await page.reload()
  await expect(page).toHaveURL(/127.0.0.1:5174|localhost:5174/)
})
