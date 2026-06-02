import { DONOR_APP_URL } from '../../playwright.config'
import { expect, test } from '../../fixtures/base-fixtures'

// TODO: Replace this placeholder with axe-core assertions when @axe-core/playwright lands in T089.
test('donor sign-in page loads without console errors', async ({ page }) => {
  test.skip(!!process.env.CI, 'Requires frontend dev server')
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })

  await page.goto(`${DONOR_APP_URL}/sign-in`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')

  expect(errors).toEqual([])
})
