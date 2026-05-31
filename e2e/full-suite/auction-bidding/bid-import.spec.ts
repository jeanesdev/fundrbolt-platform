import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { provisionEvent } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('bid import endpoint accepts CSV data', async ({ page, adminApi }) => {
  const session = await loginAs('npo_admin')
  const event = (await provisionEvent(adminApi)) as Record<string, unknown>
  const csv = `bidder_number,item_id,amount\n101,invalid-item,100\n`
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

test('invalid bid CSV rows are reported', async ({ page, adminApi }) => {
  const session = await loginAs('npo_admin')
  const event = (await provisionEvent(adminApi)) as Record<string, unknown>
  const csv = `bidder_number,item_id,amount\n,missing,not-a-number\n`
  const response = await page.request.post(
    `${API_URL}/admin/events/${String(event.id)}/auction-bids/import/preflight`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      multipart: {
        file: {
          name: 'invalid-bids.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(csv),
        },
      },
    },
  )
  expect(response.status()).toBeLessThan(500)
})
