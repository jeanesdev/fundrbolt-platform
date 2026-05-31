import { expect, test } from '../../fixtures/base-fixtures'

test('responsive subset placeholder keeps configuration valid', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  expect(page.viewportSize()?.width).toBe(375)
})
