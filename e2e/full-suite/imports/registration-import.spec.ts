import { API_URL } from '../../playwright.config'
import { loginAs } from '../../helpers/auth'
import { provisionEvent } from '../../helpers/provision'
import { expect, test } from '../../fixtures/base-fixtures'

test('admin can submit a registration CSV import', async ({ page, adminApi }) => {
  const session = await loginAs('npo_admin')
  const event = (await provisionEvent(adminApi)) as Record<string, unknown>
  const csv = `external_registration_id,email,first_name,last_name\nreg-1,guest@example.com,Guest,One\n`
  const response = await page.request.post(
    `${API_URL}/admin/events/${String(event.id)}/registrations/import/preflight`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      multipart: {
        file: {
          name: 'registrations.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(csv),
        },
      },
    },
  )
  expect(response.status()).toBeLessThan(500)
})
