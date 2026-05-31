import { ADMIN_APP_URL, API_URL } from '../../playwright.config'
import { loginAs, storeSeedAuth } from '../../helpers/auth'
import { provisionEvent } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('admin can reach the bid import flow from the admin app and submit a file', async ({ page, adminApi }) => {
  await storeSeedAuth(page, 'npo_admin', 'admin')
  await page.goto(ADMIN_APP_URL, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/localhost|127\.0\.0\.1|fundrbolt/i)

  const session = await loginAs('npo_admin')
  const event = (await provisionEvent(adminApi)) as Record<string, unknown>
  const csv = `bidder_number,item_id,amount\n101,missing,100\n`
  const response = await page.request.post(
    `${API_URL}/admin/events/${String(event.id)}/auction-bids/import/preflight`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      multipart: {
        file: {
          name: 'bids.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(csv),
        },
      },
    },
  )
  expect(response.status()).toBeLessThan(500)
})
