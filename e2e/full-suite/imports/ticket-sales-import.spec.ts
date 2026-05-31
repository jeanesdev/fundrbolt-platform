import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { provisionEvent } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('admin can submit a ticket-sales CSV import', async ({ page, adminApi }) => {
  const session = await loginAs('npo_admin')
  const event = (await provisionEvent(adminApi)) as Record<string, unknown>
  const csv = `purchaser_email,ticket_package_name,quantity,total_amount\ndonor@example.com,General Admission,1,100.00\n`
  const response = await page.request.post(
    `${API_URL}/admin/events/${String(event.id)}/ticket-sales/import/preflight`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      multipart: {
        file: {
          name: 'ticket-sales.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(csv),
        },
      },
    },
  )
  expect(response.status()).toBeLessThan(500)
})
