import { API_URL } from '../../playwright.config'
import { expect, test } from '../../fixtures/base-fixtures'

test('donate-now config endpoint is accessible', async ({ page, seedRefs }) => {
  test.skip(true, 'Donate Now requires NPO configuration not present in seed data')
  const response = await page.request.get(`${API_URL}/npos/${seedRefs.nonprofitSlug}/donate-now`)
  const body = (await response.json()) as Record<string, unknown>

  expect(response.ok(), await response.text()).toBeTruthy()
  expect(body).toBeTruthy()
})

test('donation preset amounts are accessible', async ({ page, seedRefs }) => {
  test.skip(true, 'Donate Now requires NPO configuration not present in seed data')
  const response = await page.request.get(`${API_URL}/npos/${seedRefs.nonprofitSlug}/donate-now`)
  const body = (await response.json()) as Record<string, unknown>
  const amounts = Array.isArray(body.preset_amounts)
    ? body.preset_amounts
    : Array.isArray(body.donation_tiers)
      ? body.donation_tiers
      : []

  expect(response.ok(), await response.text()).toBeTruthy()
  expect(Array.isArray(amounts)).toBe(true)
})
